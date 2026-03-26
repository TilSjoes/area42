/**
 * Area42 Status Bar
 *
 * A fixed bottom bar showing system status — like VS Code's status bar.
 * Dark surface background, left/right aligned items, clickable.
 */

import { NeonTheme } from "../themes/neon.js";

export interface StatusItem {
  id: string;
  text: string;
  color?: string;
  icon?: string;
  position?: "left" | "right";
  onClick?: () => void;
}

export class StatusBar {
  private items: Map<string, StatusItem> = new Map();
  private height = 24;
  private itemBounds: Array<{ id: string; x: number; w: number }> = [];

  /** Set or update a status item */
  set(id: string, text: string, options?: Partial<StatusItem>): void {
    this.items.set(id, {
      id,
      text,
      color: options?.color,
      icon: options?.icon,
      position: options?.position ?? "left",
      onClick: options?.onClick,
    });
  }

  /** Remove a status item */
  remove(id: string): void {
    this.items.delete(id);
  }

  /** Get bar height */
  getHeight(): number {
    return this.height;
  }

  /** Render the status bar at the bottom of the screen */
  render(ctx: CanvasRenderingContext2D, y: number, w: number): void {
    this.itemBounds = [];

    // Background
    ctx.fillStyle = "rgba(15, 20, 33, 0.95)";
    ctx.fillRect(0, y, w, this.height);

    // Top border line
    ctx.strokeStyle = NeonTheme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    const leftItems: StatusItem[] = [];
    const rightItems: StatusItem[] = [];

    for (const item of this.items.values()) {
      if (item.position === "right") {
        rightItems.push(item);
      } else {
        leftItems.push(item);
      }
    }

    ctx.font = "11px system-ui";
    ctx.textBaseline = "middle";
    const centerY = y + this.height / 2;
    const padding = 10;
    const itemGap = 6;

    // Render left-aligned items
    let lx = padding;
    for (let i = 0; i < leftItems.length; i++) {
      const item = leftItems[i];
      let text = item.text;
      if (item.icon) text = item.icon + " " + text;

      ctx.fillStyle = item.color ?? NeonTheme.textDim;
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, lx, centerY);
      this.itemBounds.push({ id: item.id, x: lx, w: tw });
      lx += tw + itemGap;

      // Separator dot between items
      if (i < leftItems.length - 1) {
        ctx.fillStyle = "rgba(107, 123, 141, 0.4)";
        ctx.beginPath();
        ctx.arc(lx + 1, centerY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        lx += itemGap;
      }
    }

    // Render right-aligned items (from right edge)
    let rx = w - padding;
    for (let i = rightItems.length - 1; i >= 0; i--) {
      const item = rightItems[i];
      let text = item.text;
      if (item.icon) text = item.icon + " " + text;

      ctx.fillStyle = item.color ?? NeonTheme.textDim;
      const tw = ctx.measureText(text).width;
      rx -= tw;
      ctx.fillText(text, rx, centerY);
      this.itemBounds.push({ id: item.id, x: rx, w: tw });
      rx -= itemGap;

      // Separator dot between items
      if (i > 0) {
        ctx.fillStyle = "rgba(107, 123, 141, 0.4)";
        ctx.beginPath();
        ctx.arc(rx - 1, centerY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        rx -= itemGap;
      }
    }

    ctx.textBaseline = "alphabetic";
  }

  /** Handle click at given x position (y is assumed to be within the bar) */
  handleClick(x: number): void {
    for (const bound of this.itemBounds) {
      if (x >= bound.x && x <= bound.x + bound.w) {
        const item = this.items.get(bound.id);
        if (item?.onClick) {
          item.onClick();
        }
        return;
      }
    }
  }
}
