/**
 * Area42 Context Menu
 *
 * Floating right-click context menu rendered on Canvas.
 * Dark glass panel with hover highlighting and keyboard shortcuts.
 */

import type { Vec2 } from "../core/scene.js";
import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

export interface MenuItem {
  label: string;
  icon?: string;
  color?: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  action: () => void;
}

const ITEM_HEIGHT = 28;
const SEPARATOR_HEIGHT = 9;
const PADDING_X = 12;
const MIN_WIDTH = 180;
const CORNER_RADIUS = 6;

export class ContextMenu {
  private items: MenuItem[] = [];
  private visible = false;
  private position: Vec2 = { x: 0, y: 0 };
  private hoveredIndex = -1;
  private menuWidth = MIN_WIDTH;
  private menuHeight = 0;

  /** Show context menu at screen coordinates */
  show(x: number, y: number, items: MenuItem[]): void {
    this.items = items;
    this.visible = true;
    this.hoveredIndex = -1;

    // Calculate menu dimensions
    this.menuWidth = MIN_WIDTH;
    this.menuHeight = 8; // top padding
    for (const item of items) {
      if (item.separator) {
        this.menuHeight += SEPARATOR_HEIGHT;
      } else {
        this.menuHeight += ITEM_HEIGHT;
      }
    }
    this.menuHeight += 8; // bottom padding

    // Position: ensure menu stays on screen
    this.position = { x, y };
  }

  /** Adjust position to fit within canvas bounds */
  clampToScreen(canvasWidth: number, canvasHeight: number): void {
    if (this.position.x + this.menuWidth > canvasWidth - 8) {
      this.position.x = canvasWidth - this.menuWidth - 8;
    }
    if (this.position.y + this.menuHeight > canvasHeight - 8) {
      this.position.y = canvasHeight - this.menuHeight - 8;
    }
    if (this.position.x < 8) this.position.x = 8;
    if (this.position.y < 8) this.position.y = 8;
  }

  hide(): void {
    this.visible = false;
    this.items = [];
    this.hoveredIndex = -1;
  }

  isVisible(): boolean {
    return this.visible;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible || this.items.length === 0) return;

    const x = this.position.x;
    const y = this.position.y;
    const w = this.menuWidth;
    const h = this.menuHeight;

    ctx.save();

    // Shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;

    // Glass background
    ctx.beginPath();
    this.roundRect(ctx, x, y, w, h, CORNER_RADIUS);
    ctx.fillStyle = "rgba(10, 14, 23, 0.88)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Border
    ctx.beginPath();
    this.roundRect(ctx, x, y, w, h, CORNER_RADIUS);
    ctx.strokeStyle = "rgba(123, 104, 238, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top accent line
    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, x, y, w, 1.5, CORNER_RADIUS);
    ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, withAlpha(NeonTheme.accent, "66"));
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, 1.5);
    ctx.restore();

    // Items
    let iy = y + 4;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];

      if (item.separator) {
        // Separator line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, iy + SEPARATOR_HEIGHT / 2);
        ctx.lineTo(x + w - 8, iy + SEPARATOR_HEIGHT / 2);
        ctx.stroke();
        iy += SEPARATOR_HEIGHT;
        continue;
      }

      // Hover highlight
      if (i === this.hoveredIndex && !item.disabled) {
        ctx.fillStyle = withAlpha(NeonTheme.accent, "22");
        ctx.beginPath();
        this.roundRect(ctx, x + 4, iy + 1, w - 8, ITEM_HEIGHT - 2, 4);
        ctx.fill();

        // Left accent bar
        ctx.fillStyle = NeonTheme.accent;
        ctx.fillRect(x + 4, iy + 6, 2, ITEM_HEIGHT - 12);
      }

      const textColor = item.disabled
        ? "rgba(255, 255, 255, 0.2)"
        : item.color ?? NeonTheme.text;

      // Icon
      if (item.icon) {
        ctx.fillStyle = textColor;
        ctx.font = "12px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(item.icon, x + PADDING_X, iy + ITEM_HEIGHT / 2);
      }

      // Label
      ctx.fillStyle = textColor;
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const labelX = item.icon ? x + PADDING_X + 20 : x + PADDING_X;
      ctx.fillText(item.label, labelX, iy + ITEM_HEIGHT / 2);

      // Shortcut (right-aligned, dim)
      if (item.shortcut) {
        ctx.fillStyle = item.disabled ? "rgba(255,255,255,0.1)" : NeonTheme.textDim;
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(item.shortcut, x + w - PADDING_X, iy + ITEM_HEIGHT / 2);
      }

      ctx.textAlign = "left";
      iy += ITEM_HEIGHT;
    }

    ctx.restore();
  }

  /** Handle click — returns true if the menu consumed the click */
  handleClick(point: Vec2): boolean {
    if (!this.visible) return false;

    // Check if click is inside menu
    if (point.x < this.position.x || point.x > this.position.x + this.menuWidth ||
        point.y < this.position.y || point.y > this.position.y + this.menuHeight) {
      this.hide();
      return true; // consumed the click (to close menu)
    }

    // Find clicked item
    const index = this.itemIndexAt(point);
    if (index >= 0 && index < this.items.length) {
      const item = this.items[index];
      if (!item.separator && !item.disabled) {
        item.action();
        this.hide();
        return true;
      }
    }

    return true; // click was inside menu bounds
  }

  /** Handle mouse move for hover highlighting */
  handleMove(point: Vec2): void {
    if (!this.visible) return;
    this.hoveredIndex = this.itemIndexAt(point);
  }

  /** Find which item index is at a given point */
  private itemIndexAt(point: Vec2): number {
    if (point.x < this.position.x || point.x > this.position.x + this.menuWidth) return -1;

    let iy = this.position.y + 4;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const h = item.separator ? SEPARATOR_HEIGHT : ITEM_HEIGHT;
      if (point.y >= iy && point.y < iy + h) {
        return item.separator ? -1 : i;
      }
      iy += h;
    }
    return -1;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
