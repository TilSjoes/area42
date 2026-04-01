/**
 * Area42 Demo — Marvin Architecture Visualization
 *
 * Interactive force-directed graph of the Marvin routing infrastructure
 * with live particles, sparklines, metric displays, and real SSE events
 * from AgentSmith (with simulation fallback).
 *
 * Supports multiple detail panels, scroll, drag, and close.
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import type { GraphEdge, EdgeDetail } from "../graph/graph.js";
import { DetailPanel } from "../panels/detail.js";
import type { NodeDetail } from "../panels/detail.js";
import { TimeSeries } from "../charts/timeseries.js";
import { MetricDisplay } from "../panels/metric.js";
import { SSESource } from "../data/source.js";
import { NeonTheme } from "../themes/neon.js";
import { Panel3D } from "../panels/panel3d.js";
import { Table } from "../panels/table.js";
import { MiniGraph } from "../panels/minigraph.js";

// --- Initialize HUD ---
const hud = new HUD("#hud", { theme: "neon" });

// --- Multiple Detail Panels (click-to-inspect) ---
const MAX_DETAIL_PANELS = 5;
const detailPanels: Map<string, DetailPanel> = new Map();
/** Track creation order for LRU eviction */
const detailPanelOrder: string[] = [];
/** Cascade offset counter */
let cascadeIndex = 0;

/** Get a screen position near the clicked graph node, cascaded to avoid overlap */
function detailPositionForNode(nodeId: string): { x: number; y: number } {
  // Try to find the graph node position
  const graphNode = graph.getNode(nodeId);
  const canvasW = hud.renderer.width;
  const canvasH = hud.renderer.height;

  let baseX = canvasW - 360;
  let baseY = 40;

  if (graphNode) {
    // Position to the right of the node, offset by cascade
    // Graph is centered — node positions are relative to graph center
    const graphCenterX = canvasW / 2;
    const graphCenterY = canvasH / 2;
    baseX = graphCenterX + graphNode.x + 40;
    baseY = graphCenterY + graphNode.y - 60;
  }

  // Apply cascade offset
  const offset = cascadeIndex * 30;
  cascadeIndex = (cascadeIndex + 1) % 8;

  // Clamp to canvas bounds
  const x = Math.max(10, Math.min(canvasW - 340, baseX + offset));
  const y = Math.max(10, Math.min(canvasH - 200, baseY + offset));

  return { x, y };
}

/** Open or toggle a detail panel for a node */
function toggleDetailPanel(nodeId: string, detail: NodeDetail) {
  const existing = detailPanels.get(nodeId);
  if (existing) {
    // Toggle: if visible, hide and remove; if hidden, show
    if (existing.visible) {
      hud.unregisterPanel(existing.id);
      detailPanels.delete(nodeId);
      const idx = detailPanelOrder.indexOf(nodeId);
      if (idx >= 0) detailPanelOrder.splice(idx, 1);
      return;
    }
  }

  // Evict oldest if at limit
  while (detailPanels.size >= MAX_DETAIL_PANELS && detailPanelOrder.length > 0) {
    const oldestId = detailPanelOrder.shift()!;
    const oldPanel = detailPanels.get(oldestId);
    if (oldPanel) {
      hud.unregisterPanel(oldPanel.id);
      detailPanels.delete(oldestId);
    }
  }

  // Create new panel
  const pos = detailPositionForNode(nodeId);
  const panel = new DetailPanel(nodeId, pos);
  panel.show(detail);

  // Set close callback to remove from our tracking
  panel.onClose(() => {
    hud.unregisterPanel(panel.id);
    detailPanels.delete(nodeId);
    const idx = detailPanelOrder.indexOf(nodeId);
    if (idx >= 0) detailPanelOrder.splice(idx, 1);
  });

  // Register with HUD for drag/resize/scroll
  hud.registerPanel(panel);
  detailPanels.set(nodeId, panel);
  detailPanelOrder.push(nodeId);
}

// --- Table: AgentSmith recent missions ---
const missionTable = new Table([
  { key: "mission", label: "Mission", width: 0.35 },
  { key: "status", label: "Status", width: 0.2 },
  { key: "duration", label: "Duration", width: 0.2, align: "right" },
  { key: "worker", label: "Worker", width: 0.25 },
]);
missionTable.setData([
  { mission: "Deploy Suits v2.1", status: "Done", duration: "4m 12s", worker: "Trillian", _badge: "OK", _badgeColor: NeonTheme.success },
  { mission: "Scan governance", status: "Done", duration: "1m 38s", worker: "Arthur", _badge: "OK", _badgeColor: NeonTheme.success },
  { mission: "Review PR #247", status: "Running", duration: "2m 05s", worker: "Trillian", _badge: "ACTIVE", _badgeColor: NeonTheme.warning },
  { mission: "Train Spine v3", status: "Queued", duration: "-", worker: "Arthur", _badge: "QUEUED", _badgeColor: NeonTheme.textDim },
  { mission: "Update CLAUDE.md", status: "Done", duration: "0m 42s", worker: "Arthur", _badge: "OK", _badgeColor: NeonTheme.success },
  { mission: "AML flag check", status: "Failed", duration: "3m 11s", worker: "Ants", _badge: "FAIL", _badgeColor: NeonTheme.danger },
  { mission: "Build BoringBank", status: "Done", duration: "12m 04s", worker: "Trillian", _badge: "OK", _badgeColor: NeonTheme.success },
  { mission: "Memory sync", status: "Done", duration: "0m 18s", worker: "Arthur", _badge: "OK", _badgeColor: NeonTheme.success },
]);

// --- MiniGraph: NATS message flow ---
const natsFlow = new MiniGraph(
  [
    { id: "pub", label: "Publisher", status: "completed" },
    { id: "nats-core", label: "NATS", status: "running" },
    { id: "consumer", label: "Consumer", status: "completed" },
    { id: "handler", label: "Handler", status: "running" },
  ],
  [
    { from: "pub", to: "nats-core" },
    { from: "nats-core", to: "consumer" },
    { from: "consumer", to: "handler" },
  ],
);

// --- Table: Spine classification examples ---
const spineClassTable = new Table([
  { key: "input", label: "Input", width: 0.35 },
  { key: "tier", label: "Tier", width: 0.2 },
  { key: "confidence", label: "Conf", width: 0.2, align: "right" },
  { key: "model", label: "Model", width: 0.25 },
]);
spineClassTable.setData([
  { input: "What time is it?", tier: "simple", confidence: "0.97", model: "MoE", _badge: "SIMPLE", _badgeColor: NeonTheme.success },
  { input: "Explain transformers", tier: "medium", confidence: "0.84", model: "MoE", _badge: "MEDIUM", _badgeColor: NeonTheme.warning },
  { input: "Refactor auth module", tier: "complex", confidence: "0.91", model: "Dense", _badge: "COMPLEX", _badgeColor: NeonTheme.danger },
  { input: "List running services", tier: "simple", confidence: "0.95", model: "MoE", _badge: "SIMPLE", _badgeColor: NeonTheme.success },
  { input: "Design AML pipeline", tier: "complex", confidence: "0.88", model: "Claude", _badge: "COMPLEX", _badgeColor: NeonTheme.danger },
  { input: "Translate to Norwegian", tier: "medium", confidence: "0.79", model: "Dense", _badge: "MEDIUM", _badgeColor: NeonTheme.warning },
]);

// Node detail definitions
const nodeDetails: Record<string, NodeDetail> = {
  spine: {
    nodeId: "spine", title: "Spine Classifier", subtitle: "Independent routing intelligence",
    color: "#f97316",
    sections: [
      { title: "Model", fields: [
        { label: "Base", value: "Qwen3.5-0.8B", color: "#f97316" },
        { label: "Type", value: "Fine-tuned LoRA", color: "#c8d6e5" },
        { label: "VRAM", value: "1.5 GB", color: "#c8d6e5" },
        { label: "Port", value: "8083", color: "#6b7b8d" },
      ]},
      { title: "Performance", fields: [
        { label: "Accuracy", value: 94, type: "bar", color: "#51cf66" },
        { label: "Latency", value: "<300ms", color: "#f97316" },
        { label: "Training pairs", value: "1,528", color: "#c8d6e5" },
      ]},
      { title: "Routing", fields: [
        { label: "Simple", value: "MoE", type: "list", color: "#51cf66" },
        { label: "Medium", value: "MoE \u2192 Dense", type: "list", color: "#ffd43b" },
        { label: "Complex", value: "Dense \u2192 Claude", type: "list", color: "#ff6b6b" },
      ]},
    ],
    actions: [
      { label: "Retrain", color: "#f97316", callback: () => console.log("retrain") },
      { label: "View logs", color: "#4dabf7", callback: () => console.log("logs") },
    ],
  },
  moe: {
    nodeId: "moe", title: "Qwen3.5 MoE 35B-A3B", subtitle: "Fast concurrent workhorse",
    color: "#22d3ee",
    sections: [
      { title: "Model", fields: [
        { label: "Parameters", value: "35B (3B active)", color: "#22d3ee" },
        { label: "Speed", value: "83 tok/s", color: "#51cf66" },
        { label: "VRAM", value: "22 GB", color: "#c8d6e5" },
        { label: "Parallel", value: "4 slots", color: "#c8d6e5" },
      ]},
      { title: "Routing", fields: [
        { label: "Tier", value: "Simple + Medium", type: "badge", color: "#51cf66" },
        { label: "Cost", value: "FREE (local)", type: "badge", color: "#51cf66" },
      ]},
    ],
  },
  dense: {
    nodeId: "dense", title: "Qwen3.5 Dense 27B", subtitle: "Quality reasoning engine",
    color: "#a78bfa",
    sections: [
      { title: "Model", fields: [
        { label: "Parameters", value: "27B (all active)", color: "#a78bfa" },
        { label: "Speed", value: "2 tok/s", color: "#ffd43b" },
        { label: "VRAM", value: "12 GB (40 layers GPU)", color: "#c8d6e5" },
        { label: "Quality", value: "SWE-bench 72.4%", color: "#51cf66" },
      ]},
      { title: "Routing", fields: [
        { label: "Tier", value: "Complex (quality)", type: "badge", color: "#a78bfa" },
        { label: "Cost", value: "FREE (local)", type: "badge", color: "#51cf66" },
      ]},
    ],
  },
  claude: {
    nodeId: "claude", title: "Claude CLI (Sonnet)", subtitle: "Anthropic Max Pro subscription",
    color: "#ff6b6b",
    sections: [
      { title: "Access", fields: [
        { label: "Model", value: "claude-sonnet-4-5", color: "#ff6b6b" },
        { label: "Plan", value: "Max Pro", type: "badge", color: "#ff6b6b" },
        { label: "Context", value: "200K tokens", color: "#c8d6e5" },
      ]},
      { title: "Usage", fields: [
        { label: "Role", value: "Escalation + Planning", color: "#ffd43b" },
        { label: "Cost", value: "Subscription", type: "badge", color: "#ff6b6b" },
      ]},
    ],
  },
  gpt52: {
    nodeId: "gpt52", title: "GPT-5.2 (Copilot)", subtitle: "GitHub Copilot subscription",
    color: "#51cf66",
    sections: [
      { title: "Access", fields: [
        { label: "Provider", value: "GitHub Copilot", color: "#51cf66" },
        { label: "Tier", value: "Medium fallback", type: "badge", color: "#ffd43b" },
        { label: "Context", value: "128K tokens", color: "#c8d6e5" },
      ]},
    ],
  },
  nats: {
    nodeId: "nats", title: "NATS JetStream", subtitle: "Inter-service messaging backbone",
    color: "#ffd43b",
    sections: [
      { title: "Server", fields: [
        { label: "Version", value: "v2.10.24", color: "#ffd43b" },
        { label: "Port", value: "4222", color: "#6b7b8d" },
      ]},
      { title: "Streams", fields: [
        { label: "ROUTING", value: "7d retention", type: "list", color: "#51cf66" },
        { label: "MISSIONS", value: "30d retention", type: "list", color: "#ffd43b" },
        { label: "FEEDBACK", value: "30d work queue", type: "list", color: "#ff6b6b" },
        { label: "DREAMS", value: "90d retention", type: "list", color: "#a78bfa" },
      ]},
    ],
    _miniGraphRenderer: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      natsFlow.render(ctx, x, y, w, h);
    },
  },
  agentsmith: {
    nodeId: "agentsmith", title: "AgentSmith", subtitle: "Mission orchestrator",
    color: "#00d4aa",
    sections: [
      { title: "Dashboard", fields: [
        { label: "Port", value: "8042", color: "#6b7b8d" },
        { label: "Workers", value: "Arthur, Trillian, Ants", color: "#00d4aa" },
      ]},
      { title: "Capabilities", fields: [
        { label: "Missions", value: "Plan + dispatch + verify", type: "list", color: "#c8d6e5" },
        { label: "Governance", value: "Scan + fix + audit", type: "list", color: "#c8d6e5" },
        { label: "Dreams", value: "Babelfish introspection", type: "list", color: "#a78bfa" },
      ]},
    ],
    actions: [
      { label: "Launch mission", color: "#00d4aa", callback: () => console.log("launch") },
      { label: "Scan all", color: "#51cf66", callback: () => console.log("scan") },
    ],
    _tableRenderer: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      missionTable.render(ctx, x, y, w, h);
    },
  },
};

// Wire single-click on graph nodes to show detail panel
let nodeClickStart: { x: number; y: number; time: number } | null = null;
const canvas = hud.renderer["canvas"] as HTMLCanvasElement;

canvas.addEventListener("mousedown", (e: MouseEvent) => {
  const rect = canvas.parentElement!.getBoundingClientRect();
  nodeClickStart = { x: e.clientX - rect.left, y: e.clientY - rect.top, time: Date.now() };
});

canvas.addEventListener("mouseup", (e: MouseEvent) => {
  if (!nodeClickStart) return;
  const rect = canvas.parentElement!.getBoundingClientRect();
  const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const dx = point.x - nodeClickStart.x;
  const dy = point.y - nodeClickStart.y;
  const dt = Date.now() - nodeClickStart.time;
  nodeClickStart = null;

  // Only trigger if it was a click (not a drag)
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5 || dt > 300) return;

  const hitNode = graph.findNodeAt(point.x, point.y);
  if (hitNode && nodeDetails[hitNode.id]) {
    toggleDetailPanel(hitNode.id, nodeDetails[hitNode.id]);
  } else {
    // Check for edge click (only if no node was hit)
    const hitEdge = graph.findEdgeAt(point.x, point.y);
    if (hitEdge && hitEdge.detail) {
      handleEdgeClick(hitEdge, point);
    }
  }
  // Clicking empty space no longer closes panels — user must click X or click the same node
});


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
  mass: 2.5,
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
  mass: 1.2,
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
  mass: 0.8,
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
  mass: 1.5,
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
  mass: 2.0,
  color: "#4dabf7",
  glow: "#4dabf7",
  shape: "hexagon",
  size: 26,
  position: { x: -180, y: -60 },
  data: { role: "orchestrator" },
});

// Add edges with particle flow and detail data
graph.addEdge({
  from: "spine", to: "moe", color: "#22d3ee", particles: true, width: 1.5,
  detail: {
    title: "Spine \u2192 MoE (Simple/Medium)",
    subtitle: "Primary routing path",
    color: "#22d3ee",
    fields: [
      { label: "Requests", value: "1,247", color: "#c8d6e5" },
      { label: "Avg latency", value: "245ms", color: "#51cf66" },
      { label: "Tier", value: "Simple + Medium", color: "#51cf66" },
      { label: "Cost", value: "FREE", color: "#51cf66" },
      { label: "Throughput", value: "83 tok/s", color: "#22d3ee" },
    ],
  },
});
graph.addEdge({
  from: "spine", to: "dense", color: "#a78bfa", particles: true, width: 1.5,
  detail: {
    title: "Spine \u2192 Dense (Complex)",
    subtitle: "Quality reasoning path",
    color: "#a78bfa",
    fields: [
      { label: "Requests", value: "312", color: "#c8d6e5" },
      { label: "Avg latency", value: "4.2s", color: "#ffd43b" },
      { label: "Tier", value: "Complex", color: "#a78bfa" },
      { label: "Cost", value: "FREE", color: "#51cf66" },
      { label: "Quality", value: "SWE-bench 72.4%", color: "#a78bfa" },
    ],
  },
});
graph.addEdge({
  from: "spine", to: "claude", color: "#ff6b6b", particles: true, width: 1.2,
  detail: {
    title: "Spine \u2192 Claude (Escalation)",
    subtitle: "Premium escalation path",
    color: "#ff6b6b",
    fields: [
      { label: "Requests", value: "47", color: "#c8d6e5" },
      { label: "Avg latency", value: "1.8s", color: "#ffd43b" },
      { label: "Tier", value: "Complex (escalated)", color: "#ff6b6b" },
      { label: "Cost", value: "Subscription", color: "#ff6b6b" },
      { label: "Model", value: "claude-sonnet-4-5", color: "#ff6b6b" },
    ],
  },
});
graph.addEdge({
  from: "spine", to: "gpt52", color: "#51cf66", dashed: true, width: 1,
  detail: {
    title: "Spine \u2192 GPT-5.2 (Fallback)",
    subtitle: "GitHub Copilot fallback path",
    color: "#51cf66",
    fields: [
      { label: "Requests", value: "23", color: "#c8d6e5" },
      { label: "Avg latency", value: "2.1s", color: "#ffd43b" },
      { label: "Tier", value: "Medium fallback", color: "#51cf66" },
      { label: "Cost", value: "Copilot sub", color: "#51cf66" },
    ],
  },
});
graph.addEdge({
  from: "agentsmith", to: "spine", color: "#f97316", particles: true, width: 1.5, label: "classify",
  detail: {
    title: "AgentSmith \u2192 Spine",
    subtitle: "Mission classification requests",
    color: "#f97316",
    fields: [
      { label: "Requests", value: "1,629", color: "#c8d6e5" },
      { label: "Avg latency", value: "180ms", color: "#51cf66" },
      { label: "Type", value: "Classification", color: "#f97316" },
      { label: "Accuracy", value: "94.2%", color: "#51cf66" },
    ],
  },
});
graph.addEdge({
  from: "agentsmith", to: "nats", color: "#ffd43b", particles: true, width: 1.2, label: "publish",
  detail: {
    title: "AgentSmith \u2192 NATS",
    subtitle: "Mission & routing event stream",
    color: "#ffd43b",
    fields: [
      { label: "Messages/min", value: "34", color: "#c8d6e5" },
      { label: "Streams", value: "ROUTING, MISSIONS", color: "#ffd43b" },
      { label: "Type", value: "JetStream publish", color: "#ffd43b" },
    ],
  },
});
graph.addEdge({
  from: "nats", to: "spine", color: "#ffd43b", dashed: true, width: 0.8,
  detail: {
    title: "NATS \u2192 Spine",
    subtitle: "Feedback loop for retraining",
    color: "#ffd43b",
    fields: [
      { label: "Stream", value: "FEEDBACK", color: "#ffd43b" },
      { label: "Messages", value: "892", color: "#c8d6e5" },
      { label: "Type", value: "Work queue", color: "#ffd43b" },
    ],
  },
});
graph.addEdge({
  from: "moe", to: "nats", color: "#22d3ee66", width: 0.8,
  detail: {
    title: "MoE \u2192 NATS",
    subtitle: "Response telemetry",
    color: "#22d3ee",
    fields: [
      { label: "Events", value: "1,247", color: "#c8d6e5" },
      { label: "Stream", value: "ROUTING", color: "#ffd43b" },
      { label: "Data", value: "Latency, tokens, tier", color: "#22d3ee" },
    ],
  },
});
graph.addEdge({
  from: "dense", to: "nats", color: "#a78bfa66", width: 0.8,
  detail: {
    title: "Dense \u2192 NATS",
    subtitle: "Response telemetry",
    color: "#a78bfa",
    fields: [
      { label: "Events", value: "312", color: "#c8d6e5" },
      { label: "Stream", value: "ROUTING", color: "#ffd43b" },
      { label: "Data", value: "Latency, tokens, quality", color: "#a78bfa" },
    ],
  },
});


// --- Dynamic drill-down callback ---
// This enables infinite depth: each node type resolves its children dynamically.
// In production, this would call AgentSmith/BoringBank APIs.
// For now, it uses static data as a demo — but the pattern is async-ready.
graph.onExpand(async (nodeId, node) => {
  // Example: could fetch from API
  // const resp = await fetch(\`/api/node/\${nodeId}/children\`);
  // return resp.json();

  // Static demo data for nodes that don't have hardcoded expand
  const dynamicChildren: Record<string, any[]> = {
    "nats": [
      { id: "nats-routing", label: "ROUTING", color: "#51cf66", shape: "rect" as const, size: 12 },
      { id: "nats-missions", label: "MISSIONS", color: "#ffd43b", shape: "rect" as const, size: 12 },
      { id: "nats-feedback", label: "FEEDBACK", color: "#ff6b6b", shape: "rect" as const, size: 12 },
      { id: "nats-dreams", label: "DREAMS", color: "#a78bfa", shape: "rect" as const, size: 12 },
    ],
    "moe": [
      { id: "moe-slot1", label: "Slot 1", color: "#22d3ee", shape: "circle" as const, size: 10 },
      { id: "moe-slot2", label: "Slot 2", color: "#22d3ee", shape: "circle" as const, size: 10 },
      { id: "moe-slot3", label: "Slot 3", color: "#22d3ee", shape: "circle" as const, size: 10 },
      { id: "moe-slot4", label: "Slot 4", color: "#22d3ee", shape: "circle" as const, size: 10 },
    ],
    "spine": [
      { id: "spine-train", label: "1528 pairs", color: "#f97316", shape: "diamond" as const, size: 10 },
      { id: "spine-acc", label: "94.2% acc", color: "#51cf66", shape: "diamond" as const, size: 10 },
      { id: "spine-lat", label: "<300ms", color: "#ffd43b", shape: "diamond" as const, size: 10 },
    ],
    "dense": [
      { id: "dense-slot1", label: "Slot 1", color: "#a78bfa", shape: "circle" as const, size: 10 },
      { id: "dense-slot2", label: "Slot 2", color: "#a78bfa", shape: "circle" as const, size: 10 },
    ],
  };

  return dynamicChildren[nodeId] || null;
});

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
  simple: NeonTheme.success,
  medium: NeonTheme.warning,
  complex: NeonTheme.danger,
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

  costMetrics.set("Total Cost", "$" + totalCost.toFixed(2), NeonTheme.success);
  costMetrics.set("Requests", requestCount);
  const savedPct = Math.round(((simpleCount + mediumCount * 0.5) / requestCount) * 100);
  costMetrics.set("Saved", savedPct + "%", NeonTheme.accent);
  costMetrics.set("Local", simpleCount + mediumCount + " / " + requestCount);

  const simplePct = Math.round((simpleCount / requestCount) * 100);
  const mediumPct = Math.round((mediumCount / requestCount) * 100);
  const complexPct = Math.round((complexCount / requestCount) * 100);
  routerMetrics.set("Simple", simplePct + "%", NeonTheme.success);
  routerMetrics.set("Medium", mediumPct + "%", NeonTheme.warning);
  routerMetrics.set("Complex", complexPct + "%", NeonTheme.danger);

  costSeries.push(totalCost);
  tokenSeries.push(tokensOut ?? Math.round(Math.random() * 8000 + 500));

  spineMetrics.set("Latency", (totalMs ?? Math.round(200 + Math.random() * 300)) + "ms", "#f97316");

  const targetNodeId = backendToNode[backend] ?? "moe";

  graph.particle("agentsmith", "spine", { color: "#22d3ee", speed: 0.6 });
  graph.pulse("spine", "#f97316");

  const color = tierColor[tier] ?? "#ffffff";
  setTimeout(() => {
    graph.particle("spine", targetNodeId, { color, speed: 0.6 });
    graph.pulse(targetNodeId);
  }, 300);

  if (Math.random() < 0.3) {
    setTimeout(() => graph.pulse("nats", "#ffd43b"), 500);
  }
}


// --- 3D Panel: rotating cube ---
const cube3d = new Panel3D({
  title: "3D VIEW",
  position: { x: 20, y: 400 },
  size: { x: 220, y: 200 },
  glass: true,
  color: "rgba(123, 104, 238, 0.15)",
  titleColor: "#a78bfa",
  compact: true,
  setup: (scene, camera, THREE) => {
    // Create a wireframe cube with neon edges
    const geometry = new (THREE as any).BoxGeometry(1.2, 1.2, 1.2);
    const edges = new (THREE as any).EdgesGeometry(geometry);
    const material = new (THREE as any).LineBasicMaterial({ color: 0x7b68ee, linewidth: 2 });
    const wireframe = new (THREE as any).LineSegments(edges, material);
    wireframe.name = "cube";
    scene.add(wireframe);

    // Add a smaller inner cube
    const innerGeo = new (THREE as any).BoxGeometry(0.6, 0.6, 0.6);
    const innerEdges = new (THREE as any).EdgesGeometry(innerGeo);
    const innerMat = new (THREE as any).LineBasicMaterial({ color: 0x22d3ee, linewidth: 1 });
    const innerWire = new (THREE as any).LineSegments(innerEdges, innerMat);
    innerWire.name = "inner";
    scene.add(innerWire);

    camera.position.set(0, 0, 3);
  },
  animate: (scene, _camera, dt) => {
    const cube = scene.getObjectByName("cube");
    const inner = scene.getObjectByName("inner");
    if (cube) {
      cube.rotation.x += dt * 0.5;
      cube.rotation.y += dt * 0.7;
    }
    if (inner) {
      inner.rotation.x -= dt * 0.8;
      inner.rotation.z += dt * 0.6;
    }
  },
});
hud.scene.root.add(cube3d);

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

sse.on("keepalive", () => {
  lastEventTime = Date.now();
  sseConnected = true;
});

sse.on("message", (data: any) => {
  if (data.type === "route_event" || data.type === "mission_event" || data.type === "keepalive") {
    return;
  }
  lastEventTime = Date.now();
});

sse.on("error", () => {
  if (!simulationRunning && !sseConnected) {
    startSimulation();
  }
});

sse.connect().then(() => {
  lastEventTime = Date.now();
  console.log("Area42: SSE connected to AgentSmith");

  fallbackTimer = setInterval(() => {
    if (Date.now() - lastEventTime > 20000 && !simulationRunning) {
      console.log("Area42: No SSE events for 20s, starting simulation fallback");
      sseConnected = false;
      startSimulation();
    }
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

/** Open a detail panel for an edge click */
function handleEdgeClick(edge: GraphEdge, point: { x: number; y: number }) {
  if (!edge.detail) return;
  const panelId = "edge-" + edge.from + "-" + edge.to;

  // Check if already open - toggle it off
  const existing = detailPanels.get(panelId);
  if (existing) {
    hud.unregisterPanel(existing.id);
    detailPanels.delete(panelId);
    const idx = detailPanelOrder.indexOf(panelId);
    if (idx >= 0) detailPanelOrder.splice(idx, 1);
    return;
  }

  // Evict oldest if at limit
  while (detailPanels.size >= MAX_DETAIL_PANELS && detailPanelOrder.length > 0) {
    const oldestId = detailPanelOrder.shift()!;
    const oldPanel = detailPanels.get(oldestId);
    if (oldPanel) {
      hud.unregisterPanel(oldPanel.id);
      detailPanels.delete(oldestId);
    }
  }

  // Build NodeDetail from EdgeDetail for the DetailPanel
  const ed = edge.detail;
  const nodeDetail: NodeDetail = {
    nodeId: panelId,
    title: ed.title,
    subtitle: ed.subtitle,
    color: ed.color,
    sections: [
      {
        title: "Connection",
        fields: ed.fields.map((f) => ({
          label: f.label,
          value: f.value,
          color: f.color,
        })),
      },
    ],
  };

  // Position near click point
  const canvasW = hud.renderer.width;
  const canvasH = hud.renderer.height;
  const pos = {
    x: Math.max(10, Math.min(canvasW - 340, point.x + 20)),
    y: Math.max(10, Math.min(canvasH - 200, point.y - 60)),
  };

  const panel = new DetailPanel(panelId, pos);
  panel.show(nodeDetail);
  panel.onClose(() => {
    hud.unregisterPanel(panel.id);
    detailPanels.delete(panelId);
    const idx = detailPanelOrder.indexOf(panelId);
    if (idx >= 0) detailPanelOrder.splice(idx, 1);
  });
  hud.registerPanel(panel);
  detailPanels.set(panelId, panel);
  detailPanelOrder.push(panelId);
}

// --- Status Bar ---
hud.statusBar.set('brand', 'Area42 v0.1.0', { position: 'left', color: '#00d4aa' });
hud.statusBar.set('stats', 'Nodes: 7 | Edges: 12 | FPS: 60', { position: 'right' });

// Track FPS for status bar
let frameCount = 0;
let lastFpsTime = performance.now();
const origOnRender = hud.renderer.onRender.bind(hud.renderer);
hud.renderer.onRender((rc) => {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
    const nodeCount = graph.getNodes().length;
    const edgeCount = graph.getEdges().length;
    hud.statusBar.set('stats', 'Nodes: ' + nodeCount + ' | Edges: ' + edgeCount + ' | FPS: ' + fps, { position: 'right' });
    frameCount = 0;
    lastFpsTime = now;
  }
});

// --- Command Palette ---
hud.commandPalette.register([
  { id: 'focus-spine', label: 'Focus Spine', category: 'Node', action: () => { graph.pulse('spine', '#f97316'); } },
  { id: 'focus-moe', label: 'Focus MoE', category: 'Node', action: () => { graph.pulse('moe', '#22d3ee'); } },
  { id: 'focus-dense', label: 'Focus Dense', category: 'Node', action: () => { graph.pulse('dense', '#4dabf7'); } },
  { id: 'focus-claude', label: 'Focus Claude', category: 'Node', action: () => { graph.pulse('claude', '#f97316'); } },
  { id: 'focus-gpt52', label: 'Focus GPT-5.2', category: 'Node', action: () => { graph.pulse('gpt52', '#ffd43b'); } },
  { id: 'focus-nats', label: 'Focus NATS', category: 'Node', action: () => { graph.pulse('nats', '#ffd43b'); } },
  { id: 'focus-agentsmith', label: 'Focus AgentSmith', category: 'Node', action: () => { graph.pulse('agentsmith', '#a78bfa'); } },
  { id: 'toggle-physics', label: 'Toggle Physics', category: 'View', description: 'Space', action: () => { graph.toggleSimulation(); } },
  { id: 'fit-view', label: 'Fit to View', category: 'View', description: 'F', action: () => { graph.fitToView(); } },
  { id: 'reset-layout', label: 'Reset Layout', category: 'View', description: 'R', action: () => { graph.resetPositions(); } },
  { id: 'demo-investigation', label: 'Investigation Demo', category: 'Demo', action: () => { window.location.href = '/investigation.html'; } },
  { id: 'demo-governance', label: 'Governance Demo', category: 'Demo', action: () => { window.location.href = '/governance.html'; } },
  { id: 'demo-router', label: 'Router Demo', category: 'Demo', action: () => { window.location.href = '/router.html'; } },
  { id: 'demo-timeline', label: 'Timeline Demo', category: 'Demo', action: () => { window.location.href = '/timeline.html'; } },
  { id: "export-png", label: "Export as PNG", category: "Export", icon: "P", action: () => { hud.export.downloadPNG(); } },
  { id: "export-json", label: "Export Graph as JSON", category: "Export", icon: "J", action: () => { hud.export.downloadJSON(graph); } },
]);

// Export for HUD double-click handler and edge clicks
(window as any).__area42 = {
  graph,
  expandedNodes,
  onEdgeClick: handleEdgeClick,
  onNodeClick: (node: any) => {
    if (nodeDetails[node.id]) {
      toggleDetailPanel(node.id, nodeDetails[node.id]);
    }
  },
};

console.log(
  "%c Area42 %c Marvin Architecture Visualization ",
  "background: #0a0e17; color: #00d4aa; font-weight: bold; padding: 4px 8px;",
  "background: #131a2b; color: #c8d6e5; padding: 4px 8px;",
);
console.log("  Click graph nodes to open detail panels (up to 5 simultaneously).");
console.log("  Drag panels by their title bars. Double-click headers to collapse.");
console.log("  Scroll inside detail panels with mouse wheel.");
console.log("  Click X to close a detail panel, or click the same node again.");
console.log("  Double-click graph nodes to expand/collapse drill-down children.");
console.log("  Live SSE from AgentSmith with simulation fallback.");
// --- Panel lock toggle ---
function initPanelLock() {
  const lockBtn = document.getElementById('panel-lock-toggle') as HTMLDivElement;
  if (!lockBtn) return;

  // Sync button state with HUD
  const syncButton = () => {
    const locked = hud.panelsLockedState;
    lockBtn.textContent = locked ? '&#x1F512;' : '&#x1F513;';
    lockBtn.classList.toggle('locked', locked);
  };

  // Listen for HUD lock state changes
  let lastLocked = hud.panelsLockedState;
  const lockInterval = setInterval(() => {
    if (hud.panelsLockedState !== lastLocked) {
      syncButton();
      lastLocked = hud.panelsLockedState;
    }
  }, 100);

  // Button click handler
  lockBtn.addEventListener('click', () => {
    hud.panelsLockedState = !hud.panelsLockedState;
    lastLocked = hud.panelsLockedState;
    syncButton();
    clearInterval(lockInterval);
  });

  // Initial sync
  syncButton();
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPanelLock);
} else {
  initPanelLock();
}
