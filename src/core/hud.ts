/**
 * Area42 HUD — Main entry point
 *
 * Creates a full-screen (or container-bound) heads-up display with
 * floating glass panels, animated graphs, and real-time data streams.
 */

import { Renderer, RenderContext } from "./renderer.js";
import { Scene, SceneNode, Vec2 } from "./scene.js";
import { Panel, PanelOptions } from "../panels/panel.js";
import { Graph } from "../graph/graph.js";
import type { GraphNode } from "../graph/graph.js";
import { Theme, NeonTheme } from "../themes/neon.js";

export interface HUDOptions {
  theme?: Theme | "neon" | "glass";
  fps?: number;
  background?: boolean;
}

/** Drill-down child definitions for each expandable node */
const drillDownDefs: Record<string, { id: string; label: string; color: string; shape: "circle" | "hexagon" | "diamond" | "rect"; size: number }[]> = {
  agentsmith: [
    { id: "worker-arthur", label: "Arthur", color: "#4dabf7", shape: "circle", size: 14 },
    { id: "worker-trillian", label: "Trillian", color: "#4dabf7", shape: "circle", size: 14 },
    { id: "worker-ants", label: "Ants", color: "#4dabf7", shape: "circle", size: 14 },
  ],
  spine: [
    { id: "spine-pairs", label: "1528 pairs", color: "#f97316", shape: "circle", size: 12 },
    { id: "spine-accuracy", label: "94.2% acc", color: "#51cf66", shape: "circle", size: 12 },
    { id: "spine-latency", label: "<300ms", color: "#ffd43b", shape: "circle", size: 12 },
  ],
  nats: [
    { id: "stream-routing", label: "ROUTING", color: "#ffd43b", shape: "rect", size: 12 },
    { id: "stream-missions", label: "MISSIONS", color: "#ffd43b", shape: "rect", size: 12 },
    { id: "stream-feedback", label: "FEEDBACK", color: "#ffd43b", shape: "rect", size: 12 },
    { id: "stream-dreams", label: "DREAMS", color: "#ffd43b", shape: "rect", size: 12 },
  ],
  moe: [
    { id: "moe-slot-1", label: "Slot 1", color: "#22d3ee", shape: "circle", size: 10 },
    { id: "moe-slot-2", label: "Slot 2", color: "#22d3ee", shape: "circle", size: 10 },
    { id: "moe-slot-3", label: "Slot 3", color: "#22d3ee", shape: "circle", size: 10 },
    { id: "moe-slot-4", label: "Slot 4", color: "#22d3ee", shape: "circle", size: 10 },
  ],
};

export class HUD {
  readonly renderer: Renderer;
  readonly scene: Scene;
  readonly theme: Theme;
  readonly container: HTMLElement;

  private panels: Map<string, Panel> = new Map();
  private dragTarget: Panel | null = null;
  private hoverTarget: SceneNode | null = null;

  constructor(selector: string | HTMLElement, options: HUDOptions = {}) {
    const el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) throw new Error("Area42: container not found: " + selector);
    this.container = el as HTMLElement;

    // Theme
    if (options.theme === "glass") {
      this.theme = { ...NeonTheme, name: "glass" };
    } else if (typeof options.theme === "object") {
      this.theme = options.theme;
    } else {
      this.theme = NeonTheme;
    }

    // Set container background
    if (options.background !== false) {
      this.container.style.background = this.theme.bg;
      this.container.style.overflow = "hidden";
    }

    // Renderer + Scene
    this.renderer = new Renderer(this.container);
    this.scene = new Scene();

    // Render loop
    this.renderer.onRender((rc: RenderContext) => {
      this.scene.update(rc.deltaTime);

      // Draw background grid
      this.drawGrid(rc);

      // Render scene
      this.scene.render(rc.ctx);
    });

    // Mouse interactions
    this.setupInteractions();

    // Start
    this.renderer.start();
  }

  /** Create a floating glass panel */
  panel(options: PanelOptions): Panel {
    const panel = new Panel(options);
    this.scene.root.add(panel);
    this.panels.set(panel.id, panel);
    return panel;
  }

  /** Find a panel by ID */
  getPanel(id: string): Panel | undefined {
    return this.panels.get(id);
  }

  /** Remove a panel */
  removePanel(id: string) {
    const panel = this.panels.get(id);
    if (panel) {
      this.scene.root.remove(panel);
      this.panels.delete(id);
    }
  }

  /** Draw subtle background grid */
  private drawGrid(rc: RenderContext) {
    const ctx = rc.ctx;
    const spacing = 40;
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;

    for (let x = 0; x < rc.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rc.height);
      ctx.stroke();
    }
    for (let y = 0; y < rc.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rc.width, y);
      ctx.stroke();
    }
  }

  private readonly SNAP_DISTANCE = 15;  // px to trigger magnetic snap
  private readonly EDGE_DOCK_MARGIN = 8;  // px from container edge
  private resizeTarget: Panel | null = null;
  private dragNode: GraphNode | null = null;
  private dragGraph: Graph | null = null;
  private resizeEdge: string = "";

  /** Snap position to grid or nearby panels */
  private magneticSnap(panel: Panel, pos: Vec2): Vec2 {
    const gridSize = 20;
    let x = pos.x;
    let y = pos.y;

    // Snap to container edges
    if (x < this.SNAP_DISTANCE) x = this.EDGE_DOCK_MARGIN;
    if (y < this.SNAP_DISTANCE) y = this.EDGE_DOCK_MARGIN;
    if (x + panel.size.x > this.renderer.width - this.SNAP_DISTANCE) x = this.renderer.width - panel.size.x - this.EDGE_DOCK_MARGIN;
    if (y + panel.size.y > this.renderer.height - this.SNAP_DISTANCE) y = this.renderer.height - panel.size.y - this.EDGE_DOCK_MARGIN;

    // Snap to other panels (align edges)
    for (const [id, other] of this.panels) {
      if (other === panel) continue;
      const op = other.worldPosition();
      // Left edge aligns with other's left or right
      if (Math.abs(x - op.x) < this.SNAP_DISTANCE) x = op.x;
      if (Math.abs(x - (op.x + other.size.x)) < this.SNAP_DISTANCE) x = op.x + other.size.x;
      // Right edge
      if (Math.abs((x + panel.size.x) - op.x) < this.SNAP_DISTANCE) x = op.x - panel.size.x;
      if (Math.abs((x + panel.size.x) - (op.x + other.size.x)) < this.SNAP_DISTANCE) x = op.x + other.size.x - panel.size.x;
      // Top
      if (Math.abs(y - op.y) < this.SNAP_DISTANCE) y = op.y;
      if (Math.abs(y - (op.y + other.size.y)) < this.SNAP_DISTANCE) y = op.y + other.size.y;
      // Bottom
      if (Math.abs((y + panel.size.y) - op.y) < this.SNAP_DISTANCE) y = op.y - panel.size.y;
      if (Math.abs((y + panel.size.y) - (op.y + other.size.y)) < this.SNAP_DISTANCE) y = op.y + other.size.y - panel.size.y;
    }

    return { x, y };
  }

  /** Mouse interaction setup */
  private setupInteractions() {
    const canvas = this.renderer["canvas"] as HTMLCanvasElement;

    canvas.addEventListener("mousedown", (e) => {
      const point = this.canvasPoint(e);
      // Check panels (reverse order = front first)
      const nodes = [...this.panels.values()].reverse();
      // Check graph nodes first
      for (const child of this.scene.root.children) {
        if (child instanceof Graph) {
          const hitNode = child.findNodeAt(point.x, point.y);
          if (hitNode) {
            this.dragNode = hitNode;
            this.dragGraph = child;
            child.startNodeDrag(hitNode);
            return;
          }
        }
      }

      for (const panel of nodes) {
        // Check resize handle first (bottom-right 12x12 corner)
        const wp = panel.worldPosition();
        const rx = wp.x + panel.size.x;
        const ry = wp.y + (panel.collapsed ? 28 : panel.size.y);
        if (!panel.collapsed && Math.abs(point.x - rx) < 12 && Math.abs(point.y - ry) < 12) {
          this.resizeTarget = panel;
          this.resizeEdge = "se";
          // Bring to front
          this.scene.root.remove(panel);
          this.scene.root.add(panel);
          break;
        }
        if (panel.isInHeader(point)) {
          this.dragTarget = panel;
          panel.startDrag(point);
          // Bring to front
          this.scene.root.remove(panel);
          this.scene.root.add(panel);
          break;
        }
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      const point = this.canvasPoint(e);
      if (this.dragNode && this.dragGraph) {
        this.dragGraph.dragNode(this.dragNode, point.x, point.y);
      } else if (this.resizeTarget) {
        this.handleResize(point);
      } else if (this.dragTarget) {
        this.dragTarget.drag(point);
        // Apply magnetic snapping
        const snapped = this.magneticSnap(this.dragTarget, this.dragTarget.position);
        this.dragTarget.position.x = snapped.x;
        this.dragTarget.position.y = snapped.y;
      } else {
        // Hover detection
        const node = this.scene.findAt(point);
        if (node !== this.hoverTarget) {
          this.hoverTarget = node;
          // Check graph nodes for pointer cursor
        for (const child of this.scene.root.children) {
          if (child instanceof Graph) {
            const hitNode = child.findNodeAt(point.x, point.y);
            if (hitNode) {
              canvas.style.cursor = "grab";
              return;
            }
          }
        }
        // Check resize corners
        let isResize = false;
        for (const [, p] of this.panels) {
          if (p.collapsed) continue;
          const wp2 = p.worldPosition();
          if (Math.abs(point.x - (wp2.x + p.size.x)) < 12 && Math.abs(point.y - (wp2.y + p.size.y)) < 12) {
            canvas.style.cursor = "se-resize";
            isResize = true;
            break;
          }
        }
        if (!isResize) canvas.style.cursor = node ? "pointer" : "default";
        }
      }
    });

    canvas.addEventListener("mouseup", () => {
      if (this.dragTarget) {
        this.dragTarget.endDrag();
        this.dragTarget = null;
      }
      if (this.dragNode && this.dragGraph) {
        this.dragGraph.endNodeDrag(this.dragNode);
        this.dragNode = null;
        this.dragGraph = null;
      }
      if (this.resizeTarget) {
        this.resizeTarget = null;
        this.resizeEdge = "";
      }
    });

    canvas.addEventListener("dblclick", (e) => {
      const point = this.canvasPoint(e);

      // Check graph nodes FIRST (before panels)
      for (const child of this.scene.root.children) {
        if (child instanceof Graph) {
          const hitNode = child.findNodeAt(point.x, point.y);
          if (hitNode) {
            this.handleGraphNodeDblClick(child, hitNode);
            return; // consumed the event
          }
        }
      }

      // Then check panel headers for collapse/expand
      const nodes = [...this.panels.values()].reverse();
      for (const panel of nodes) {
        if (panel.isInHeader(point)) {
          panel.collapsed = !panel.collapsed;
          break;
        }
      }
    });
  }

  /** Handle double-click on a graph node: expand or collapse drill-down */
  private handleGraphNodeDblClick(graph: Graph, node: GraphNode) {
    // Get the shared expanded state from main.ts via window
    const area42 = (window as any).__area42;
    const expandedNodes: Set<string> = area42?.expandedNodes ?? new Set();

    const nodeId = node.id;

    // If this is a child node (has parentId), collapse the parent instead
    if (node.parentId) {
      const parentId = node.parentId;
      graph.collapse(parentId);
      expandedNodes.delete(parentId);
      return;
    }

    if (expandedNodes.has(nodeId)) {
      // Collapse
      graph.collapse(nodeId);
      expandedNodes.delete(nodeId);
    } else {
      // Expand if we have drill-down definitions
      const children = drillDownDefs[nodeId];
      if (children) {
        graph.expand(nodeId, children);
        expandedNodes.add(nodeId);
      }
    }
  }

  private canvasPoint(e: MouseEvent): Vec2 {
    const rect = this.container.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Handle panel resize drag */
  private handleResize(point: Vec2) {
    if (!this.resizeTarget) return;
    const wp = this.resizeTarget.worldPosition();
    this.resizeTarget.size.x = Math.max(150, point.x - wp.x);
    this.resizeTarget.size.y = Math.max(80, point.y - wp.y);
  }

  /** Destroy the HUD */
  destroy() {
    this.renderer.destroy();
  }
}
