/**
 * Area42 v2 Container Demo — Session 2
 *
 * Demonstrates:
 * - Session 1: Graph inside Panel (clipping), nested panels
 * - Session 2: Layout engine (vertical, horizontal, grid), style inheritance
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import { Panel } from "../panels/panel.js";
import { SceneNode } from "../core/scene.js";
import type { PartialStyle } from "../core/style.js";

// --- Setup HUD ---
const hud = new HUD("#hud", { theme: "neon", background: false });
const container = document.getElementById("hud")!;
container.style.background = "linear-gradient(135deg, #0c1120 0%, #0f1628 50%, #0a0e17 100%)";

// ============================================================================
// DEMO 1: Graph inside a Panel (Session 1 — still works!)
// ============================================================================

const graphPanel = hud.panel({
  title: "Request Flow",
  position: { x: 20, y: 20 },
  size: { x: 500, y: 360 },
  titleColor: "#4dabf7",
  clip: true,
});

const graph = new Graph({
  id: "flow-graph",
  position: { x: 0, y: 0 },
  size: { x: 484, y: 316 },
});

graph.addNode({ id: "spine", label: "Spine", color: "#f97316", shape: "hexagon", size: 22 });
graph.addNode({ id: "moe", label: "MoE", color: "#22d3ee", size: 20 });
graph.addNode({ id: "dense", label: "Dense", color: "#4dabf7", size: 18 });
graph.addNode({ id: "claude", label: "Claude", color: "#f97316", shape: "diamond", size: 20 });
graph.addNode({ id: "gpt", label: "GPT-5.2", color: "#ffd43b", size: 18 });
graph.addNode({ id: "nats", label: "NATS", color: "#ffd43b", shape: "rect", size: 16 });

graph.addEdge({ from: "spine", to: "moe", color: "#22d3ee66", particles: true });
graph.addEdge({ from: "spine", to: "dense", color: "#4dabf766", particles: true });
graph.addEdge({ from: "spine", to: "claude", color: "#f9731666", particles: true });
graph.addEdge({ from: "spine", to: "gpt", color: "#ffd43b66", particles: true });
graph.addEdge({ from: "nats", to: "spine", color: "#ffd43b66", particles: true });
graph.addEdge({ from: "moe", to: "nats", color: "#22d3ee33", dashed: true });

graphPanel.add(graph);
setTimeout(() => graph.pulse("spine", "#f97316"), 1000);

// ============================================================================
// DEMO 2: Vertical layout with style inheritance
// ============================================================================

const metricsPanel = hud.panel({
  title: "Metrics (vertical layout)",
  position: { x: 540, y: 20 },
  size: { x: 260, y: 360 },
  titleColor: "#51cf66",
  clip: true,
});

// Set layout on the panel — children stack vertically
metricsPanel.childLayout = "vertical";
metricsPanel.gap = 6;

// Set a domain style — all children inherit the accent color
metricsPanel.style = { accent: "#51cf66", fontSize: 11 };

// Create metric cards as simple SceneNodes
function createMetricCard(label: string, value: string, color?: string): SceneNode {
  const card = new SceneNode({
    size: { x: 240, y: 60 },
  });
  // Override accent for this card if specified
  if (color) {
    card.style = { accent: color };
  }
  card.render = function(ctx: CanvasRenderingContext2D) {
    const s = this.resolvedStyle();
    const w = this.size.x;
    const h = this.size.y;

    // Card background
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 4);
    ctx.fill();

    // Left accent bar
    ctx.fillStyle = s.accent;
    ctx.fillRect(0, 0, 3, h);

    // Label
    ctx.fillStyle = s.textDim;
    ctx.font = `bold ${s.fontSize - 2}px ${s.fontFamily}`;
    ctx.letterSpacing = "1px";
    ctx.textBaseline = "top";
    ctx.fillText(label.toUpperCase(), 12, 8);

    // Value
    ctx.fillStyle = s.accent;
    ctx.font = `bold 22px ${s.fontFamily}`;
    ctx.letterSpacing = "0px";
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 6;
    ctx.fillText(value, 12, 26);
    ctx.shadowBlur = 0;
  };
  return card;
}

metricsPanel.add(createMetricCard("Requests / min", "142"));
metricsPanel.add(createMetricCard("Avg Latency", "340ms", "#4dabf7"));
metricsPanel.add(createMetricCard("Token Cost", "$0.00", "#ffd43b"));
metricsPanel.add(createMetricCard("Cache Hit Rate", "87%", "#22d3ee"));
metricsPanel.add(createMetricCard("Active Models", "4", "#a78bfa"));

// ============================================================================
// DEMO 3: Horizontal layout
// ============================================================================

const statusPanel = hud.panel({
  title: "Service Status (horizontal layout)",
  position: { x: 20, y: 400 },
  size: { x: 780, y: 140 },
  titleColor: "#22d3ee",
  clip: true,
});

statusPanel.childLayout = "horizontal";
statusPanel.gap = 8;

function createServiceCard(name: string, status: "green" | "yellow" | "red", port: number): SceneNode {
  const statusColors = { green: "#51cf66", yellow: "#ffd43b", red: "#ff6b6b" };
  const card = new SceneNode({
    size: { x: 145, y: 96 },
  });
  card.style = { accent: statusColors[status] };

  card.render = function(ctx: CanvasRenderingContext2D) {
    const s = this.resolvedStyle();
    const w = this.size.x;
    const h = this.size.y;

    // Card bg
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = s.accent + "33";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Status dot
    ctx.fillStyle = s.accent;
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(w - 14, 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Name
    ctx.fillStyle = s.fg;
    ctx.font = `bold 12px ${s.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(name, 10, 10);

    // Port
    ctx.fillStyle = s.textDim;
    ctx.font = `10px ${s.fontFamily}`;
    ctx.fillText(`:${port}`, 10, 28);

    // Fake sparkline
    ctx.strokeStyle = s.accent + "88";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sparkY = 60;
    for (let i = 0; i < 20; i++) {
      const sx = 10 + i * ((w - 20) / 19);
      const sy = sparkY + (Math.sin(i * 0.7 + port) * 12);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  };
  return card;
}

statusPanel.add(createServiceCard("Spine", "green", 8083));
statusPanel.add(createServiceCard("MoE", "green", 8081));
statusPanel.add(createServiceCard("Dense", "yellow", 8082));
statusPanel.add(createServiceCard("Claude", "green", 8090));
statusPanel.add(createServiceCard("NATS", "green", 4222));

// ============================================================================
// DEMO 4: Grid layout
// ============================================================================

const gridPanel = hud.panel({
  title: "Backends (grid layout)",
  position: { x: 820, y: 20 },
  size: { x: 340, y: 360 },
  titleColor: "#f97316",
  clip: true,
});

gridPanel.childLayout = "grid";
gridPanel.gap = 6;

function createGridTile(label: string, value: string, color: string): SceneNode {
  const tile = new SceneNode({
    size: { x: 100, y: 80 },
  });
  tile.style = { accent: color };

  tile.render = function(ctx: CanvasRenderingContext2D) {
    const s = this.resolvedStyle();
    const w = this.size.x;
    const h = this.size.y;

    // Tile bg with accent glow
    ctx.fillStyle = s.accent + "0a";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = s.accent + "44";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Value
    ctx.fillStyle = s.accent;
    ctx.font = `bold 20px ${s.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 8;
    ctx.fillText(value, w / 2, h / 2 - 6);
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = s.textDim;
    ctx.font = `bold 8px ${s.fontFamily}`;
    ctx.letterSpacing = "1px";
    ctx.fillText(label.toUpperCase(), w / 2, h / 2 + 16);
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
gridPanel.add(createGridTile("Uptime", "42d", "#4dabf7"));

// ============================================================================
// STATUS BAR
// ============================================================================

hud.statusBar.set("version", "Area42 v2 Session 2", { color: "#4dabf7" });
hud.statusBar.set("layout", "3 layouts: vertical, horizontal, grid", { color: "#51cf66" });
hud.statusBar.set("style", "Style inheritance active", { color: "#f97316" });
