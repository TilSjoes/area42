/**
 * Area42 Breadcrumb Trail
 *
 * Navigation breadcrumbs for drill-down context — shows where you are
 * in a hierarchy. Items separated by "›" arrows, last item bold/active.
 */

import { NeonTheme } from "../themes/neon.js";

export interface BreadcrumbItem {
  label: string;
  id: string;
  color?: string;
  onClick?: () => void;
}

export class Breadcrumb {
  private items: BreadcrumbItem[] = [];
  private itemBounds: Array<{ index: number; x: number; w: number; y: number; h: number }> = [];
  private height = 24;

  /** Push a breadcrumb to the end of the trail */
  push(item: BreadcrumbItem): void {
    this.items.push(item);
  }

  /** Remove the last breadcrumb */
  pop(): void {
    this.items.pop();
  }

  /** Replace all breadcrumbs */
  set(items: BreadcrumbItem[]): void {
    this.items = [...items];
  }

  /** Clear all breadcrumbs */
  clear(): void {
    this.items = [];
  }

  /** Get current items */
  getItems(): BreadcrumbItem[] {
    return [...this.items];
  }

  /** Get the height of the breadcrumb bar */
  getHeight(): number {
    return this.height;
  }

  /** Render breadcrumbs */
  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    this.itemBounds = [];
    if (this.items.length === 0) return;

    const padding = 8;
    const separatorWidth = 16;
    let cx = x + padding;
    const centerY = y + this.height / 2;

    ctx.textBaseline = "middle";

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const isLast = i === this.items.length - 1;

      // Style: last item is bold and bright, others are dim
      if (isLast) {
        ctx.font = "bold 11px system-ui";
        ctx.fillStyle = item.color ?? NeonTheme.text;
      } else {
        ctx.font = "11px system-ui";
        ctx.fillStyle = item.color ?? NeonTheme.textDim;
      }

      const tw = ctx.measureText(item.label).width;

      // Truncate if we'd overflow
      if (cx + tw > x + w - padding) break;

      ctx.fillText(item.label, cx, centerY);
      this.itemBounds.push({ index: i, x: cx, w: tw, y: y, h: this.height });
      cx += tw;

      // Draw separator arrow
      if (!isLast) {
        ctx.fillStyle = "rgba(107, 123, 141, 0.5)";
        ctx.font = "11px system-ui";
        const sep = " \u203A ";
        ctx.fillText(sep, cx, centerY);
        cx += ctx.measureText(sep).width;
      }
    }

    ctx.textBaseline = "alphabetic";
  }

  /** Handle click and return clicked item or null */
  handleClick(x: number, y: number): BreadcrumbItem | null {
    for (const bound of this.itemBounds) {
      if (x >= bound.x && x <= bound.x + bound.w &&
          y >= bound.y && y <= bound.y + bound.h) {
        const item = this.items[bound.index];
        if (item?.onClick) {
          item.onClick();
        }
        return item ?? null;
      }
    }
    return null;
  }
}
