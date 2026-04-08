/**
 * Area42 v2 Container Demo — Session 3
 *
 * Demonstrates:
 * - Session 1: Graph inside Panel (clipping), nested panels
 * - Session 2: Layout engine (vertical, horizontal, grid), style inheritance
 * - Session 3: Reactive data binding, domain contexts, bound elements
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import { Panel } from "../panels/panel.js";
import { SceneNode } from "../core/scene.js";
import { MutableSource, field } from "../data/reactive.js";
import { DomainContext } from "../data/domain.js";
import { BoundMetric, BoundStatusDot } from "../data/bound.js";

// --- Setup HUD ---
const hud = new HUD("#hud", { theme: "neon", background: false });
const container = document.getElementById("hud")!;
container.style.background = "linear-gradient(135deg, #0c1120 0%, #0f1628 50%, #0a0e17 100%)";

// ============================================================================
// DOMAIN 1: Router (reactive data source + bound metrics)
// ============================================================================

// Create a reactive data source (simulates SSE from Marvin /api/stats)
const routerStats = new MutableSource({
  requests: 0,
  tokensIn: 0,
  tokensOut: 0,
  avgLatency: 0,
  cacheHitRate: 87,
  activeModels: 4,
  cost: 0,
}, "Router Stats", "routing");

// Create a domain context — all elements share routing style
const routerDomain = new DomainContext("routing", {
  style: { accent: "#4dabf7" },
  sources: { stats: routerStats },
});

// --- Graph panel (from domain) ---
const graphPanel = routerDomain.createPanel({
  title: "Request Flow",
  position: { x: 20, y: 20 },
  size: { x: 460, y: 320 },
  clip: true,
});

const graph = new Graph({
  id: "flow-graph",
  position: { x: 0, y: 0 },
  size: { x: 444, y: 276 },
});

graph.addNode({ id: "spine", label: "Spine", color: "#f97316", shape: "hexagon", size: 22 });
graph.addNode({ id: "moe", label: "MoE", color: "#22d3ee", size: 20 });
graph.addNode({ id: "dense", label: "Dense", color: "#4dabf7", size: 18 });
graph.addNode({ id: "claude", label: "Claude", color: "#f97316", shape: "diamond", size: 20 });
graph.addNode({ id: "gpt", label: "GPT-5.2", color: "#ffd43b", size: 18 });

graph.addEdge({ from: "spine", to: "moe", color: "#22d3ee66", particles: true });
graph.addEdge({ from: "spine", to: "dense", color: "#4dabf766", particles: true });
graph.addEdge({ from: "spine", to: "claude", color: "#f9731666", particles: true });
graph.addEdge({ from: "spine", to: "gpt", color: "#ffd43b66", particles: true });

graphPanel.add(graph);
hud.registerPanel(graphPanel);

// --- Metrics panel (bound to routerStats) ---
const metricsPanel = routerDomain.createPanel({
  title: "Router Metrics (live)",
  position: { x: 500, y: 20 },
  size: { x: 260, y: 320 },
  clip: true,
});

metricsPanel.childLayout = "vertical";
metricsPanel.gap = 6;

// BoundMetric elements — auto-update when routerStats changes!
metricsPanel.add(new BoundMetric({
  label: "Requests",
  source: routerStats,
  field: "requests",
  color: "#4dabf7",
}));

metricsPanel.add(new BoundMetric({
  label: "Tokens In",
  source: routerStats,
  field: "tokensIn",
  format: (v: number) => v > 1000 ? `${(v / 1000).toFixed(1)}K` : String(v),
  color: "#22d3ee",
}));

metricsPanel.add(new BoundMetric({
  label: "Avg Latency",
  source: routerStats,
  field: "avgLatency",
  format: (v: number) => `${v}ms`,
  color: "#51cf66",
}));

metricsPanel.add(new BoundMetric({
  label: "Cache Hit",
  source: routerStats,
  field: "cacheHitRate",
  format: (v: number) => `${v}%`,
  color: "#ffd43b",
}));

hud.registerPanel(metricsPanel);

// ============================================================================
// DOMAIN 2: Infrastructure (health status)
// ============================================================================

const infraHealth = new MutableSource({
  spine: "healthy",
  moe: "healthy",
  dense: "degraded",
  claude: "healthy",
  nats: "healthy",
  marvin: "healthy",
}, "Infra Health", "infra");

const infraDomain = new DomainContext("infra", {
  style: { accent: "#51cf66" },
  sources: { health: infraHealth },
});

const healthPanel = infraDomain.createPanel({
  title: "Service Health (live)",
  position: { x: 780, y: 20 },
  size: { x: 240, y: 320 },
  clip: true,
});

healthPanel.childLayout = "vertical";
healthPanel.gap = 4;

// BoundStatusDot elements — color changes when health status changes
healthPanel.add(new BoundStatusDot({
  label: "Spine Classifier",
  source: infraHealth,
  field: "spine",
}));

healthPanel.add(new BoundStatusDot({
  label: "Qwen3.5 MoE",
  source: infraHealth,
  field: "moe",
}));

healthPanel.add(new BoundStatusDot({
  label: "Qwen3.5 Dense",
  source: infraHealth,
  field: "dense",
}));

healthPanel.add(new BoundStatusDot({
  label: "Claude CLI",
  source: infraHealth,
  field: "claude",
}));

healthPanel.add(new BoundStatusDot({
  label: "NATS JetStream",
  source: infraHealth,
  field: "nats",
}));

healthPanel.add(new BoundStatusDot({
  label: "Marvin Router",
  source: infraHealth,
  field: "marvin",
}));

hud.registerPanel(healthPanel);

// ============================================================================
// DOMAIN 3: Grid panel (from Session 2, style-inherited)
// ============================================================================

const gridPanel = hud.panel({
  title: "Backends (grid layout)",
  position: { x: 20, y: 360 },
  size: { x: 500, y: 200 },
  titleColor: "#f97316",
  clip: true,
});

gridPanel.childLayout = "grid";
gridPanel.gap = 6;

function createGridTile(label: string, value: string, color: string): SceneNode {
  const tile = new SceneNode({ size: { x: 100, y: 70 } });
  tile.style = { accent: color };
  tile.render = function(ctx: CanvasRenderingContext2D) {
    const s = this.resolvedStyle();
    const w = this.size.x;
    const h = this.size.y;
    ctx.fillStyle = s.accent + "0a";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = s.accent + "44";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.font = `bold 18px ${s.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 8;
    ctx.fillText(value, w / 2, h / 2 - 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = s.textDim;
    ctx.font = `bold 8px ${s.fontFamily}`;
    ctx.letterSpacing = "1px";
    ctx.fillText(label.toUpperCase(), w / 2, h / 2 + 14);
    ctx.textAlign = "left";
    ctx.letterSpacing = "0px";
  };
  return tile;
}

gridPanel.add(createGridTile("MoE", "83 t/s", "#22d3ee"));
gridPanel.add(createGridTile("Dense", "2 t/s", "#4dabf7"));
gridPanel.add(createGridTile("GPT-5.2", "45 t/s", "#ffd43b"));
gridPanel.add(createGridTile("Claude", "38 t/s", "#f97316"));
gridPanel.add(createGridTile("VRAM", "19 GB", "#a78bfa"));
gridPanel.add(createGridTile("Slots", "4/4", "#51cf66"));
gridPanel.add(createGridTile("Queue", "0", "#00d4aa"));
gridPanel.add(createGridTile("Errors", "0", "#ff6b6b"));

// ============================================================================
// SIMULATED LIVE DATA (updates every second)
// ============================================================================

let requestCount = 0;
let totalTokens = 0;

setInterval(() => {
  requestCount++;
  const tokens = Math.floor(Math.random() * 500) + 100;
  totalTokens += tokens;
  const latency = Math.floor(Math.random() * 200) + 200;

  // Update the reactive source — all bound elements update automatically!
  routerStats.update({
    requests: requestCount,
    tokensIn: totalTokens,
    avgLatency: latency,
    cacheHitRate: 85 + Math.floor(Math.random() * 10),
  });

  // Pulse a random graph node to show data flow
  const nodes = ["spine", "moe", "dense", "claude", "gpt"];
  const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
  graph.pulse(randomNode);

  // Occasionally toggle service health
  if (Math.random() < 0.1) {
    const services = ["spine", "moe", "dense", "claude", "nats", "marvin"] as const;
    const svc = services[Math.floor(Math.random() * services.length)];
    const statuses = ["healthy", "healthy", "healthy", "degraded"] as const;
    const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
    infraHealth.update({ [svc]: newStatus } as any);
  }
}, 1000);

// ============================================================================
// STATUS BAR
// ============================================================================

hud.statusBar.set("version", "Area42 v2 Session 3", { color: "#4dabf7" });
hud.statusBar.set("data", "Live data binding active", { color: "#51cf66" });
hud.statusBar.set("domains", "2 domains: routing, infra", { color: "#f97316" });
