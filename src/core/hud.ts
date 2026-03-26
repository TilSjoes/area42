/**
 * Area42 HUD — Main entry point
 *
 * Creates a full-screen (or container-bound) heads-up display with
 * floating glass panels, animated graphs, and real-time data streams.
 */

import { Renderer, RenderContext } from "./renderer.js";
import { Scene, SceneNode, Vec2 } from "./scene.js";
import { Panel, PanelOptions, SnapZone } from "../panels/panel.js";
import { Graph } from "../graph/graph.js";
import type { GraphNode, GraphEdge, EdgeDetail } from "../graph/graph.js";
import { Theme, NeonTheme } from "../themes/neon.js";
import { ContextMenu } from "../panels/contextmenu.js";
import type { MenuItem } from "../panels/contextmenu.js";
import { HelpOverlay } from "../panels/helpoverlay.js";
import { StatusBar } from "../panels/statusbar.js";
import type { StatusItem } from "../panels/statusbar.js";
import { CommandPalette } from "../panels/command.js";
import type { CommandItem } from "../panels/command.js";
import { Exporter } from "./export.js";
import { analyzeSelection, renderAnalysis } from "./analysis.js";
import type { AnalysisResult } from "./analysis.js";

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
  private showBackground: boolean;
  private gridVisible = true;

  // Context menu and help overlay
  private contextMenu: ContextMenu = new ContextMenu();
  private helpOverlay: HelpOverlay = new HelpOverlay();

  // Status bar and command palette
  private _statusBar: StatusBar = new StatusBar();
  private _commandPalette: CommandPalette = new CommandPalette();
  // Minimized panel dock
  private minimizedPanels: Panel[] = [];
  private dockBarHeight = 28;
  private dockButtonWidth = 130;

  // Export system
  private _exporter: Exporter | null = null;

  // Selection analysis
  private analysisResult: AnalysisResult | null = null;
  private analysisPanel: Panel | null = null;

  // Graph panning state
  private isPanning = false;
  private panStart: Vec2 = { x: 0, y: 0 };
  private panGraph: Graph | null = null;
  private panStartOffset: Vec2 = { x: 0, y: 0 };
// Snap zone preview  private snapPreview: SnapZone = null;

  // Touch pinch state
  private lastPinchDist = 0;
  private lastPinchMidX = 0;
  private lastPinchMidY = 0;

  constructor(selector: string | HTMLElement, options: HUDOptions = {}) {
    const el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) throw new Error("Area42: container not found: " + selector);
    this.container = el as HTMLElement;

    this.showBackground = options.background !== false;

    // Theme
    if (options.theme === "glass") {
      this.theme = { ...NeonTheme, name: "glass" };
    } else if (typeof options.theme === "object") {
      this.theme = options.theme;
    } else {
      this.theme = NeonTheme;
    }

    // Set container background
    if (this.showBackground) {
      this.container.style.background = this.theme.bg;
      this.container.style.overflow = "hidden";
    } else {
      this.container.style.background = "transparent";
      this.container.style.overflow = "hidden";
    }

    // Renderer + Scene
    this.renderer = new Renderer(this.container);
    // Initialize export system
    this._exporter = new Exporter(this.renderer["canvas"] as HTMLCanvasElement);
    this.scene = new Scene();

    // Render loop
    this.renderer.onRender((rc: RenderContext) => {
      this.scene.update(rc.deltaTime);

      // Draw background grid only when background is enabled
      if (this.showBackground && this.gridVisible) {
        this.drawGrid(rc);
      }

// Render snap zone preview      if (this.snapPreview && this.dragTarget) {        this.drawSnapPreview(rc, this.snapPreview);      }
      // Render scene
      this.scene.render(rc.ctx);

      // Render minimized panel dock bar (above status bar)
      const dockPanels = this.getMinimizedPanels();
      if (dockPanels.length > 0) {
        this.renderDockBar(rc.ctx, rc.width, rc.height, dockPanels);
      }

      // Render selection analysis panel
      this.updateAnalysis();
      if (this.analysisResult && this.analysisResult.nodeCount >= 2) {
        this.renderAnalysisOverlay(rc.ctx, rc.width, rc.height);
      }
      // Render status bar at bottom
      const statusBarH = this._statusBar.getHeight();
      this._statusBar.render(rc.ctx, rc.height - statusBarH, rc.width);

      // Render context menu (above everything)
      this.contextMenu.render(rc.ctx);

      // Render command palette (above help)
      this._commandPalette.render(rc.ctx, rc.width, rc.height);

      // Render help overlay (topmost)
      this.helpOverlay.render(rc.ctx, rc.width, rc.height);
    });

    // Mouse interactions
    this.setupInteractions();

    // Start
    this.renderer.start();
  }

  /** Get the status bar instance */
  get statusBar(): StatusBar { return this._statusBar; }

  /** Get the command palette instance */
  get commandPalette(): CommandPalette { return this._commandPalette; }
  /** Get the export system */
  get export(): Exporter { return this._exporter!; }

  /** Create a floating glass panel */
  panel(options: PanelOptions): Panel {
    const panel = new Panel(options);
    this.scene.root.add(panel);
    this.panels.set(panel.id, panel);
    return panel;
  }

  /** Register an existing panel (e.g. DetailPanel) with the HUD for drag/resize/scroll */
  registerPanel(panel: Panel) {
    if (!this.panels.has(panel.id)) {
      this.panels.set(panel.id, panel);
      // Add to scene if not already there
      if (!this.scene.root.children.includes(panel)) {
        this.scene.root.add(panel);
      }
    }
  }

  /** Unregister a panel from the HUD (removes from Map and scene) */
  unregisterPanel(id: string) {
    const panel = this.panels.get(id);
    if (panel) {
      this.scene.root.remove(panel);
      this.panels.delete(id);
    }
  }

  /** Find a panel by ID */
  getPanel(id: string): Panel | undefined {
    return this.panels.get(id);
  }

  /** Remove a panel */
  /** Minimize a panel to the dock bar */
  minimizePanel(panel: Panel): void {
    if (!panel.minimized) {
      panel.minimize();
      if (!this.minimizedPanels.includes(panel)) {
        this.minimizedPanels.push(panel);
      }
    }
  }

  /** Restore a panel from the dock bar */
  restoreFromDock(panel: Panel): void {
    panel.restore();
    const idx = this.minimizedPanels.indexOf(panel);
    if (idx >= 0) this.minimizedPanels.splice(idx, 1);
  }

  /** Get minimized panels list (for dock rendering) */
  getMinimizedPanels(): Panel[] {
    return this.minimizedPanels.filter(p => p.minimized);
  }

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


  /** Draw snap zone preview overlay */
  private drawSnapPreview(rc: RenderContext, zone: SnapZone): void {
    if (!zone) return;
    const ctx = rc.ctx;
    const w = rc.width;
    const h = rc.height;
    const m = 4;
    const halfW = (w - m * 3) / 2;
    const halfH = (h - m * 3) / 2;
    let rx = 0, ry = 0, rw = 0, rh = 0;
    switch (zone) {
      case "top": rx = m; ry = m; rw = w - m * 2; rh = halfH; break;
      case "bottom": rx = m; ry = halfH + m * 2; rw = w - m * 2; rh = halfH; break;
      case "left": rx = m; ry = m; rw = halfW; rh = h - m * 2; break;
      case "right": rx = halfW + m * 2; ry = m; rw = halfW; rh = h - m * 2; break;
      case "top-left": rx = m; ry = m; rw = halfW; rh = halfH; break;
      case "top-right": rx = halfW + m * 2; ry = m; rw = halfW; rh = halfH; break;
      case "bottom-left": rx = m; ry = halfH + m * 2; rw = halfW; rh = halfH; break;
      case "bottom-right": rx = halfW + m * 2; ry = halfH + m * 2; rw = halfW; rh = halfH; break;
    }
    ctx.save();
    ctx.fillStyle = "rgba(123, 104, 238, 0.08)";
    ctx.strokeStyle = "rgba(123, 104, 238, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
    ctx.restore();
  }
  private readonly SNAP_DISTANCE = 15;
  private readonly EDGE_DOCK_MARGIN = 8;
  private resizeTarget: Panel | null = null;
  private dragNode: GraphNode | null = null;
  private dragGraph: Graph | null = null;
  private resizeEdge: string = "";

  /** Snap position to grid or nearby panels */
  private magneticSnap(panel: Panel, pos: Vec2): Vec2 {
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
      if (Math.abs(x - op.x) < this.SNAP_DISTANCE) x = op.x;
      if (Math.abs(x - (op.x + other.size.x)) < this.SNAP_DISTANCE) x = op.x + other.size.x;
      if (Math.abs((x + panel.size.x) - op.x) < this.SNAP_DISTANCE) x = op.x - panel.size.x;
      if (Math.abs((x + panel.size.x) - (op.x + other.size.x)) < this.SNAP_DISTANCE) x = op.x + other.size.x - panel.size.x;
      if (Math.abs(y - op.y) < this.SNAP_DISTANCE) y = op.y;
      if (Math.abs(y - (op.y + other.size.y)) < this.SNAP_DISTANCE) y = op.y + other.size.y;
      if (Math.abs((y + panel.size.y) - op.y) < this.SNAP_DISTANCE) y = op.y - panel.size.y;
      if (Math.abs((y + panel.size.y) - (op.y + other.size.y)) < this.SNAP_DISTANCE) y = op.y + other.size.y - panel.size.y;
    }

    return { x, y };
  }

  /** Find the panel under a given point (front-to-back order) */
  private panelAt(point: Vec2): Panel | null {
    const panels = [...this.panels.values()].reverse();
    for (const panel of panels) {
      if (!panel.visible) continue;
if (panel.minimized) {        if (panel.contains(point)) return panel;        continue;      }
      const wp = panel.worldPosition();
      const h = panel.collapsed ? 28 : panel.size.y;
      if (point.x >= wp.x && point.x <= wp.x + panel.size.x &&
          point.y >= wp.y && point.y <= wp.y + h) {
        return panel;
      }
    }
    return null;
  }

  /** Mouse interaction setup */
  private setupInteractions() {
    const canvas = this.renderer["canvas"] as HTMLCanvasElement;

    // --- Right-click context menu ---
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const point = this.canvasPoint(e);
      const items = this.buildContextMenuItems(point);
      this.contextMenu.show(point.x, point.y, items);
      this.contextMenu.clampToScreen(this.renderer.width, this.renderer.height);
    });

    // --- Keyboard shortcuts ---
    document.addEventListener("keydown", (e) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;
      this.handleKeyDown(e);
    });

    canvas.addEventListener("mousedown", (e) => {
      const point = this.canvasPoint(e);

      // Dock bar click handling
      const dockPanel = this.dockButtonAt(point);
      if (dockPanel) {
        this.restoreFromDock(dockPanel);
        return;
      }

      // Status bar click handling
      const statusBarY = this.renderer.height - this._statusBar.getHeight();
      if (point.y >= statusBarY) {
        this._statusBar.handleClick(point.x);
        return;
      }

      // Command palette blocks clicks when visible
      if (this._commandPalette.isVisible()) {
        return;
      }

      // Context menu click handling (takes priority)
      if (this.contextMenu.isVisible()) {
        if (this.contextMenu.handleClick(point)) return;
      }

      // Middle mouse or Ctrl+left = pan
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        const panel = this.panelAt(point);
        if (!panel) {
          for (const child of this.scene.root.children) {
            if (child instanceof Graph) {
              if (!child.findNodeAt(point.x, point.y)) {
                this.isPanning = true;
                this.panStart = { x: point.x, y: point.y };
                this.panGraph = child;
                this.panStartOffset = { x: child.offsetX, y: child.offsetY };
                canvas.style.cursor = "grabbing";
                e.preventDefault();
                return;
              }
            }
          }
        }
      }

      const nodes = [...this.panels.values()].reverse();

      // Check graph nodes first
      for (const child of this.scene.root.children) {
        if (child instanceof Graph) {
          const hitNode = child.findNodeAt(point.x, point.y);
          if (hitNode) {
            if (e.shiftKey) {
              child.toggleSelection(hitNode.id);
              return;
            }
            this.dragNode = hitNode;
            this.dragGraph = child;
            child.startNodeDrag(hitNode);
            return;
          }
        }
      }

      // Click on empty space without shift clears selection
      if (!e.shiftKey) {
        let clickedPanel = false;
        for (const panel of nodes) {
          const wp = panel.worldPosition();
          const ph = panel.collapsed ? 28 : panel.size.y;
          if (point.x >= wp.x && point.x <= wp.x + panel.size.x &&
              point.y >= wp.y && point.y <= wp.y + ph) {
            clickedPanel = true;
            break;
          }
        }
        if (!clickedPanel) {
          for (const child of this.scene.root.children) {
            if (child instanceof Graph) {
              child.clearSelection();
            }
          }
        }
      }

      for (const panel of nodes) {
        const wp = panel.worldPosition();
// Click on minimized dot to restore        if (panel.minimized && panel.contains(point)) {          this.restoreFromDock(panel);          return;        }        // Minimize button click        if (panel.isInMinimizeButton(point)) {          this.minimizePanel(panel);          return;        }
        if (panel.closable) {
          const closeX = wp.x + panel.size.x - 20;
          const closeY = wp.y;
          if (point.x >= closeX && point.x <= closeX + 20 &&
              point.y >= closeY && point.y <= closeY + 28) {
            if (typeof (panel as any).onCloseCallback === "function") {
              (panel as any).onCloseCallback();
            } else {
              panel.visible = false;
            }
            return;
          }
        }

        const rx = wp.x + panel.size.x;
        const ry = wp.y + (panel.collapsed ? 28 : panel.size.y);
        if (!panel.collapsed && Math.abs(point.x - rx) < 12 && Math.abs(point.y - ry) < 12) {
          this.resizeTarget = panel;
          this.resizeEdge = "se";
          this.scene.root.remove(panel);
          this.scene.root.add(panel);
          break;
        }
        // Check collapse button
        if (panel.isInCollapseButton && panel.isInCollapseButton(point)) {
          panel.collapsed = !panel.collapsed;
          return;
        }
        // Check minimize button
        if (panel.isInMinimizeButton(point)) {
          this.minimizePanel(panel);
          return;
        }
        // Check close button
        if (panel.isInCloseButton && panel.isInCloseButton(point)) {
          if (panel.onCloseCallback) panel.onCloseCallback();
          this.unregisterPanel(panel.id);
          this.scene.root.remove(panel);
          return;
        }
        if (panel.isInHeader(point)) {
          this.dragTarget = panel;
          panel.startDrag(point);
          this.scene.root.remove(panel);
          this.scene.root.add(panel);
          break;
        }
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      const point = this.canvasPoint(e);

      if (this.contextMenu.isVisible()) {
        this.contextMenu.handleMove(point);
      }

      if (this.isPanning && this.panGraph) {
        this.panGraph.offsetX = this.panStartOffset.x + (point.x - this.panStart.x);
        this.panGraph.offsetY = this.panStartOffset.y + (point.y - this.panStart.y);
        return;
      }

      if (this.dragNode && this.dragGraph) {
        this.dragGraph.dragNode(this.dragNode, point.x, point.y);
      } else if (this.resizeTarget) {
        this.handleResize(point);
      } else if (this.dragTarget) {
        this.dragTarget.drag(point);
        const snapped = this.magneticSnap(this.dragTarget, this.dragTarget.position);
        this.dragTarget.position.x = snapped.x;
        this.dragTarget.position.y = snapped.y;
// Detect snap zone preview during drag        this.snapPreview = Panel.detectSnapZone(point, this.renderer.width, this.renderer.height);
      } else {
        const node = this.scene.findAt(point);
        if (node !== this.hoverTarget) {
          this.hoverTarget = node;
        }
        // Check for graph node or edge hover
        let cursorSet = false;
        for (const child of this.scene.root.children) {
          if (child instanceof Graph) {
            const hitNode = child.findNodeAt(point.x, point.y);
            if (hitNode) {
              child.hoveredEdge = null;
              canvas.style.cursor = "grab";
child.showTooltip(hitNode, point.x, point.y);
              cursorSet = true;
              break;
            }
            // Edge hover (only if no node is hit)
            const hitEdge = child.findEdgeAt(point.x, point.y, 10);
            if (hitEdge !== child.hoveredEdge) {
              child.hoveredEdge = hitEdge;
            }
            if (hitEdge) {
              canvas.style.cursor = "pointer";
              cursorSet = true;
            }
          }
        }
        if (!cursorSet) {
          // Clear edge hover if we left edges
          for (const child of this.scene.root.children) {
            if (child instanceof Graph) { child.hoveredEdge = null; child.hideTooltip(); }
          }
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
          if (!isResize) canvas.style.cursor = this.hoverTarget ? "pointer" : "default";
        }
      }
    });

    canvas.addEventListener("mouseup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.panGraph = null;
        const c = this.renderer["canvas"] as HTMLCanvasElement;
        c.style.cursor = "default";
      }
      if (this.dragTarget) {
// Apply snap zone if dragged to edge        if (this.snapPreview) {          this.dragTarget.snapTo(this.snapPreview, this.renderer.width, this.renderer.height);          this.snapPreview = null;        }
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

    // Wheel event: zoom graph or scroll panel
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const point = this.canvasPoint(e);

      const panel = this.panelAt(point);
      if (panel && typeof (panel as any).scroll === "function") {
        (panel as any).scroll(e.deltaY);
        return;
      }

      for (const child of this.scene.root.children) {
        if (child instanceof Graph) {
          child.applyZoom(e.deltaY, point.x, point.y);
          return;
        }
      }
    }, { passive: false });

    canvas.addEventListener("dblclick", (e) => {
      const point = this.canvasPoint(e);

      for (const child of this.scene.root.children) {
        if (child instanceof Graph) {
          const hitNode = child.findNodeAt(point.x, point.y);
          if (hitNode) {
            this.handleGraphNodeDblClick(child, hitNode);
            return;
          }
        }
      }

      const nodes = [...this.panels.values()].reverse();
      for (const panel of nodes) {
        if (panel.isInHeader(point)) {
          panel.collapsed = !panel.collapsed;
          break;
        }
      }
    });

    // --- Touch support ---
    let lastTouchTime = 0;
    let touchMoved = false;

    canvas.addEventListener("touchstart", (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        this.lastPinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        this.lastPinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchMoved = false;
      const now = Date.now();
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX, clientY: touch.clientY,
      });
      canvas.dispatchEvent(mouseEvent);
      if (now - lastTouchTime < 300) {
        const dblEvent = new MouseEvent("dblclick", {
          clientX: touch.clientX, clientY: touch.clientY,
        });
        canvas.dispatchEvent(dblEvent);
      }
      lastTouchTime = now;
    }, { passive: false });

    canvas.addEventListener("touchmove", (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (this.lastPinchDist > 0) {
          const rect = canvas.getBoundingClientRect();
          const canvasX = midX - rect.left;
          const canvasY = midY - rect.top;
          // Zoom from pinch distance change
          const delta = this.lastPinchDist - dist;
          // Pan from midpoint movement
          const panDx = midX - this.lastPinchMidX;
          const panDy = midY - this.lastPinchMidY;
          for (const child of this.scene.root.children) {
            if (child instanceof Graph) {
              child.applyZoom(delta, canvasX, canvasY);
              child.offsetX += panDx;
              child.offsetY += panDy;
            }
          }
        }
        this.lastPinchDist = dist;
        this.lastPinchMidX = midX;
        this.lastPinchMidY = midY;
        return;
      }

      if (e.touches.length !== 1) return;
      touchMoved = true;
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX, clientY: touch.clientY,
      });
      canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener("touchend", (e: TouchEvent) => {
      e.preventDefault();
      this.lastPinchDist = 0;
      // Use changedTouches to get the final position (touches is empty on touchend)
      const endTouch = e.changedTouches[0];
      const coords = endTouch ? { clientX: endTouch.clientX, clientY: endTouch.clientY } : {};
      canvas.dispatchEvent(new MouseEvent("mouseup", coords));
      // If no drag happened, also fire a click for detail panel detection
      if (!touchMoved && endTouch) {
        canvas.dispatchEvent(new MouseEvent("click", {
          clientX: endTouch.clientX, clientY: endTouch.clientY,
        }));
      }
    }, { passive: false });
  }

  /** Build context menu items based on what was right-clicked */
  private buildContextMenuItems(point: Vec2): MenuItem[] {
    for (const child of this.scene.root.children) {
      if (child instanceof Graph) {
        const hitNode = child.findNodeAt(point.x, point.y);
        if (hitNode) {
          return this.buildNodeContextMenu(child, hitNode);
        }
      }
    }
    // Check for edge right-click
    for (const child of this.scene.root.children) {
      if (child instanceof Graph) {
        const hitEdge = child.findEdgeAt(point.x, point.y, 10);
        if (hitEdge) {
          return this.buildEdgeContextMenu(child, hitEdge, point);
        }
      }
    }

    const panel = this.panelAt(point);
    if (panel) {
      return this.buildPanelContextMenu(panel);
    }
    return this.buildEmptyContextMenu();
  }

  private buildNodeContextMenu(graph: Graph, node: GraphNode): MenuItem[] {
    const area42 = (window as any).__area42;
    const expandedNodes: Set<string> = area42?.expandedNodes ?? new Set();
    const isExpanded = expandedNodes.has(node.id);

    return [
      { label: "Inspect", icon: "🔍", shortcut: "Click", action: () => { if (area42?.onNodeClick) area42.onNodeClick(node); } },
      { label: isExpanded ? "Collapse" : "Expand", icon: isExpanded ? "📦" : "📤", shortcut: "Dbl-click", action: () => { if (isExpanded) { graph.collapse(node.id); expandedNodes.delete(node.id); } else { this.handleGraphNodeDblClick(graph, node); } } },
      { label: node.pinned ? "Unpin" : "Pin", icon: "📌", action: () => { node.pinned = !node.pinned; if (!node.pinned) graph.reheat(0.3); } },
      { label: node.selected ? "Deselect" : "Select", icon: "✔", shortcut: "Shift+Click", action: () => { graph.toggleSelection(node.id); } },
      { label: "", separator: true, action: () => {} },
      { label: "Hide", icon: "🚫", color: NeonTheme.danger, action: () => { graph.removeNode(node.id); graph.reheat(0.2); } },
    ];
  }

  private buildEdgeContextMenu(graph: Graph, edge: GraphEdge, point: Vec2): MenuItem[] {
    const area42 = (window as any).__area42;
    return [
      {
        label: "Inspect",
        icon: "\ud83d\udd0d",
        shortcut: "Click",
        action: () => {
          if (edge.detail && area42?.onEdgeClick) {
            area42.onEdgeClick(edge, point);
          }
        },
      },
      {
        label: "Highlight path",
        icon: "\u2728",
        action: () => {
          graph.clearSelection();
          edge.selected = !edge.selected;
          const fromNode = graph.getNode(edge.from);
          const toNode = graph.getNode(edge.to);
          if (fromNode) fromNode.selected = edge.selected;
          if (toNode) toNode.selected = edge.selected;
        },
      },
      {
        label: "Show traffic",
        icon: "\ud83d\ude80",
        action: () => {
          edge.particles = !edge.particles;
        },
      },
    ];
  }

  private buildPanelContextMenu(panel: Panel): MenuItem[] {
    return [
      { label: panel.collapsed ? "Expand" : "Collapse", icon: panel.collapsed ? "▼" : "▲", action: () => { panel.collapsed = !panel.collapsed; } },
{ label: panel.minimized ? "Restore" : "Minimize", icon: panel.minimized ? "u25a1" : "u2014", action: () => { if (panel.minimized) this.restoreFromDock(panel); else this.minimizePanel(panel); } },
      { label: "Close", icon: "×", shortcut: "Del", action: () => { if (typeof (panel as any).onCloseCallback === "function") { (panel as any).onCloseCallback(); } else { panel.visible = false; } } },
      { label: "", separator: true, action: () => {} },
      { label: "Reset Position", icon: "↺", action: () => { panel.position.x = 50; panel.position.y = 50; } },
    ];
  }

  private buildEmptyContextMenu(): MenuItem[] {
    return [
      { label: "Reset Layout", icon: "↻", shortcut: "R", action: () => { for (const child of this.scene.root.children) { if (child instanceof Graph) { child.resetPositions(); } } } },
      { label: "Clear Selection", icon: "✖", shortcut: "Esc", action: () => { for (const child of this.scene.root.children) { if (child instanceof Graph) { child.clearSelection(); } } } },
      { label: "Save Positions", icon: "💾", action: () => { for (const child of this.scene.root.children) { if (child instanceof Graph) { child.savePositions(); } } } },
      { label: "", separator: true, action: () => {} },
      { label: this.gridVisible ? "Hide Grid" : "Show Grid", icon: "#", shortcut: "G", action: () => { this.gridVisible = !this.gridVisible; } },
      { label: "", separator: true, action: () => {} },
      { label: "Screenshot (PNG)", icon: "D83dDcf7", action: () => { this._exporter?.downloadPNG(); } },
      { label: "Export Graph as JSON", icon: "D83dDcc4", action: () => { for (const child of this.scene.root.children) { if (child instanceof Graph) { this._exporter?.downloadJSON(child); break; } } } },
    ];
  }

  /** Handle keyboard shortcuts */
  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key;

    // Command palette takes priority
    if (this._commandPalette.handleKey(key, e.ctrlKey, e.metaKey)) {
      e.preventDefault();
      return;
    }

    if (key === "Escape") {
      if (this.contextMenu.isVisible()) { this.contextMenu.hide(); return; }
      if (this.helpOverlay.isVisible()) { this.helpOverlay.hide(); return; }
      for (const child of this.scene.root.children) { if (child instanceof Graph) { child.clearSelection(); } }
      for (const [, panel] of this.panels) {
        if (panel.closable && panel.visible && panel.id.startsWith("detail")) { panel.visible = false; }
      }
      return;
    }

    if (key === "?" || (key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey)) {
      this.helpOverlay.toggle();
      return;
    }

    if (this.helpOverlay.isVisible()) return;

    if (key === "Delete" || key === "Backspace") {
      const panelArr = [...this.panels.values()];
      if (panelArr.length > 0) {
        const last = panelArr[panelArr.length - 1];
        if (last.closable) {
          if (typeof (last as any).onCloseCallback === "function") { (last as any).onCloseCallback(); } else { last.visible = false; }
        }
      }
      return;
    }

    if (key === " ") {
      e.preventDefault();
      for (const child of this.scene.root.children) { if (child instanceof Graph) { child.toggleSimulation(); } }
      return;
    }

    if (key === "f" || key === "F") {
      for (const child of this.scene.root.children) { if (child instanceof Graph) { child.fitToView(); } }
      return;
    }

    if (key === "g" || key === "G") {
      this.gridVisible = !this.gridVisible;
      return;
    }

    if (key === "r" || key === "R") {
      for (const child of this.scene.root.children) { if (child instanceof Graph) { child.resetPositions(); } }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (key === "a" || key === "A")) {
      e.preventDefault();
      for (const child of this.scene.root.children) { if (child instanceof Graph) { child.selectAll(); } }
      return;
    }

    if (key >= "1" && key <= "5") {
      const idx = parseInt(key) - 1;
      const panelArr = [...this.panels.values()].filter(p => p.visible);
      if (idx < panelArr.length) {
        const panel = panelArr[idx];
        this.scene.root.remove(panel);
        this.scene.root.add(panel);
      }
      return;
    }
  }

  /** Handle double-click on a graph node: expand or collapse drill-down */
  private handleGraphNodeDblClick(graph: Graph, node: GraphNode) {
    const area42 = (window as any).__area42;
    const expandedNodes: Set<string> = area42?.expandedNodes ?? new Set();

    const nodeId = node.id;

    if (node.parentId) {
      const parentId = node.parentId;
      graph.collapse(parentId);
      expandedNodes.delete(parentId);
      return;
    }

    if (expandedNodes.has(nodeId)) {
      graph.collapse(nodeId);
      expandedNodes.delete(nodeId);
    } else {
      // Use expandAsync which calls the onExpand callback for dynamic data
      graph.expandAsync(nodeId).then(() => {
        if (node.childIds && node.childIds.length > 0) {
          expandedNodes.add(nodeId);
        }
      });
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

  /** Render the dock bar for minimized panels */
  private renderDockBar(ctx: CanvasRenderingContext2D, w: number, h: number, panels: Panel[]): void {
    const statusH = this._statusBar.getHeight();
    const dockY = h - statusH - this.dockBarHeight;
    const btnW = this.dockButtonWidth;
    const btnH = this.dockBarHeight - 4;
    const gap = 6;
    const pad = 10;

    // Dock bar background
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 23, 0.85)";
    ctx.fillRect(0, dockY, w, this.dockBarHeight);
    ctx.strokeStyle = "rgba(123, 104, 238, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, dockY);
    ctx.lineTo(w, dockY);
    ctx.stroke();

    // Dock buttons
    let bx = pad;
    for (const panel of panels) {
      const by = dockY + 2;

      // Button background
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.moveTo(bx + 4, by);
      ctx.lineTo(bx + btnW - 4, by);
      ctx.quadraticCurveTo(bx + btnW, by, bx + btnW, by + 4);
      ctx.lineTo(bx + btnW, by + btnH - 4);
      ctx.quadraticCurveTo(bx + btnW, by + btnH, bx + btnW - 4, by + btnH);
      ctx.lineTo(bx + 4, by + btnH);
      ctx.quadraticCurveTo(bx, by + btnH, bx, by + btnH - 4);
      ctx.lineTo(bx, by + 4);
      ctx.quadraticCurveTo(bx, by, bx + 4, by);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(123, 104, 238, 0.15)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Color dot
      const dotColor = panel.titleColor || "#7b68ee";
      ctx.beginPath();
      ctx.arc(bx + 12, by + btnH / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      ctx.shadowColor = dotColor;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Title text (truncated)
      ctx.fillStyle = "#c8d6e5";
      ctx.font = "10px system-ui";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      let title = panel.title;
      const maxTextW = btnW - 30;
      while (title.length > 3 && ctx.measureText(title).width > maxTextW) {
        title = title.slice(0, -1);
      }
      if (title !== panel.title) title += "...";
      ctx.fillText(title, bx + 22, by + btnH / 2);

      bx += btnW + gap;
    }

    ctx.restore();
  }

  /** Check if a click hits a dock bar button and return the panel */
  private dockButtonAt(point: { x: number; y: number }): Panel | null {
    const panels = this.getMinimizedPanels();
    if (panels.length === 0) return null;

    const statusH = this._statusBar.getHeight();
    const dockY = this.renderer.height - statusH - this.dockBarHeight;
    const btnW = this.dockButtonWidth;
    const btnH = this.dockBarHeight - 4;
    const gap = 6;
    const pad = 10;

    if (point.y < dockY || point.y > dockY + this.dockBarHeight) return null;

    let bx = pad;
    for (const panel of panels) {
      if (point.x >= bx && point.x <= bx + btnW) {
        return panel;
      }
      bx += btnW + gap;
    }
    return null;
  }

  /** Update analysis based on current graph selection */
  private updateAnalysis(): void {
    for (const child of this.scene.root.children) {
      if (child instanceof Graph) {
        const selected = child.getNodes().filter((n: GraphNode) => n.selected);
        if (selected.length >= 2) {
          this.analysisResult = analyzeSelection(child, selected);
          return;
        }
      }
    }
    this.analysisResult = null;
  }

  /** Render analysis overlay panel */
  private renderAnalysisOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.analysisResult) return;

    const panelW = 260;
    const panelH = Math.min(350, h - 100);
    const px = w - panelW - 16;
    const py = 60;
    const r = 8;

    ctx.save();

    // Glass background
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + panelW - r, py);
    ctx.quadraticCurveTo(px + panelW, py, px + panelW, py + r);
    ctx.lineTo(px + panelW, py + panelH - r);
    ctx.quadraticCurveTo(px + panelW, py + panelH, px + panelW - r, py + panelH);
    ctx.lineTo(px + r, py + panelH);
    ctx.quadraticCurveTo(px, py + panelH, px, py + panelH - r);
    ctx.lineTo(px, py + r);
    ctx.quadraticCurveTo(px, py, px + r, py);
    ctx.closePath();
    ctx.fillStyle = "rgba(10, 14, 23, 0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 212, 170, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top accent line
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, panelW, 1.5);
    ctx.clip();
    const grad = ctx.createLinearGradient(px, py, px + panelW, py);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, "rgba(0, 212, 170, 0.5)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, panelW, 1.5);
    ctx.restore();

    // Content
    renderAnalysis(ctx, this.analysisResult, px + 10, py + 10, panelW - 20, panelH - 20);

    ctx.restore();
  }

  /** Destroy the HUD */
  destroy() {
    this.renderer.destroy();
  }
}


