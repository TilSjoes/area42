/**
 * Area42 Glass Panel
 *
 * Floating, draggable, semi-transparent panel with glass morphism effect.
 * The signature UI element of Area42.
 */

import { SceneNode, Vec2 } from "../core/scene.js";

export interface PanelOptions {
  id?: string;
  title: string;
  position?: Vec2;
  size?: Vec2;
  glass?: boolean;
  collapsed?: boolean;
  closable?: boolean;
  dockable?: boolean;
  color?: string;
  titleColor?: string;
  compact?: boolean;
}

export class Panel extends SceneNode {
  title: string;
  glass: boolean;
  collapsed: boolean;
  closable: boolean;
  dockable: boolean;
  color: string;
  titleColor: string;
  compact: boolean;
  onCloseCallback: (() => void) | null = null;

  private headerHeight = 28;
  private cornerRadius = 8;
  private dragging = false;
  private dragOffset: Vec2 = { x: 0, y: 0 };

  // Content render callback
  private contentRenderer: ((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void) | null = null;

  constructor(options: PanelOptions) {
    super({
      id: options.id,
      position: options.position || { x: 50, y: 50 },
      size: options.size || { x: 300, y: 200 },
    });
    this.title = options.title;
    this.glass = options.glass ?? true;
    this.collapsed = options.collapsed ?? false;
    this.closable = options.closable ?? true;
    this.dockable = options.dockable ?? true;
    this.color = options.color || "rgba(123, 104, 238, 0.15)";
    this.titleColor = options.titleColor || "#7b68ee";
    this.compact = options.compact ?? false;

    if (this.compact) {
      this.headerHeight = 22;
      this.cornerRadius = 6;
    }
  }

  /** Set a callback for when the close button is clicked */
  onClose(callback: () => void) {
    this.onCloseCallback = callback;
    return this;
  }

  onContent(renderer: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void) {
    this.contentRenderer = renderer;
    return this;
  }

  render(ctx: CanvasRenderingContext2D) {
    const { x, y } = { x: 0, y: 0 }; // relative to parent
    const w = this.size.x;
    const h = this.collapsed ? this.headerHeight : this.size.y;
    const r = this.cornerRadius;

    const titleFont = this.compact ? "bold 9px system-ui, -apple-system, sans-serif" : "bold 10px system-ui, -apple-system, sans-serif";
    const titleLetterSpacing = this.compact ? "1px" : "1.5px";

    // Glass background
    ctx.save();
    this.roundRect(ctx, x, y, w, h, r);
    if (this.glass) {
      ctx.fillStyle = "rgba(10, 14, 23, 0.75)";
      ctx.fill();
      ctx.strokeStyle = "rgba(123, 104, 238, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(19, 26, 43, 0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(30, 45, 74, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Top gradient line
    ctx.save();
    this.roundRect(ctx, x, y, w, 1.5, r);
    ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "transparent");
    // Handle both hex (#ff6b6b) and rgba() color formats
    let gradColor = this.titleColor;
    if (gradColor.startsWith("#")) {
      gradColor = gradColor + "88";
    } else if (gradColor.startsWith("rgb")) {
      gradColor = gradColor.replace(/[\d.]+\)\$/, "0.5)");
    }
    grad.addColorStop(0.5, gradColor);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, 1.5);
    ctx.restore();

    // Title bar
    ctx.fillStyle = this.titleColor;
    ctx.font = titleFont;
    ctx.textBaseline = "middle";
    ctx.letterSpacing = titleLetterSpacing;
    ctx.fillText(this.title.toUpperCase(), x + (this.compact ? 8 : 12), y + this.headerHeight / 2);

    // Close button
    if (this.closable) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = this.compact ? "10px system-ui" : "12px system-ui";
      ctx.textAlign = "right";
      ctx.fillText("\u00d7", x + w - 10, y + this.headerHeight / 2);
      ctx.textAlign = "left";
    }

    // Header separator
    if (!this.collapsed) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, y + this.headerHeight);
      ctx.lineTo(x + w, y + this.headerHeight);
      ctx.stroke();

      // Content area
      if (this.contentRenderer) {
        ctx.save();
        ctx.beginPath();
        const pad = this.compact ? 4 : 8;
        ctx.rect(x + 1, y + this.headerHeight + 1, w - 2, h - this.headerHeight - 2);
        ctx.clip();
        this.contentRenderer(ctx, x + pad, y + this.headerHeight + pad, w - pad * 2, h - this.headerHeight - pad * 2);
        ctx.restore();
      }
    }

    ctx.restore();

    // Resize handle (bottom-right corner)
    if (!this.collapsed) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      const hx = w - 4, hy = h - 4;
      ctx.beginPath();
      ctx.moveTo(x + hx - 8, y + hy);
      ctx.lineTo(x + hx, y + hy - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + hx - 4, y + hy);
      ctx.lineTo(x + hx, y + hy - 4);
      ctx.stroke();
      ctx.restore();
    }

    // Ambient glow effect
    if (this.glass) {
      ctx.save();
      ctx.shadowColor = this.titleColor;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.05;
      this.roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Drag handling
  startDrag(point: Vec2) {
    this.dragging = true;
    const wp = this.worldPosition();
    this.dragOffset = { x: point.x - wp.x, y: point.y - wp.y };
  }

  drag(point: Vec2) {
    if (this.dragging) {
      this.position.x = point.x - this.dragOffset.x;
      this.position.y = point.y - this.dragOffset.y;
    }
  }

  endDrag() {
    this.dragging = false;
  }

  isInHeader(point: Vec2): boolean {
    const wp = this.worldPosition();
    return point.x >= wp.x && point.x <= wp.x + this.size.x &&
           point.y >= wp.y && point.y <= wp.y + this.headerHeight;
  }
}
