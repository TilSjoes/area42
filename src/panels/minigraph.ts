/**
 * Area42 Mini-Graph (Process Diagram)
 *
 * A small left-to-right flow diagram rendered inside a panel.
 * For process orchestration steps, workflow visualization.
 * Uses topological sort for layout, status-colored nodes with pulse animation.
 */

import { NeonTheme } from "../themes/neon.js";

export interface MiniNode {
  id: string;
  label: string;
  status?: "pending" | "running" | "completed" | "failed";
  color?: string;
}

export interface MiniEdge {
  from: string;
  to: string;
}

/** Status to color mapping */
const STATUS_COLORS: Record<string, string> = {
  pending: NeonTheme.textDim,
  running: NeonTheme.warning,
  completed: NeonTheme.success,
  failed: NeonTheme.danger,
};

export class MiniGraph {
  nodes: MiniNode[] = [];
  edges: MiniEdge[] = [];
  private animTime = 0;

  constructor(nodes: MiniNode[], edges: MiniEdge[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  /** Update status of a node by ID */
  updateStatus(nodeId: string, status: "pending" | "running" | "completed" | "failed"): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) node.status = status;
  }

  /**
   * Render the mini-graph as a left-to-right flow diagram.
   */
  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    this.animTime += 0.016; // ~60fps increment

    if (this.nodes.length === 0) return;

    // Topological sort for left-to-right layout
    const order = this.topoSort();
    const nodeRadius = Math.min(14, Math.max(8, h * 0.18));
    const padding = nodeRadius + 10;
    const usableW = w - padding * 2;
    const usableH = h - 30; // leave room for labels below

    // Calculate positions
    const positions = new Map<string, { x: number; y: number }>();
    const n = order.length;
    for (let i = 0; i < n; i++) {
      const nx = x + padding + (n > 1 ? (i / (n - 1)) * usableW : usableW / 2);
      const ny = y + usableH * 0.4;
      positions.set(order[i], { x: nx, y: ny });
    }

    // Draw edges (arrows)
    for (const edge of this.edges) {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) continue;

      const fromNode = this.nodes.find((n) => n.id === edge.from);
      const toNode = this.nodes.find((n) => n.id === edge.to);
      const fromColor = this.nodeColor(fromNode);
      const toColor = this.nodeColor(toNode);

      // Line
      ctx.save();
      const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      grad.addColorStop(0, fromColor + "88");
      grad.addColorStop(1, toColor + "88");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(from.x + nodeRadius, from.y);
      ctx.lineTo(to.x - nodeRadius, to.y);
      ctx.stroke();

      // Arrowhead
      const ax = to.x - nodeRadius - 2;
      const ay = to.y;
      const arrowSize = 5;
      ctx.fillStyle = toColor + "aa";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowSize, ay - arrowSize * 0.6);
      ctx.lineTo(ax - arrowSize, ay + arrowSize * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw nodes
    for (const node of this.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const color = this.nodeColor(node);
      const status = node.status || "pending";

      ctx.save();

      // Running pulse
      if (status === "running") {
        const pulse = 0.3 + Math.sin(this.animTime * 4) * 0.2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.round(pulse * 255).toString(16).padStart(2, "0");
        ctx.fill();
      }

      // Node glow
      ctx.shadowColor = color;
      ctx.shadowBlur = status === "running" ? 12 : 6;

      // Outer circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = color + "33";
      ctx.fill();

      // Inner circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fill();

      // Border
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Status icon inside node
      ctx.fillStyle = "#0a0e17";
      ctx.font = "bold " + Math.round(nodeRadius * 0.7) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (status === "completed") {
        ctx.fillText("\u2713", pos.x, pos.y);
      } else if (status === "failed") {
        ctx.fillText("\u2717", pos.x, pos.y);
      } else if (status === "running") {
        ctx.fillText("\u25B6", pos.x + 1, pos.y);
      }
      // pending: no icon

      ctx.restore();

      // Label below
      ctx.save();
      ctx.fillStyle = NeonTheme.text;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.label, pos.x, pos.y + nodeRadius + 6);
      ctx.restore();
    }
  }

  /** Get the color for a node based on status */
  private nodeColor(node: MiniNode | undefined): string {
    if (!node) return NeonTheme.textDim;
    if (node.color) return node.color;
    return STATUS_COLORS[node.status || "pending"] || NeonTheme.textDim;
  }

  /** Topological sort of node IDs based on edges */
  private topoSort(): string[] {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of this.nodes) {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    }

    for (const edge of this.edges) {
      adj.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);
      for (const next of adj.get(id) || []) {
        const newDeg = (inDegree.get(next) || 1) - 1;
        inDegree.set(next, newDeg);
        if (newDeg === 0) queue.push(next);
      }
    }

    // Add any nodes not reached (cycles or disconnected)
    for (const node of this.nodes) {
      if (!result.includes(node.id)) {
        result.push(node.id);
      }
    }

    return result;
  }
}
