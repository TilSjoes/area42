/**
 * Area42 Canvas Renderer
 * 
 * Dual-layer rendering: Canvas 2D for shapes/text, WebGL for effects.
 * Uses requestAnimationFrame for smooth 60fps animation.
 */

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  time: number;
  deltaTime: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private lastTime = 0;
  private renderCallbacks: Array<(ctx: RenderContext) => void> = [];

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    container.style.position = "relative";
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  get width() { return this.canvas.width / (window.devicePixelRatio || 1); }
  get height() { return this.canvas.height / (window.devicePixelRatio || 1); }

  onRender(callback: (ctx: RenderContext) => void) {
    this.renderCallbacks.push(callback);
  }

  start() {
    const loop = (time: number) => {
      const deltaTime = time - this.lastTime;
      this.lastTime = time;

      this.ctx.clearRect(0, 0, this.width, this.height);

      const rc: RenderContext = {
        canvas: this.canvas,
        ctx: this.ctx,
        width: this.width,
        height: this.height,
        dpr: window.devicePixelRatio || 1,
        time,
        deltaTime,
      };

      for (const cb of this.renderCallbacks) {
        cb(rc);
      }

      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    this.canvas.remove();
  }
}
