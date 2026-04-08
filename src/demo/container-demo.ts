/**
 * Area42 v2 Container Demo
 *
 * Demonstrates the new Container architecture:
 * - Graph inside a Panel (clips to panel bounds!)
 * - Nested panels
 * - Metrics inside panels as children
 *
 * This is the Session 1 proof-of-concept.
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import { Panel } from "../panels/panel.js";

// --- Setup HUD ---
const hud = new HUD("#hud", { theme: "neon", background: false });
const container = document.getElementById("hud")!;
container.style.background = "linear-gradient(135deg, #0c1120 0%, #0f1628 50%, #0a0e17 100%)";

const W = hud.renderer.width;
const H = hud.renderer.height;

// ============================================================================
// DEMO 1: Graph inside a Panel (the original trigger for v2!)
// ============================================================================

const graphPanel = hud.panel({
  title: "Request Flow",
  position: { x: 20, y: 20 },
  size: { x: 600, y: 400 },
  titleColor: "#4dabf7",
  clip: true,  // v2: children clip to panel bounds
});

// Create a graph and add it as a CHILD of the panel
const graph = new Graph({
  id: "flow-graph",
  position: { x: 0, y: 0 },
  size: { x: 584, y: 356 },  // Fill panel content area
});

// Add nodes
graph.addNode({ id: "spine", label: "Spine", color: "#f97316", shape: "hexagon", size: 22 });
graph.addNode({ id: "moe", label: "MoE", color: "#22d3ee", size: 20 });
graph.addNode({ id: "dense", label: "Dense", color: "#4dabf7", size: 18 });
graph.addNode({ id: "claude", label: "Claude", color: "#f97316", shape: "diamond", size: 20 });
graph.addNode({ id: "gpt", label: "GPT-5.2", color: "#ffd43b", size: 18 });
graph.addNode({ id: "nats", label: "NATS", color: "#ffd43b", shape: "rect", size: 16 });

// Add edges with particles
graph.addEdge({ from: "spine", to: "moe", color: "#22d3ee66", particles: true });
graph.addEdge({ from: "spine", to: "dense", color: "#4dabf766", particles: true });
graph.addEdge({ from: "spine", to: "claude", color: "#f9731666", particles: true });
graph.addEdge({ from: "spine", to: "gpt", color: "#ffd43b66", particles: true });
graph.addEdge({ from: "nats", to: "spine", color: "#ffd43b66", particles: true });
graph.addEdge({ from: "moe", to: "nats", color: "#22d3ee33", dashed: true });

// v2: Add graph as child of panel — it will clip automatically!
graphPanel.add(graph);

// Pulse a node to show it's alive
setTimeout(() => graph.pulse("spine", "#f97316"), 1000);
setTimeout(() => graph.pulse("nats", "#ffd43b"), 2000);

// ============================================================================
// DEMO 2: Nested Panels
// ============================================================================

const outerPanel = hud.panel({
  title: "System Overview",
  position: { x: 640, y: 20 },
  size: { x: 500, y: 400 },
  titleColor: "#51cf66",
  clip: true,
});

// Inner panel 1 — nested inside outer
const innerPanel1 = new Panel({
  id: "inner-services",
  title: "Services",
  position: { x: 0, y: 0 },
  size: { x: 230, y: 340 },
  titleColor: "#22d3ee",
  compact: true,
  clip: true,
});

// Inner panel 2 — nested inside outer
const innerPanel2 = new Panel({
  id: "inner-metrics",
  title: "Metrics",
  position: { x: 240, y: 0 },
  size: { x: 230, y: 340 },
  titleColor: "#f97316",
  compact: true,
  clip: true,
});

// Add content to inner panels using v1 backward-compat onContent
innerPanel1.onContent((ctx, x, y, w, h) => {
  const services = [
    { name: "Spine", status: "green", port: 8083 },
    { name: "MoE", status: "green", port: 8081 },
    { name: "Dense", status: "yellow", port: 8082 },
    { name: "Marvin", status: "green", port: 8090 },
    { name: "NATS", status: "green", port: 4222 },
  ];

  ctx.font = "10px system-ui, sans-serif";
  services.forEach((svc, i) => {
    const sy = y + i * 28;
    // Status dot
    ctx.fillStyle = svc.status === "green" ? "#51cf66" : "#ffd43b";
    ctx.beginPath();
    ctx.arc(x + 6, sy + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    // Name
    ctx.fillStyle = "#c8d6e5";
    ctx.fillText(svc.name, x + 16, sy + 12);
    // Port
    ctx.fillStyle = "#6b7b8d";
    ctx.fillText(`:${svc.port}`, x + 120, sy + 12);
  });
});

innerPanel2.onContent((ctx, x, y, w, h) => {
  const metrics = [
    { label: "Requests/min", value: "142", color: "#4dabf7" },
    { label: "Avg Latency", value: "340ms", color: "#51cf66" },
    { label: "Token Cost", value: "$0.00", color: "#ffd43b" },
    { label: "Cache Hit", value: "87%", color: "#22d3ee" },
  ];

  metrics.forEach((m, i) => {
    const my = y + i * 36;
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText(m.label.toUpperCase(), x, my + 10);
    ctx.fillStyle = m.color;
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.letterSpacing = "0px";
    ctx.fillText(m.value, x, my + 30);
  });
});

// v2: Add inner panels as children of outer panel
outerPanel.add(innerPanel1);
outerPanel.add(innerPanel2);

// ============================================================================
// STATUS INFO
// ============================================================================

hud.statusBar.set("version", "Container Demo", { color: "#4dabf7" });
hud.statusBar.set("panels", "4 (2 nested)", { color: "#51cf66" });
hud.statusBar.set("graph", "Clipped in panel", { color: "#f97316" });
