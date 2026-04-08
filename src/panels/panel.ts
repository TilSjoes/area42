/**
 * Area42 Glass Panel
 *
 * Floating, draggable, semi-transparent panel with glass morphism effect.
 * The signature UI element of Area42.
 * Supports minimize-to-icon and edge snap zones.
 */

import { SceneNode, Vec2 } from "../core/scene.js";
import { withAlpha } from "../core/color.js";

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

/** Snap zone identifiers for edge-docking */
export type SnapZone = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;

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

  /** Minimized state: panel shrinks to a small icon dot */
  minimized = false;
  /** Saved position/size before minimize, for restoration */
  preMinimizePosition: { x: number; y: number } | null = null;
  preMinimizeSize: { x: number; y: number } | null = null;
  private minimizedDotSize = 24;

  /** Saved position/size before snapping, for restore */
  private preSnapPosition: Vec2 | null = null;
  private preSnapSize: Vec2 | null = null;

  /** Current snap zone (null = floating) */
  snapZone: SnapZone = null;

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

  /** Minimize panel to a small icon dot */
  minimize(): void {
    if (!this.minimized) {
      this.preMinimizePosition = { x: this.position.x, y: this.position.y };
      this.preMinimizeSize = { x: this.size.x, y: this.size.y };
      this.minimized = true;
    }
  }

  /** Restore panel from minimized state */
  restore(): void {
    if (this.minimized) {
      if (this.preMinimizePosition && this.preMinimizeSize) {
        this.position.x = this.preMinimizePosition.x;
        this.position.y = this.preMinimizePosition.y;
        this.size.x = this.preMinimizeSize.x;
        this.size.y = this.preMinimizeSize.y;
      }
      this.minimized = false;
    }
  }

  /** Snap panel to a zone within a container of given dimensions */
  snapTo(zone: SnapZone, containerW: number, containerH: number): void {
    if (zone === null) {
      // Unsnap: restore previous position/size
      if (this.preSnapPosition && this.preSnapSize) {
        this.position.x = this.preSnapPosition.x;
        this.position.y = this.preSnapPosition.y;
        this.size.x = this.preSnapSize.x;
        this.size.y = this.preSnapSize.y;
      }
      this.snapZone = null;
      return;
    }

    // Save pre-snap state (only if not already snapped)
    if (!this.snapZone) {
      this.preSnapPosition = { x: this.position.x, y: this.position.y };
      this.preSnapSize = { x: this.size.x, y: this.size.y };
    }

    const margin = 4;
    const halfW = (containerW - margin * 3) / 2;
    const halfH = (containerH - margin * 3) / 2;

    switch (zone) {
      case 'top':
        this.position.x = margin;
        this.position.y = margin;
        this.size.x = containerW - margin * 2;
        this.size.y = halfH;
        break;
      case 'bottom':
        this.position.x = margin;
        this.position.y = halfH + margin * 2;
        this.size.x = containerW - margin * 2;
        this.size.y = halfH;
        break;
      case 'left':
        this.position.x = margin;
        this.position.y = margin;
        this.size.x = halfW;
        this.size.y = containerH - margin * 2;
        break;
      case 'right':
        this.position.x = halfW + margin * 2;
        this.position.y = margin;
        this.size.x = halfW;
        this.size.y = containerH - margin * 2;
        break;
      case 'top-left':
        this.position.x = margin;
        this.position.y = margin;
        this.size.x = halfW;
        this.size.y = halfH;
        break;
      case 'top-right':
        this.position.x = halfW + margin * 2;
        this.position.y = margin;
        this.size.x = halfW;
        this.size.y = halfH;
        break;
      case 'bottom-left':
        this.position.x = margin;
        this.position.y = halfH + margin * 2;
        this.size.x = halfW;
        this.size.y = halfH;
        break;
      case 'bottom-right':
        this.position.x = halfW + margin * 2;
        this.position.y = halfH + margin * 2;
        this.size.x = halfW;
        this.size.y = halfH;
        break;
    }

    this.snapZone = zone;
  }

  /** Detect which snap zone a position falls into, given container dimensions */
  static detectSnapZone(point: Vec2, containerW: number, containerH: number, threshold: number = 30): SnapZone {
    const nearTop = point.y < threshold;
    const nearBottom = point.y > containerH - threshold;
    const nearLeft = point.x < threshold;
    const nearRight = point.x > containerW - threshold;

    if (nearTop && nearLeft) return 'top-left';
    if (nearTop && nearRight) return 'top-right';
    if (nearBottom && nearLeft) return 'bottom-left';
    if (nearBottom && nearRight) return 'bottom-right';
    if (nearTop) return 'top';
    if (nearBottom) return 'bottom';
    if (nearLeft) return 'left';
    if (nearRight) return 'right';
    return null;
  }

  render(ctx: CanvasRenderingContext2D) {
    // Minimized: render as a small colored dot with title initial
    if (this.minimized) {
      this.renderMinimizedDot(ctx);
      return;
    }

    const { x, y } = { x: 0, y: 0 };
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
    let gradColor = this.titleColor;
    if (gradColor.startsWith("#")) {
      gradColor = withAlpha(gradColor, "88");
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

    // Panel control buttons (right side of header)
    if (this.closable) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = this.compact ? "10px system-ui" : "12px system-ui";
      ctx.textAlign = "center";

      // Collapse/expand button (triangle)
      const colX = x + w - 42;
      ctx.fillText(this.collapsed ? "\u25BC" : "\u25B2", colX, y + this.headerHeight / 2);

      // Minimize button (en-dash)
      const minX = x + w - 26;
      ctx.fillText("\u2013", minX, y + this.headerHeight / 2);

      // Close button (×)
      const clsX = x + w - 10;
      ctx.fillText("\u00d7", clsX, y + this.headerHeight / 2);

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
      ctx.shadowColor = this.titleColor.startsWith("#") ? this.titleColor : "#7b68ee";
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.05;
      this.roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Render the minimized dot icon */
  private renderMinimizedDot(ctx: CanvasRenderingContext2D): void {
    const s = this.minimizedDotSize;
    const cx = s / 2;
    const cy = s / 2;
    const r = s / 2 - 2;

    // Glow
    ctx.save();
    ctx.shadowColor = this.titleColor.startsWith("#") ? this.titleColor : "#7b68ee";
    ctx.shadowBlur = 12;

    // Circle background
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10, 14, 23, 0.85)";
    ctx.fill();
    ctx.strokeStyle = this.titleColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Title initial
    ctx.fillStyle = this.titleColor;
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.title.charAt(0).toUpperCase(), cx, cy);

    ctx.restore();
  }

  /** Override contains for minimized hit testing */
  override contains(point: Vec2): boolean {
    if (this.minimized) {
      const wp = this.worldPosition();
      const s = this.minimizedDotSize;
      return point.x >= wp.x && point.x <= wp.x + s &&
             point.y >= wp.y && point.y <= wp.y + s;
    }
    return super.contains(point);
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
    if (this.minimized) return false;
    const wp = this.worldPosition();
    return point.x >= wp.x && point.x <= wp.x + this.size.x &&
           point.y >= wp.y && point.y <= wp.y + this.headerHeight;
  }

  /** Check if a point hits the collapse button */
  isInCollapseButton(point: Vec2): boolean {
    if (this.minimized || !this.closable) return false;
    const wp = this.worldPosition();
    const btnX = wp.x + this.size.x - 50;
    const btnY = wp.y;
    return point.x >= btnX && point.x <= btnX + 16 &&
           point.y >= btnY && point.y <= btnY + this.headerHeight;
  }

  /** Check if a point hits the close button */
  isInCloseButton(point: Vec2): boolean {
    if (this.minimized || !this.closable) return false;
    const wp = this.worldPosition();
    const btnX = wp.x + this.size.x - 18;
    const btnY = wp.y;
    return point.x >= btnX && point.x <= btnX + 16 &&
           point.y >= btnY && point.y <= btnY + this.headerHeight;
  }

  /** Check if a point hits the minimize button */
  isInMinimizeButton(point: Vec2): boolean {
    if (this.minimized || !this.closable) return false;
    const wp = this.worldPosition();
    const btnX = wp.x + this.size.x - 34;
    const btnY = wp.y;
    return point.x >= btnX && point.x <= btnX + 16 &&
           point.y >= btnY && point.y <= btnY + this.headerHeight;
  }
}
