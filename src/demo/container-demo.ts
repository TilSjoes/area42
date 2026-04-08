/**
 * Area42 v2 Complete Demo — Session 5
 *
 * Full dashboard showcasing all v2 features as migration reference
 * for AgentSmith tabs:
 *
 * - Container architecture with clipping (Session 1)
 * - Layout engine: vertical, horizontal, grid (Session 2)
 * - Style inheritance with domain contexts (Session 2+3)
 * - Reactive data binding with live updates (Session 3)
 * - Text, Button, Separator elements (Session 4)
 * - Nested panels, graph-in-panel, drill-down patterns (all sessions)
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import { Panel } from "../panels/panel.js";
import { SceneNode } from "../core/scene.js";
import { MutableSource } from "../data/reactive.js";
import { DomainContext } from "../data/domain.js";
import { BoundMetric, BoundStatusDot } from "../data/bound.js";
import { Text } from "../elements/text.js";
import { Button } from "../elements/button.js";
import { Separator } from "../elements/separator.js";

// --- Setup ---
const hud = new HUD("#hud", { theme: "neon", background: false });
const el = document.getElementById("hud")!;
el.style.background = "linear-gradient(135deg, #0c1120 0%, #0f1628 50%, #0a0e17 100%)";

const W = hud.renderer.width;
const H = hud.renderer.height;

// ============================================================================
// DATA SOURCES
// ============================================================================

const routerStats = new MutableSource({
  requests: 0, tokensIn: 0, tokensOut: 0, avgLatency: 0,
  cacheHit: 87, models: 4, cost: 0, savings: 0,
}, "Router Stats", "routing");

const infraHealth = new MutableSource({
  spine: "healthy", moe: "healthy", dense: "degraded",
  claude: "healthy", nats: "healthy", marvin: "healthy",
}, "Infra Health", "infra");

const missionStats = new MutableSource({
  active: 3, completed: 47, failed: 2, queued: 1,
}, "Mission Stats", "missions");

// ============================================================================
// DOMAIN: ROUTING
// ============================================================================

const routingDomain = new DomainContext("routing", {
  style: { accent: "#4dabf7" },
  sources: { stats: routerStats },
});

// --- Request Flow Graph ---
const flowPanel = routingDomain.createPanel({
  title: "Request Flow",
  position: { x: 10, y: 10 },
  size: { x: 440, y: 280 },
  clip: true,
});

const graph = new Graph({
  id: "flow",
  size: { x: 424, y: 236 },
});

graph.addNode({ id: "spine", label: "Spine", color: "#f97316", shape: "hexagon", size: 20 });
graph.addNode({ id: "moe", label: "MoE", color: "#22d3ee", size: 18 });
graph.addNode({ id: "dense", label: "Dense", color: "#4dabf7", size: 16 });
graph.addNode({ id: "claude", label: "Claude", color: "#f97316", shape: "diamond", size: 18 });
graph.addNode({ id: "gpt", label: "GPT-5.2", color: "#ffd43b", size: 16 });

graph.addEdge({ from: "spine", to: "moe", color: "#22d3ee66", particles: true });
graph.addEdge({ from: "spine", to: "dense", color: "#4dabf766", particles: true });
graph.addEdge({ from: "spine", to: "claude", color: "#f9731666", particles: true });
graph.addEdge({ from: "spine", to: "gpt", color: "#ffd43b66", particles: true });

flowPanel.add(graph);
hud.registerPanel(flowPanel);

// --- Router Metrics ---
const metricsPanel = routingDomain.createPanel({
  title: "Router Metrics",
  position: { x: 460, y: 10 },
  size: { x: 240, y: 280 },
  clip: true,
});

metricsPanel.childLayout = "vertical";
metricsPanel.gap = 4;

metricsPanel.add(new BoundMetric({ label: "Requests", source: routerStats, field: "requests", color: "#4dabf7" }));
metricsPanel.add(new BoundMetric({ label: "Tokens In", source: routerStats, field: "tokensIn",
  format: (v: number) => v > 1000 ? `${(v / 1000).toFixed(1)}K` : String(v), color: "#22d3ee" }));
metricsPanel.add(new BoundMetric({ label: "Avg Latency", source: routerStats, field: "avgLatency",
  format: (v: number) => `${v}ms`, color: "#51cf66" }));
metricsPanel.add(new Separator());
metricsPanel.add(new BoundMetric({ label: "Cache Hit", source: routerStats, field: "cacheHit",
  format: (v: number) => `${v}%`, color: "#ffd43b" }));

hud.registerPanel(metricsPanel);

// ============================================================================
// DOMAIN: INFRASTRUCTURE
// ============================================================================

const infraDomain = new DomainContext("infra", {
  style: { accent: "#51cf66" },
  sources: { health: infraHealth },
});

const healthPanel = infraDomain.createPanel({
  title: "Service Health",
  position: { x: 710, y: 10 },
  size: { x: 220, y: 280 },
  clip: true,
});

healthPanel.childLayout = "vertical";
healthPanel.gap = 2;

healthPanel.add(new Text({ text: "Backend Services", size: { x: 200, y: 16 }, weight: "bold", uppercase: true, fontSize: 8, dim: true, letterSpacing: 1.5 }));
healthPanel.add(new BoundStatusDot({ label: "Spine Classifier", source: infraHealth, field: "spine" }));
healthPanel.add(new BoundStatusDot({ label: "Qwen3.5 MoE", source: infraHealth, field: "moe" }));
healthPanel.add(new BoundStatusDot({ label: "Qwen3.5 Dense", source: infraHealth, field: "dense" }));
healthPanel.add(new Separator());
healthPanel.add(new Text({ text: "Infrastructure", size: { x: 200, y: 16 }, weight: "bold", uppercase: true, fontSize: 8, dim: true, letterSpacing: 1.5 }));
healthPanel.add(new BoundStatusDot({ label: "Claude CLI", source: infraHealth, field: "claude" }));
healthPanel.add(new BoundStatusDot({ label: "NATS JetStream", source: infraHealth, field: "nats" }));
healthPanel.add(new BoundStatusDot({ label: "Marvin Router", source: infraHealth, field: "marvin" }));

hud.registerPanel(healthPanel);

// ============================================================================
// DOMAIN: MISSIONS
// ============================================================================

const missionDomain = new DomainContext("missions", {
  style: { accent: "#f97316" },
  sources: { stats: missionStats },
});

const missionPanel = missionDomain.createPanel({
  title: "Missions",
  position: { x: 940, y: 10 },
  size: { x: 220, y: 280 },
  clip: true,
});

missionPanel.childLayout = "vertical";
missionPanel.gap = 4;

missionPanel.add(new BoundMetric({ label: "Active", source: missionStats, field: "active", color: "#f97316", size: { x: 200, y: 50 } }));
missionPanel.add(new BoundMetric({ label: "Completed", source: missionStats, field: "completed", color: "#51cf66", size: { x: 200, y: 50 } }));
missionPanel.add(new BoundMetric({ label: "Failed", source: missionStats, field: "failed", color: "#ff6b6b", size: { x: 200, y: 50 } }));
missionPanel.add(new Separator());

// Buttons for actions
const btnRow = new SceneNode({ size: { x: 200, y: 36 } });
btnRow.childLayout = "horizontal";
btnRow.gap = 6;

const newMissionBtn = new Button({ label: "New Mission", size: { x: 95, y: 30 }, variant: "accent", color: "#f97316" });
newMissionBtn.onClick(() => {
  missionStats.update({ active: missionStats.data.active + 1 });
});

const retryBtn = new Button({ label: "Retry", size: { x: 70, y: 30 }, variant: "ghost", color: "#ff6b6b" });
retryBtn.onClick(() => {
  const f = missionStats.data.failed;
  if (f > 0) missionStats.update({ failed: f - 1, active: missionStats.data.active + 1 });
});

btnRow.add(newMissionBtn);
btnRow.add(retryBtn);
missionPanel.add(btnRow);

hud.registerPanel(missionPanel);

// ============================================================================
// BOTTOM ROW: Backends grid + Info panel
// ============================================================================

const backendsPanel = hud.panel({
  title: "Backends",
  position: { x: 10, y: 300 },
  size: { x: 560, y: 180 },
  titleColor: "#22d3ee",
  clip: true,
});

backendsPanel.childLayout = "grid";
backendsPanel.gap = 6;

function tile(label: string, value: string, color: string): SceneNode {
  const t = new SceneNode({ size: { x: 100, y: 65 } });
  t.style = { accent: color };
  t.render = function(ctx: CanvasRenderingContext2D) {
    const s = this.resolvedStyle();
    const w = this.size.x, h = this.size.y;
    ctx.fillStyle = s.accent + "0a";
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 6); ctx.fill();
    ctx.strokeStyle = s.accent + "44"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.font = `bold 18px ${s.fontFamily}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = s.accent; ctx.shadowBlur = 6;
    ctx.fillText(value, w / 2, h / 2 - 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = s.textDim;
    ctx.font = `bold 8px ${s.fontFamily}`;
    ctx.letterSpacing = "1px";
    ctx.fillText(label.toUpperCase(), w / 2, h / 2 + 14);
    ctx.textAlign = "left"; ctx.letterSpacing = "0px";
  };
  return t;
}

backendsPanel.add(tile("MoE", "83 t/s", "#22d3ee"));
backendsPanel.add(tile("Dense", "2 t/s", "#4dabf7"));
backendsPanel.add(tile("GPT-5.2", "45 t/s", "#ffd43b"));
backendsPanel.add(tile("Claude", "38 t/s", "#f97316"));
backendsPanel.add(tile("VRAM", "19 GB", "#a78bfa"));
backendsPanel.add(tile("Slots", "4/4", "#51cf66"));
backendsPanel.add(tile("Queue", "0", "#00d4aa"));
backendsPanel.add(tile("Errors", "0", "#ff6b6b"));
backendsPanel.add(tile("Uptime", "42d", "#4dabf7"));

// --- Info panel with Text ---
const infoPanel = hud.panel({
  title: "Area42 v2",
  position: { x: 580, y: 300 },
  size: { x: 340, y: 180 },
  titleColor: "#a78bfa",
  clip: true,
});

infoPanel.childLayout = "vertical";
infoPanel.gap = 6;

infoPanel.add(new Text({
  text: "Container Tree Architecture",
  size: { x: 320, y: 18 },
  weight: "bold",
  color: "#a78bfa",
  fontSize: 13,
}));

infoPanel.add(new Text({
  text: "Everything is a Container. Containers hold Containers. The screen is the root Container. Clipping, layout, style inheritance, and reactive data binding — all built in.",
  size: { x: 320, y: 56 },
  wrap: true,
  dim: true,
  fontSize: 10,
}));

infoPanel.add(new Separator());

infoPanel.add(new Text({
  text: "5 sessions: containers + clipping, layout + style, data binding + domains, text + button, full demo migration.",
  size: { x: 320, y: 38 },
  wrap: true,
  fontSize: 9,
  dim: true,
}));

// --- Control buttons panel ---
const ctrlPanel = hud.panel({
  title: "Controls",
  position: { x: 930, y: 300 },
  size: { x: 230, y: 180 },
  titleColor: "#00d4aa",
  clip: true,
});

ctrlPanel.childLayout = "vertical";
ctrlPanel.gap = 6;

const fitBtn = new Button({ label: "Fit Graph", size: { x: 210, y: 28 }, variant: "default", color: "#4dabf7" });
fitBtn.onClick(() => graph.fitToView());

const resetBtn = new Button({ label: "Reset Positions", size: { x: 210, y: 28 }, variant: "default", color: "#22d3ee" });
resetBtn.onClick(() => graph.resetPositions());

const pauseBtn = new Button({ label: "Pause Simulation", size: { x: 210, y: 28 }, variant: "ghost", color: "#ffd43b" });
pauseBtn.onClick(() => {
  graph.toggleSimulation();
  pauseBtn.setLabel(graph.isSimulationActive() ? "Pause Simulation" : "Resume Simulation");
});

const healAllBtn = new Button({ label: "Heal All Services", size: { x: 210, y: 28 }, variant: "accent", color: "#51cf66" });
healAllBtn.onClick(() => {
  infraHealth.set({
    spine: "healthy", moe: "healthy", dense: "healthy",
    claude: "healthy", nats: "healthy", marvin: "healthy",
  });
});

ctrlPanel.add(fitBtn);
ctrlPanel.add(resetBtn);
ctrlPanel.add(pauseBtn);
ctrlPanel.add(healAllBtn);

// ============================================================================
// SIMULATED LIVE DATA
// ============================================================================

let reqCount = 0;
let totalTokens = 0;

setInterval(() => {
  reqCount++;
  const tokens = Math.floor(Math.random() * 500) + 100;
  totalTokens += tokens;

  routerStats.update({
    requests: reqCount,
    tokensIn: totalTokens,
    avgLatency: Math.floor(Math.random() * 200) + 200,
    cacheHit: 82 + Math.floor(Math.random() * 14),
  });

  // Pulse random graph node
  const nodes = ["spine", "moe", "dense", "claude", "gpt"];
  graph.pulse(nodes[Math.floor(Math.random() * nodes.length)]);

  // Occasionally change service health
  if (Math.random() < 0.08) {
    const svcs = ["spine", "moe", "dense", "claude", "nats", "marvin"] as const;
    const svc = svcs[Math.floor(Math.random() * svcs.length)];
    const status = Math.random() < 0.7 ? "healthy" : "degraded";
    infraHealth.update({ [svc]: status } as any);
  }

  // Occasionally complete a mission
  if (Math.random() < 0.15 && missionStats.data.active > 0) {
    missionStats.update({
      active: missionStats.data.active - 1,
      completed: missionStats.data.completed + 1,
    });
  }
}, 1000);

// ============================================================================
// STATUS BAR
// ============================================================================

hud.statusBar.set("v", "Area42 v2 Complete", { color: "#a78bfa" });
hud.statusBar.set("d", "3 domains", { color: "#4dabf7" });
hud.statusBar.set("l", "Live data", { color: "#51cf66" });
