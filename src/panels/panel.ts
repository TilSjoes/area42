/**
 * Area42 Glass Panel — v2.2 Container with pointer events
 *
 * v2: Panel is a Container with overflow:"hidden", auto-clipping.
 * v2.2: Panel owns its interactions — header buttons, drag, resize.
 *       The HUD just routes findAt() results to Panel.onPointerDown().
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
  clip?: boolean;
  locked?: boolean;
}

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
  /** v2.2: When locked, panel cannot be dragged or resized */
  locked: boolean;

  /** Check lock state — respects both per-panel and global lock */
  get isLocked(): boolean {
    return this.locked || !!(globalThis as any).__area42_panels_locked;
  }

  minimized = false;
  preMinimizePosition: { x: number; y: number } | null = null;
  preMinimizeSize: { x: number; y: number } | null = null;
  private minimizedDotSize = 24;

  private preSnapPosition: Vec2 | null = null;
  private preSnapSize: Vec2 | null = null;
  snapZone: SnapZone = null;

  headerHeight = 28;
  private cornerRadius = 8;

  // v2.2: Internal drag/resize state (owned by Panel, not HUD)
  private _dragging = false;
  private _dragOffset: Vec2 = { x: 0, y: 0 };
  private _resizing = false;
  private _resizeStart: Vec2 = { x: 0, y: 0 };
  private _resizeStartSize: Vec2 = { x: 0, y: 0 };

  // v1 backward compat
  private contentRenderer: ((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void) | null = null;

  constructor(options: PanelOptions) {
    super({
      id: options.id,
      position: options.position || { x: 50, y: 50 },
      size: options.size || { x: 300, y: 200 },
      overflow: (options.clip !== false) ? "hidden" : "visible",
    });
    this.title = options.title;
    this.glass = options.glass ?? true;
    this.collapsed = options.collapsed ?? false;
    this.closable = options.closable ?? true;
    this.dockable = options.dockable ?? true;
    this.color = options.color || "rgba(123, 104, 238, 0.15)";
    this.titleColor = options.titleColor || "#7b68ee";
    this.compact = options.compact ?? false;
    this.locked = options.locked ?? false;

    if (this.compact) {
      this.headerHeight = 22;
      this.cornerRadius = 6;
    }

    this.updateContentGeometry();
  }

  // --- v2.2: Pointer event handlers ---

  onPointerDown(localPoint: Vec2, e: MouseEvent): boolean {
    if (this.minimized) {
      // Click on minimized dot — restore
      return true; // consumed, HUD handles restore via callback
    }

    const w = this.size.x;
    const hh = this.headerHeight;

    // Header button zone: right side of header
    if (this.closable && localPoint.y < hh) {
      // Close button: rightmost 16px
      if (localPoint.x >= w - 18 && localPoint.x <= w - 2) {
        if (this.onCloseCallback) this.onCloseCallback();
        else this.visible = false;
        return true;
      }
      // Minimize button
      if (localPoint.x >= w - 34 && localPoint.x <= w - 18) {
        this.minimize();
        return true;
      }
      // Collapse button
      if (localPoint.x >= w - 50 && localPoint.x <= w - 34) {
        this.collapsed = !this.collapsed;
        this.updateContentGeometry();
        return true;
      }
    }

    // Resize handle: bottom-right 12x12 corner
    if (!this.collapsed && !this.isLocked) {
      if (localPoint.x >= w - 12 && localPoint.y >= this.size.y - 12) {
        this._resizing = true;
        const wp = this.worldPosition();
        this._resizeStart = { x: wp.x + localPoint.x, y: wp.y + localPoint.y };
        this._resizeStartSize = { x: this.size.x, y: this.size.y };
        return true;
      }
    }

    // Header drag
    if (localPoint.y < hh && !this.isLocked) {
      this._dragging = true;
      this._dragOffset = { x: localPoint.x, y: localPoint.y };
      return true;
    }

    // Click in content area — don't consume, let children handle via tree
    return false;
  }

  onPointerMove(worldPoint: Vec2, _e: MouseEvent): void {
    if (this._dragging) {
      this.position.x = worldPoint.x - this._dragOffset.x;
      this.position.y = worldPoint.y - this._dragOffset.y;
    }
    if (this._resizing) {
      const dx = worldPoint.x - this._resizeStart.x;
      const dy = worldPoint.y - this._resizeStart.y;
      this.size.x = Math.max(150, this._resizeStartSize.x + dx);
      this.size.y = Math.max(80, this._resizeStartSize.y + dy);
      this.updateContentGeometry();
    }
  }

  onPointerUp(_worldPoint: Vec2, _e: MouseEvent): void {
    this._dragging = false;
    this._resizing = false;
  }

  /** Check if panel is currently being interacted with (drag or resize) */
  isInteracting(): boolean {
    return this._dragging || this._resizing;
  }

  // --- Content geometry ---

  private updateContentGeometry() {
    if (this.collapsed || this.minimized) {
      this.contentSize = { x: 0, y: 0 };
      return;
    }
    const pad = this.compact ? 4 : 8;
    this.contentOffset = {
      x: pad,
      y: this.headerHeight + pad,
    };
    this.contentSize = {
      x: this.size.x - pad * 2,
      y: this.size.y - this.headerHeight - pad * 2,
    };
  }

  getContentSize(): { width: number; height: number } {
    const pad = this.compact ? 4 : 8;
    return {
      width: this.size.x - pad * 2,
      height: this.size.y - this.headerHeight - pad * 2,
    };
  }

  // --- API ---

  onClose(callback: () => void) {
    this.onCloseCallback = callback;
    return this;
  }

  onContent(renderer: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void) {
    this.contentRenderer = renderer;
    return this;
  }

  minimize(): void {
    if (!this.minimized) {
      this.preMinimizePosition = { x: this.position.x, y: this.position.y };
      this.preMinimizeSize = { x: this.size.x, y: this.size.y };
      this.minimized = true;
      this.updateContentGeometry();
    }
  }

  restore(): void {
    if (this.minimized) {
      if (this.preMinimizePosition && this.preMinimizeSize) {
        this.position.x = this.preMinimizePosition.x;
        this.position.y = this.preMinimizePosition.y;
        this.size.x = this.preMinimizeSize.x;
        this.size.y = this.preMinimizeSize.y;
      }
      this.minimized = false;
      this.updateContentGeometry();
    }
  }

  snapTo(zone: SnapZone, containerW: number, containerH: number): void {
    if (zone === null) {
      if (this.preSnapPosition && this.preSnapSize) {
        this.position.x = this.preSnapPosition.x;
        this.position.y = this.preSnapPosition.y;
        this.size.x = this.preSnapSize.x;
        this.size.y = this.preSnapSize.y;
      }
      this.snapZone = null;
      this.updateContentGeometry();
      return;
    }

    if (!this.snapZone) {
      this.preSnapPosition = { x: this.position.x, y: this.position.y };
      this.preSnapSize = { x: this.size.x, y: this.size.y };
    }

    const margin = 4;
    const halfW = (containerW - margin * 3) / 2;
    const halfH = (containerH - margin * 3) / 2;

    switch (zone) {
      case 'top':
        this.position.x = margin; this.position.y = margin;
        this.size.x = containerW - margin * 2; this.size.y = halfH; break;
      case 'bottom':
        this.position.x = margin; this.position.y = halfH + margin * 2;
        this.size.x = containerW - margin * 2; this.size.y = halfH; break;
      case 'left':
        this.position.x = margin; this.position.y = margin;
        this.size.x = halfW; this.size.y = containerH - margin * 2; break;
      case 'right':
        this.position.x = halfW + margin * 2; this.position.y = margin;
        this.size.x = halfW; this.size.y = containerH - margin * 2; break;
      case 'top-left':
        this.position.x = margin; this.position.y = margin;
        this.size.x = halfW; this.size.y = halfH; break;
      case 'top-right':
        this.position.x = halfW + margin * 2; this.position.y = margin;
        this.size.x = halfW; this.size.y = halfH; break;
      case 'bottom-left':
        this.position.x = margin; this.position.y = halfH + margin * 2;
        this.size.x = halfW; this.size.y = halfH; break;
      case 'bottom-right':
        this.position.x = halfW + margin * 2; this.position.y = halfH + margin * 2;
        this.size.x = halfW; this.size.y = halfH; break;
    }

    this.snapZone = zone;
    this.updateContentGeometry();
  }

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

  // --- Backward-compat drag API (used by old HUD code, kept for transition) ---

  startDrag(point: Vec2) {
    this._dragging = true;
    const wp = this.worldPosition();
    this._dragOffset = { x: point.x - wp.x, y: point.y - wp.y };
  }

  drag(point: Vec2) {
    if (this._dragging) {
      this.position.x = point.x - this._dragOffset.x;
      this.position.y = point.y - this._dragOffset.y;
    }
  }

  endDrag() {
    this._dragging = false;
  }

  isInHeader(point: Vec2): boolean {
    if (this.minimized) return false;
    const wp = this.worldPosition();
    return point.x >= wp.x && point.x <= wp.x + this.size.x &&
           point.y >= wp.y && point.y <= wp.y + this.headerHeight;
  }

  isInCollapseButton(point: Vec2): boolean {
    if (this.minimized || !this.closable) return false;
    const wp = this.worldPosition();
    const btnX = wp.x + this.size.x - 50;
    return point.x >= btnX && point.x <= btnX + 16 &&
           point.y >= wp.y && point.y <= wp.y + this.headerHeight;
  }

  isInCloseButton(point: Vec2): boolean {
    if (this.minimized || !this.closable) return false;
    const wp = this.worldPosition();
    const btnX = wp.x + this.size.x - 18;
    return point.x >= btnX && point.x <= btnX + 16 &&
           point.y >= wp.y && point.y <= wp.y + this.headerHeight;
  }

  isInMinimizeButton(point: Vec2): boolean {
    if (this.minimized || !this.closable) return false;
    const wp = this.worldPosition();
    const btnX = wp.x + this.size.x - 34;
    return point.x >= btnX && point.x <= btnX + 16 &&
           point.y >= wp.y && point.y <= wp.y + this.headerHeight;
  }

  // --- Rendering ---

  render(ctx: CanvasRenderingContext2D) {
    if (this.minimized) {
      this.renderMinimizedDot(ctx);
      return;
    }

    this.updateContentGeometry();

    const x = 0, y = 0;
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
      gradColor = gradColor.replace(/[\d.]+\)$/, "0.5)");
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

    // Panel control buttons
    if (this.closable) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = this.compact ? "10px system-ui" : "12px system-ui";
      ctx.textAlign = "center";

      ctx.fillText(this.collapsed ? "\u25BC" : "\u25B2", x + w - 42, y + this.headerHeight / 2);
      ctx.fillText("\u2013", x + w - 26, y + this.headerHeight / 2);
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

    // Resize handle
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

    // Ambient glow
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

  private renderMinimizedDot(ctx: CanvasRenderingContext2D): void {
    const s = this.minimizedDotSize;
    const cx = s / 2, cy = s / 2, r = s / 2 - 2;

    ctx.save();
    ctx.shadowColor = this.titleColor.startsWith("#") ? this.titleColor : "#7b68ee";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10, 14, 23, 0.85)";
    ctx.fill();
    ctx.strokeStyle = this.titleColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = this.titleColor;
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.title.charAt(0).toUpperCase(), cx, cy);

    ctx.restore();
  }

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
}
