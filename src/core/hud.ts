/**
 * Area42 HUD — Main entry point
 *
 * Creates a full-screen (or container-bound) heads-up display with
 * floating glass panels, animated graphs, and real-time data streams.
 */

import { Renderer, RenderContext } from "./renderer.js";
import { Scene, SceneNode, Vec2 } from "./scene.js";
import { Panel, PanelOptions } from "../panels/panel.js";
import { Theme, NeonTheme } from "../themes/neon.js";

export interface HUDOptions {
  theme?: Theme | "neon" | "glass";
  fps?: number;
  background?: boolean;
}

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
    if (!el) throw new Error(`Area42: container not found: ${selector}`);
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
    ctx.strokeStyle = "rgba(255,255,255,0.015)";
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

  /** Mouse interaction setup */
  private setupInteractions() {
    const canvas = this.renderer["canvas"] as HTMLCanvasElement;

    canvas.addEventListener("mousedown", (e) => {
      const point = this.canvasPoint(e);
      // Check panels (reverse order = front first)
      const nodes = [...this.panels.values()].reverse();
      for (const panel of nodes) {
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
      if (this.dragTarget) {
        this.dragTarget.drag(point);
      } else {
        // Hover detection
        const node = this.scene.findAt(point);
        if (node !== this.hoverTarget) {
          this.hoverTarget = node;
          canvas.style.cursor = node ? "pointer" : "default";
        }
      }
    });

    canvas.addEventListener("mouseup", () => {
      if (this.dragTarget) {
        this.dragTarget.endDrag();
        this.dragTarget = null;
      }
    });

    canvas.addEventListener("dblclick", (e) => {
      const point = this.canvasPoint(e);
      const nodes = [...this.panels.values()].reverse();
      for (const panel of nodes) {
        if (panel.isInHeader(point)) {
          panel.collapsed = !panel.collapsed;
          break;
        }
      }
    });
  }

  private canvasPoint(e: MouseEvent): Vec2 {
    const rect = this.container.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Destroy the HUD */
  destroy() {
    this.renderer.destroy();
  }
}
