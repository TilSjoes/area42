/**
 * Area42 Demo — Marvin Architecture Visualization
 *
 * Interactive force-directed graph of the Marvin routing infrastructure
 * with live particles, sparklines, metric displays, and real SSE events
 * from AgentSmith (with simulation fallback).
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import { TimeSeries } from "../charts/timeseries.js";
import { MetricDisplay } from "../panels/metric.js";
import { SSESource } from "../data/source.js";
import { NeonTheme } from "../themes/neon.js";

// --- Initialize HUD ---
const hud = new HUD("#hud", { theme: "neon" });

// --- Graph: Marvin Architecture ---
const graph = new Graph({
  id: "arch-graph",
  position: { x: 0, y: 0 },
  size: { x: hud.renderer.width, y: hud.renderer.height },
});
hud.scene.root.add(graph);

// Add nodes for each system component
graph.addNode({
  id: "spine",
  label: "Spine",
  color: "#f97316",
  glow: "#f97316",
  shape: "hexagon",
  size: 28,
  position: { x: 0, y: -80 },
  data: { role: "classifier" },
});

graph.addNode({
  id: "moe",
  label: "MoE (Qwen3.5)",
  color: "#22d3ee",
  glow: "#22d3ee",
  shape: "circle",
  size: 24,
  position: { x: -120, y: 40 },
  data: { role: "fast", tokPerSec: 83 },
});

graph.addNode({
  id: "dense",
  label: "Dense (Qwen3.5)",
  color: "#a78bfa",
  glow: "#a78bfa",
  shape: "circle",
  size: 24,
  position: { x: 120, y: 40 },
  data: { role: "quality", tokPerSec: 2 },
});

graph.addNode({
  id: "claude",
  label: "Claude",
  color: "#ff6b6b",
  glow: "#ff6b6b",
  shape: "diamond",
  size: 26,
  position: { x: -60, y: 150 },
  data: { role: "premium" },
});

graph.addNode({
  id: "gpt52",
  label: "GPT-5.2",
  color: "#51cf66",
  glow: "#51cf66",
  shape: "diamond",
  size: 22,
  position: { x: 60, y: 150 },
  data: { role: "copilot" },
});

graph.addNode({
  id: "nats",
  label: "NATS",
  color: "#ffd43b",
  glow: "#ffd43b",
  shape: "rect",
  size: 20,
  position: { x: 180, y: -60 },
  data: { role: "messaging" },
});

graph.addNode({
  id: "agentsmith",
  label: "AgentSmith",
  color: "#4dabf7",
  glow: "#4dabf7",
  shape: "hexagon",
  size: 26,
  position: { x: -180, y: -60 },
  data: { role: "orchestrator" },
});

// Add edges with particle flow
graph.addEdge({ from: "spine", to: "moe", color: "#22d3ee", particles: true, width: 1.5 });
graph.addEdge({ from: "spine", to: "dense", color: "#a78bfa", particles: true, width: 1.5 });
graph.addEdge({ from: "spine", to: "claude", color: "#ff6b6b", particles: true, width: 1.2 });
graph.addEdge({ from: "spine", to: "gpt52", color: "#51cf66", dashed: true, width: 1 });
graph.addEdge({ from: "agentsmith", to: "spine", color: "#f97316", particles: true, width: 1.5, label: "classify" });
graph.addEdge({ from: "agentsmith", to: "nats", color: "#ffd43b", particles: true, width: 1.2, label: "publish" });
graph.addEdge({ from: "nats", to: "spine", color: "#ffd43b", dashed: true, width: 0.8 });
graph.addEdge({ from: "moe", to: "nats", color: "#22d3ee66", width: 0.8 });
graph.addEdge({ from: "dense", to: "nats", color: "#a78bfa66", width: 0.8 });

// Load saved node positions (sticky between sessions)
const loaded = graph.loadPositions();
if (loaded) {
  console.log("Area42: Loaded saved node positions");
} else {
  console.log("Area42: Using physics layout (drag nodes to arrange, positions auto-save)");
}


// --- Cost Panel with TimeSeries ---
const costSeries = new TimeSeries({ color: NeonTheme.success, maxPoints: 60 });
const tokenSeries = new TimeSeries({ color: NeonTheme.accent2, maxPoints: 60 });

const costPanel = hud.panel({
  title: "Cost Tracker",
  position: { x: 20, y: 20 },
  size: { x: 280, y: 180 },
  titleColor: NeonTheme.success,
});

const costMetrics = new MetricDisplay({ columns: 2, valueSize: 20 });
costMetrics.set("Total Cost", "$0.00", NeonTheme.success);
costMetrics.set("Requests", 0);
costMetrics.set("Saved", "0%", NeonTheme.accent);
costMetrics.set("Local", "0 / 0");

costPanel.onContent((ctx, x, y, w, h) => {
  costMetrics.render(ctx, x, y, w, h * 0.55);
  // Sparkline in bottom portion
  costSeries.render(ctx, x, y + h * 0.6, w, h * 0.35);
});

// --- Router Panel with MetricDisplay ---
const routerPanel = hud.panel({
  title: "Router",
  position: { x: 20, y: 220 },
  size: { x: 280, y: 160 },
  titleColor: "#7b68ee",
});

const routerMetrics = new MetricDisplay({ columns: 3, valueSize: 18 });
routerMetrics.set("Simple", "0%", NeonTheme.success);
routerMetrics.set("Medium", "0%", NeonTheme.warning);
routerMetrics.set("Complex", "0%", NeonTheme.danger);

routerPanel.onContent((ctx, x, y, w, h) => {
  routerMetrics.render(ctx, x, y, w, h * 0.5);
  tokenSeries.render(ctx, x, y + h * 0.55, w, h * 0.4);
});

// --- Spine Panel ---
const spinePanel = hud.panel({
  title: "Spine Classifier",
  position: { x: 20, y: 400 },
  size: { x: 280, y: 120 },
  titleColor: "#f97316",
});

const spineMetrics = new MetricDisplay({ columns: 2, valueSize: 16 });
spineMetrics.set("Model", "Qwen3.5-0.8B");
spineMetrics.set("Latency", "0ms", "#f97316");
spineMetrics.set("Accuracy", "94.2%", NeonTheme.success);
spineMetrics.set("Training", "1,528");

spinePanel.onContent((ctx, x, y, w, h) => {
  spineMetrics.render(ctx, x, y, w, h);
});

// --- Shared metrics state ---
let requestCount = 0;
let totalCost = 0;
let simpleCount = 0;
let mediumCount = 0;
let complexCount = 0;

/** Backend name to graph node ID mapping */
const backendToNode: Record<string, string> = {
  qwen35_moe: "moe",
  qwen35_dense: "dense",
  claude_cli: "claude",
  gpt52: "gpt52",
};

/** Tier to color mapping */
const tierColor: Record<string, string> = {
  simple: NeonTheme.success,    // green
  medium: NeonTheme.warning,    // yellow
  complex: NeonTheme.danger,    // red
};

/** Tier to approximate cost per request */
const tierCosts: Record<string, number> = { simple: 0.001, medium: 0.008, complex: 0.035 };

/** Process a routing event (from SSE or simulation) */
function handleRouteEvent(tier: string, backend: string, totalMs?: number, tokensOut?: number, costUsd?: number) {
  requestCount++;
  const cost = costUsd ?? tierCosts[tier] * (0.5 + Math.random());
  totalCost += cost;

  if (tier === "simple") simpleCount++;
  else if (tier === "medium") mediumCount++;
  else complexCount++;

  // Update cost panel metrics
  costMetrics.set("Total Cost", "$" + totalCost.toFixed(2), NeonTheme.success);
  costMetrics.set("Requests", requestCount);
  const savedPct = Math.round(((simpleCount + mediumCount * 0.5) / requestCount) * 100);
  costMetrics.set("Saved", savedPct + "%", NeonTheme.accent);
  costMetrics.set("Local", simpleCount + mediumCount + " / " + requestCount);

  // Update router panel tier percentages
  const simplePct = Math.round((simpleCount / requestCount) * 100);
  const mediumPct = Math.round((mediumCount / requestCount) * 100);
  const complexPct = Math.round((complexCount / requestCount) * 100);
  routerMetrics.set("Simple", simplePct + "%", NeonTheme.success);
  routerMetrics.set("Medium", mediumPct + "%", NeonTheme.warning);
  routerMetrics.set("Complex", complexPct + "%", NeonTheme.danger);

  // Push to time series
  costSeries.push(totalCost);
  tokenSeries.push(tokensOut ?? Math.round(Math.random() * 8000 + 500));

  // Update spine latency
  spineMetrics.set("Latency", (totalMs ?? Math.round(200 + Math.random() * 300)) + "ms", "#f97316");

  // Resolve the target node
  const targetNodeId = backendToNode[backend] ?? "moe";

  // 1) Spawn particle from AgentSmith to Spine (cyan, classification)
  graph.particle("agentsmith", "spine", { color: "#22d3ee", speed: 0.6 });
  graph.pulse("spine", "#f97316");

  // 2) After a short delay, spawn particle from Spine to target model (color by tier)
  const color = tierColor[tier] ?? "#ffffff";
  setTimeout(() => {
    graph.particle("spine", targetNodeId, { color, speed: 0.6 });
    graph.pulse(targetNodeId);
  }, 300);

  // NATS gets a pulse occasionally
  if (Math.random() < 0.3) {
    setTimeout(() => graph.pulse("nats", "#ffd43b"), 500);
  }
}

// --- Simulation fallback ---
const tierWeights = [0.15, 0.55, 0.30];
const tierTargets: Record<string, string[]> = {
  simple: ["qwen35_moe"],
  medium: ["qwen35_moe", "qwen35_dense"],
  complex: ["claude_cli", "gpt52"],
};

function pickTier(): "simple" | "medium" | "complex" {
  const r = Math.random();
  if (r < tierWeights[0]) return "simple";
  if (r < tierWeights[0] + tierWeights[1]) return "medium";
  return "complex";
}

let simulationRunning = false;
let simulationTimer: ReturnType<typeof setTimeout> | null = null;

function startSimulation() {
  if (simulationRunning) return;
  simulationRunning = true;
  console.log("Area42: Starting simulation fallback (no SSE events)");
  scheduleSimEvent();
}

function stopSimulation() {
  simulationRunning = false;
  if (simulationTimer) {
    clearTimeout(simulationTimer);
    simulationTimer = null;
  }
}

function scheduleSimEvent() {
  if (!simulationRunning) return;
  const delay = 1000 + Math.random() * 2000;
  simulationTimer = setTimeout(() => {
    const tier = pickTier();
    const targets = tierTargets[tier];
    const backend = targets[Math.floor(Math.random() * targets.length)];
    handleRouteEvent(tier, backend);
    scheduleSimEvent();
  }, delay);
}

// --- Real SSE connection to AgentSmith ---
let lastEventTime = 0;
let sseConnected = false;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

const sse = new SSESource("http://10.131.1.183:8042/api/events");

sse.on("route_event", (data: any) => {
  lastEventTime = Date.now();
  if (!sseConnected) {
    sseConnected = true;
    stopSimulation();
    console.log("Area42: Receiving real SSE events from AgentSmith");
  }
  const tier = data.tier ?? "medium";
  const backend = data.backend ?? "qwen35_moe";
  handleRouteEvent(tier, backend, data.total_ms, data.tokens_out, data.cost_usd);
});

sse.on("mission_event", (_data: any) => {
  lastEventTime = Date.now();
  graph.pulse("agentsmith", "#4dabf7");
});

// keepalive: just update the timestamp
sse.on("keepalive", () => {
  lastEventTime = Date.now();
});

// Generic message handler (SSESource dispatches by data.type)
sse.on("message", (data: any) => {
  if (data.type === "route_event" || data.type === "mission_event" || data.type === "keepalive") {
    return; // Already handled by specific handlers above
  }
  lastEventTime = Date.now();
});

sse.on("error", () => {
  // SSE error: will auto-reconnect, but start simulation if no events yet
  if (!simulationRunning && !sseConnected) {
    startSimulation();
  }
});

// Attempt SSE connection
sse.connect().then(() => {
  lastEventTime = Date.now();
  console.log("Area42: SSE connected to AgentSmith");

  // Watchdog: if no events for 5s, fall back to simulation
  fallbackTimer = setInterval(() => {
    if (Date.now() - lastEventTime > 5000 && !simulationRunning) {
      console.log("Area42: No SSE events for 5s, starting simulation fallback");
      sseConnected = false;
      startSimulation();
    }
    // If real events resume, stop simulation
    if (sseConnected && simulationRunning) {
      stopSimulation();
    }
  }, 2000);
}).catch(() => {
  console.log("Area42: SSE connection failed, using simulation");
  startSimulation();
});

// --- Drill-down state: track which nodes are expanded ---
const expandedNodes = new Set<string>();

// Export for HUD double-click handler
(window as any).__area42 = { graph, expandedNodes };

console.log(
  "%c Area42 %c Marvin Architecture Visualization ",
  "background: #0a0e17; color: #00d4aa; font-weight: bold; padding: 4px 8px;",
  "background: #131a2b; color: #c8d6e5; padding: 4px 8px;",
);
console.log("  Drag panels by their title bars. Double-click to collapse.");
console.log("  Double-click graph nodes to expand/collapse details.");
console.log("  Live SSE from AgentSmith with simulation fallback.");
