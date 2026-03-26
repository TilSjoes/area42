/**
 * Area42 Router Dashboard Demo
 *
 * Business-mode dashboard showing AI model routing — the same data as
 * AgentSmith Router tab but built natively in Area42.
 *
 * Embedded mode (background: false, subtle gradient).
 * Simulated data with animated particles flowing through the graph.
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import { MetricDisplay } from "../panels/metric.js";
import { TimeSeries } from "../charts/timeseries.js";
import { Table } from "../panels/table.js";
import { withAlpha } from "../core/color.js";

// --- Embedded mode: no universe background ---
const hud = new HUD("#hud", {
  theme: "neon",
  background: false,
});

const container = document.getElementById("hud")!;
container.style.background = "linear-gradient(135deg, #0c1120 0%, #0f1628 50%, #0a0e17 100%)";

const W = hud.renderer.width;
const H = hud.renderer.height;

// ============================================================================
// DATA STATE
// ============================================================================

interface RoutingEvent {
  time: string;
  source: string;
  tier: string;
  backend: string;
  model: string;
  tokens: number;
  latency: number;
  cost: number;
  status: string;
}

const stats = {
  tokensIn: 0,
  tokensOut: 0,
  requests: 0,
  totalCost: 0,
  savings: 0,
};

const tierCounts: Record<string, number> = {
  simple: 0,
  medium: 0,
  complex: 0,
  vision: 0,
};

const backendStats: Record<string, { requests: number; totalLatency: number; tokens: number; costLabel: string; status: string }> = {
  "MoE": { requests: 0, totalLatency: 0, tokens: 0, costLabel: "FREE", status: "green" },
  "Dense": { requests: 0, totalLatency: 0, tokens: 0, costLabel: "FREE", status: "green" },
  "GPT-5.2": { requests: 0, totalLatency: 0, tokens: 0, costLabel: "PRO", status: "green" },
  "Claude": { requests: 0, totalLatency: 0, tokens: 0, costLabel: "SUB", status: "green" },
  "MiniCPM": { requests: 0, totalLatency: 0, tokens: 0, costLabel: "FREE", status: "green" },
};

const events: RoutingEvent[] = [];

const sources = ["AgentSmith", "OpenClaw", "Claude-Code", "Discord", "CLI"];
const tiers = ["simple", "medium", "complex", "vision"];
const tierBackendMap: Record<string, string[]> = {
  simple: ["MoE"],
  medium: ["MoE", "Dense", "GPT-5.2"],
  complex: ["Claude", "GPT-5.2", "Dense"],
  vision: ["MiniCPM"],
};
const tierColors: Record<string, string> = {
  simple: "#51cf66",
  medium: "#ffd43b",
  complex: "#ff6b6b",
  vision: "#a78bfa",
};
const backendColors: Record<string, string> = {
  "MoE": "#22d3ee",
  "Dense": "#4dabf7",
  "GPT-5.2": "#ffd43b",
  "Claude": "#f97316",
  "MiniCPM": "#a78bfa",
};

// ============================================================================
// STATS HEADER
// ============================================================================

const statsPanel = hud.panel({
  title: "Router Metrics",
  position: { x: 20, y: 15 },
  size: { x: W - 40, y: 90 },
  glass: false,
  titleColor: "#00d4aa",
});

const statsMetrics = new MetricDisplay({ columns: 5, valueSize: 20, labelSize: 8 });
statsMetrics.set("Tokens In", "0", "#4dabf7");
statsMetrics.set("Tokens Out", "0", "#22d3ee");
statsMetrics.set("Requests", "0", "#51cf66");
statsMetrics.set("Total Cost", "$0.00", "#ffd43b");
statsMetrics.set("Savings", "$0.00", "#00d4aa");

statsPanel.onContent((ctx, x, y, w, h) => {
  statsMetrics.render(ctx, x, y, w, h);
});

// ============================================================================
// REQUEST FLOW GRAPH (left 60%)
// ============================================================================

const flowW = Math.floor((W - 60) * 0.6);
const flowH = Math.floor(H * 0.42);

const flowPanel = hud.panel({
  title: "Request Flow",
  position: { x: 20, y: 115 },
  size: { x: flowW, y: flowH },
  glass: false,
  titleColor: "#4dabf7",
});

// Build a Graph with manually positioned nodes (all pinned = no force physics)
const graph = new Graph({ id: "router-flow", size: { x: flowW, y: flowH } });

// Column X positions (relative to center)
const colSource = -flowW * 0.38;
const colSpine = 0;
const colTier = flowW * 0.2;
const colBackend = flowW * 0.38;

// Source nodes (left column)
const sourceY = [-flowH * 0.32, -flowH * 0.16, 0, flowH * 0.16, flowH * 0.32];
const sourceColors = ["#4dabf7", "#f97316", "#a78bfa", "#51cf66", "#22d3ee"];
sources.forEach((s, i) => {
  const n = graph.addNode({
    id: "src-" + s,
    label: s,
    position: { x: colSource, y: sourceY[i] },
    color: sourceColors[i],
    shape: "circle",
    size: 16,
  });
  n.pinned = true;
});

// Spine node (center, orange hexagon)
const spineNode = graph.addNode({
  id: "spine",
  label: "Spine",
  position: { x: colSpine, y: 0 },
  color: "#f97316",
  shape: "hexagon",
  size: 28,
});
spineNode.pinned = true;

// Tier nodes (right of spine)
const tierNames = ["Simple", "Medium", "Complex", "Vision"];
const tierYPositions = [-flowH * 0.24, -flowH * 0.08, flowH * 0.08, flowH * 0.24];
tierNames.forEach((t, i) => {
  const key = t.toLowerCase();
  const n = graph.addNode({
    id: "tier-" + key,
    label: t,
    position: { x: colTier, y: tierYPositions[i] },
    color: tierColors[key],
    shape: "rect",
    size: 14,
  });
  n.pinned = true;
});

// Backend nodes (rightmost column)
const backendNames = ["MoE", "Dense", "GPT-5.2", "Claude", "MiniCPM"];
const backendY = [-flowH * 0.28, -flowH * 0.14, 0, flowH * 0.14, flowH * 0.28];
backendNames.forEach((b, i) => {
  const n = graph.addNode({
    id: "backend-" + b,
    label: b,
    position: { x: colBackend, y: backendY[i] },
    color: backendColors[b],
    shape: "circle",
    size: 14,
  });
  n.pinned = true;
});

// Edges: sources -> spine
sources.forEach((s) => {
  graph.addEdge({
    from: "src-" + s,
    to: "spine",
    color: withAlpha("#6b7b8d", "44"),
    width: 0.8,
    dashed: true,
  });
});

// Edges: spine -> tiers
tierNames.forEach((t) => {
  const key = t.toLowerCase();
  graph.addEdge({
    from: "spine",
    to: "tier-" + key,
    color: withAlpha(tierColors[key], "55"),
    width: 1,
  });
});

// Edges: tiers -> backends
for (const [tier, backends] of Object.entries(tierBackendMap)) {
  for (const b of backends) {
    graph.addEdge({
      from: "tier-" + tier,
      to: "backend-" + b,
      color: withAlpha(backendColors[b], "44"),
      width: 0.8,
    });
  }
}

// Add graph to scene
hud.scene.root.add(graph);

// Render the graph inside the flow panel using custom content
flowPanel.onContent((ctx, x, y, w, h) => {
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "8px system-ui";
  ctx.fillText("SOURCES", x + 10, y + h - 8);
  ctx.textAlign = "center";
  ctx.fillText("CLASSIFIER", x + w * 0.5, y + h - 8);
  ctx.textAlign = "right";
  ctx.fillText("BACKENDS", x + w - 10, y + h - 8);
  ctx.textAlign = "left";
});

// Position graph to overlay the flow panel area
graph.offsetX = 20 + flowW / 2;
graph.offsetY = 115 + 28 + flowH / 2 - 14;

// ============================================================================
// BACKENDS PANEL (right 40%)
// ============================================================================

const backendsX = 20 + flowW + 20;
const backendsW = W - backendsX - 20;

const backendsPanel = hud.panel({
  title: "Backends",
  position: { x: backendsX, y: 115 },
  size: { x: backendsW, y: flowH },
  glass: false,
  titleColor: "#22d3ee",
});

// One TimeSeries per backend for latency sparkline
const backendTimeSeries: Record<string, TimeSeries> = {};
for (const b of backendNames) {
  backendTimeSeries[b] = new TimeSeries({ color: backendColors[b], maxPoints: 30, lineWidth: 1 });
  for (let i = 0; i < 15; i++) {
    const base = b === "MoE" ? 80 : b === "Dense" ? 500 : b === "Claude" ? 200 : b === "GPT-5.2" ? 150 : 120;
    backendTimeSeries[b].push(base + Math.random() * base * 0.4);
  }
}

backendsPanel.onContent((ctx, x, y, w, h) => {
  const cardH = Math.floor((h - 10) / backendNames.length);

  backendNames.forEach((b, i) => {
    const cy = y + i * cardH;
    const bs = backendStats[b];
    const color = backendColors[b];
    const avgLatency = bs.requests > 0 ? Math.round(bs.totalLatency / bs.requests) : 0;

    // Card background
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(x, cy, w, cardH - 4);

    // Left color bar
    ctx.fillStyle = color;
    ctx.fillRect(x, cy, 3, cardH - 4);

    // Status dot
    const dotColor = bs.status === "green" ? "#51cf66" : bs.status === "yellow" ? "#ffd43b" : "#ff6b6b";
    ctx.beginPath();
    ctx.arc(x + 14, cy + 12, 4, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();

    // Name
    ctx.fillStyle = "#c8d6e5";
    ctx.font = "bold 11px system-ui";
    ctx.fillText(b, x + 24, cy + 15);

    // Cost label badge
    ctx.fillStyle = withAlpha(color, "22");
    const badgeText = bs.costLabel;
    ctx.font = "bold 8px system-ui";
    const badgeW = ctx.measureText(badgeText).width + 8;
    ctx.fillRect(x + w - badgeW - 4, cy + 5, badgeW, 14);
    ctx.fillStyle = color;
    ctx.textAlign = "right";
    ctx.fillText(badgeText, x + w - 8, cy + 15);
    ctx.textAlign = "left";

    // Sparkline
    const sparkY = cy + 22;
    const sparkH = cardH - 52;
    if (sparkH > 8) {
      backendTimeSeries[b].render(ctx, x + 8, sparkY, w - 16, sparkH);
    }

    // Stats row
    const statY = cy + cardH - 18;
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "9px system-ui";
    ctx.fillText(avgLatency + "ms avg", x + 8, statY);
    ctx.fillText(bs.requests + " req", x + 80, statY);
    ctx.fillText((bs.tokens / 1000).toFixed(1) + "k tok", x + 140, statY);
  });
});

// ============================================================================
// TIER DISTRIBUTION PANEL (bottom left)
// ============================================================================

const tierPanelY = 115 + flowH + 15;
const tierPanelW = Math.floor((W - 60) * 0.5);
const tierPanelH = Math.floor(H * 0.18);

const tierPanel = hud.panel({
  title: "Tier Distribution",
  position: { x: 20, y: tierPanelY },
  size: { x: tierPanelW, y: tierPanelH },
  glass: false,
  titleColor: "#ffd43b",
});

tierPanel.onContent((ctx, x, y, w, h) => {
  const total = Object.values(tierCounts).reduce((a, b) => a + b, 0) || 1;
  const barH = 22;
  let by = y + 4;

  for (const tier of tiers) {
    const count = tierCounts[tier];
    const pct = (count / total) * 100;
    const color = tierColors[tier];

    ctx.fillStyle = color;
    ctx.font = "bold 10px system-ui";
    ctx.fillText(tier.charAt(0).toUpperCase() + tier.slice(1), x, by + 14);

    const barX = x + 80;
    const barW = w - 140;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(barX, by + 4, barW, barH - 8);

    ctx.fillStyle = withAlpha(color, "88");
    ctx.fillRect(barX, by + 4, barW * (pct / 100), barH - 8);

    ctx.fillStyle = "#c8d6e5";
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(pct.toFixed(1) + "%", x + w, by + 14);
    ctx.textAlign = "left";

    ctx.fillStyle = "#6b7b8d";
    ctx.font = "9px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(String(count), x + w - 50, by + 14);
    ctx.textAlign = "left";

    by += barH;
  }
});

// ============================================================================
// COST SAVINGS PANEL (bottom right of tier)
// ============================================================================

const savingsPanel = hud.panel({
  title: "Cost Savings",
  position: { x: 20 + tierPanelW + 20, y: tierPanelY },
  size: { x: W - tierPanelW - 60, y: tierPanelH },
  glass: false,
  titleColor: "#00d4aa",
});

savingsPanel.onContent((ctx, x, y, w, h) => {
  ctx.fillStyle = "#00d4aa";
  ctx.font = "bold 32px system-ui";
  ctx.shadowColor = "#00d4aa";
  ctx.shadowBlur = 10;
  ctx.fillText("$" + stats.savings.toFixed(2), x, y + 36);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#6b7b8d";
  ctx.font = "9px system-ui";
  ctx.fillText("SAVED VS ALL-CLAUDE", x, y + 50);

  // Percentage arc ring
  const totalIfClaude = stats.requests * 0.024;
  const pct = totalIfClaude > 0 ? Math.min(100, (stats.savings / totalIfClaude) * 100) : 0;

  const arcX = x + w - 50;
  const arcY = y + 35;
  const arcR = 28;

  ctx.beginPath();
  ctx.arc(arcX, arcY, arcR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 5;
  ctx.stroke();

  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2) * (pct / 100);
  ctx.beginPath();
  ctx.arc(arcX, arcY, arcR, startAngle, endAngle);
  ctx.strokeStyle = "#00d4aa";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#00d4aa";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#00d4aa";
  ctx.font = "bold 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(pct.toFixed(0) + "%", arcX, arcY + 5);
  ctx.textAlign = "left";

  // Breakdown
  const bx = x + 160;
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "9px system-ui";
  ctx.fillText("LOCAL (FREE)", bx, y + 16);
  ctx.fillText("API (PAID)", bx, y + 34);
  ctx.fillText("IF ALL CLAUDE", bx, y + 52);

  ctx.fillStyle = "#51cf66";
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "right";
  const localReqs = backendStats["MoE"].requests + backendStats["Dense"].requests + backendStats["MiniCPM"].requests;
  ctx.fillText(localReqs + " req / $0.00", bx + 130, y + 16);
  ctx.fillStyle = "#ffd43b";
  ctx.fillText((backendStats["GPT-5.2"].requests + backendStats["Claude"].requests) + " req / $" + stats.totalCost.toFixed(2), bx + 130, y + 34);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText(stats.requests + " req / $" + (stats.requests * 0.024).toFixed(2), bx + 130, y + 52);
  ctx.textAlign = "left";
});

// ============================================================================
// LIVE STREAM TABLE (full width bottom)
// ============================================================================

const streamY = tierPanelY + tierPanelH + 15;
const streamH = H - streamY - 20;

const streamPanel = hud.panel({
  title: "Live Stream",
  position: { x: 20, y: streamY },
  size: { x: W - 40, y: streamH },
  glass: false,
  titleColor: "#a78bfa",
});

const streamTable = new Table([
  { key: "time", label: "Time", width: 0.1 },
  { key: "source", label: "Source", width: 0.12 },
  { key: "tier", label: "Tier", width: 0.1 },
  { key: "backend", label: "Backend", width: 0.1 },
  { key: "model", label: "Model", width: 0.18 },
  { key: "tokens", label: "Tokens", width: 0.1, align: "right" as const },
  { key: "latency", label: "Latency", width: 0.1, align: "right" as const, format: (v: any) => v + "ms" },
  { key: "cost", label: "Cost", width: 0.1, align: "right" as const, format: (v: any) => Number(v) > 0 ? "$" + Number(v).toFixed(4) : "FREE" },
  { key: "status", label: "Status", width: 0.1 },
]);

streamPanel.onContent((ctx, x, y, w, h) => {
  streamTable.render(ctx, x, y, w, h);
});

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

const modelMap: Record<string, string> = {
  "MoE": "Qwen3.5-35B-A3B",
  "Dense": "Qwen3.5-27B",
  "GPT-5.2": "GPT-5.2",
  "Claude": "Claude Sonnet 4.5",
  "MiniCPM": "MiniCPM-V 4.5",
};

const costMap: Record<string, number> = {
  "MoE": 0,
  "Dense": 0,
  "GPT-5.2": 0.008,
  "Claude": 0.024,
  "MiniCPM": 0,
};

function simulateEvent(): void {
  const source = sources[Math.floor(Math.random() * sources.length)];

  const tierRoll = Math.random();
  const tier = tierRoll < 0.45 ? "simple" : tierRoll < 0.78 ? "medium" : tierRoll < 0.95 ? "complex" : "vision";

  const backends = tierBackendMap[tier];
  const backend = backends[Math.floor(Math.random() * backends.length)];

  const baseLatency = backend === "MoE" ? 80 : backend === "Dense" ? 500 : backend === "Claude" ? 200 : backend === "GPT-5.2" ? 150 : 120;
  const latency = Math.round(baseLatency + Math.random() * baseLatency * 0.5);

  const tokens = Math.round(200 + Math.random() * 2000);
  const outTokens = Math.round(tokens * (0.5 + Math.random()));
  const cost = costMap[backend] * (tokens / 1000);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const event: RoutingEvent = {
    time: timeStr,
    source,
    tier: tier.charAt(0).toUpperCase() + tier.slice(1),
    backend,
    model: modelMap[backend],
    tokens,
    latency,
    cost,
    status: Math.random() > 0.02 ? "OK" : "TIMEOUT",
  };

  stats.tokensIn += tokens;
  stats.tokensOut += outTokens;
  stats.requests++;
  stats.totalCost += cost;
  stats.savings += (0.024 * tokens / 1000) - cost;
  tierCounts[tier]++;

  const bs = backendStats[backend];
  bs.requests++;
  bs.totalLatency += latency;
  bs.tokens += tokens;
  backendTimeSeries[backend].push(latency);

  for (const b of backendNames) {
    const r = Math.random();
    backendStats[b].status = r > 0.98 ? "red" : r > 0.92 ? "yellow" : "green";
  }

  statsMetrics.set("Tokens In", (stats.tokensIn / 1000).toFixed(1) + "k", "#4dabf7");
  statsMetrics.set("Tokens Out", (stats.tokensOut / 1000).toFixed(1) + "k", "#22d3ee");
  statsMetrics.set("Requests", String(stats.requests), "#51cf66");
  statsMetrics.set("Total Cost", "$" + stats.totalCost.toFixed(2), "#ffd43b");
  statsMetrics.set("Savings", "$" + stats.savings.toFixed(2), "#00d4aa");

  events.unshift(event);
  if (events.length > 50) events.length = 50;
  streamTable.setData(events.map(e => ({
    ...e,
    _badge: e.status,
    _badgeColor: e.status === "OK" ? "#51cf66" : "#ff6b6b",
    _color: tierColors[e.tier.toLowerCase()] || "#c8d6e5",
  })));

  // Animate particles through the graph: source -> spine -> tier -> backend
  graph.particle("src-" + source, "spine", { color: sourceColors[sources.indexOf(source)], speed: 0.8, size: 3 });

  setTimeout(() => {
    graph.particle("spine", "tier-" + tier, { color: tierColors[tier], speed: 0.7, size: 2.5 });
  }, 200);

  setTimeout(() => {
    graph.particle("tier-" + tier, "backend-" + backend, { color: backendColors[backend], speed: 0.6, size: 2 });
    graph.pulse("backend-" + backend, backendColors[backend]);
  }, 450);
}

function scheduleNext(): void {
  const delay = 1000 + Math.random() * 2000;
  setTimeout(() => {
    simulateEvent();
    scheduleNext();
  }, delay);
}

// Seed initial data
for (let i = 0; i < 20; i++) {
  simulateEvent();
}
scheduleNext();

// ============================================================================
// CONSOLE LOG
// ============================================================================

console.log(
  "%c Area42 %c Router Dashboard Demo ",
  "background:#0a0e17;color:#f97316;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px",
  "background:#131a2b;color:#c8d6e5;padding:4px 8px;border-radius:0 4px 4px 0",
);
console.log("  AI model routing visualization with live particle flow");
console.log("  Sources -> Spine classifier -> Tier -> Backend");
console.log("  Drag panels by title bars. Resize from corners. Press ? for help.");
