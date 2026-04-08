/**
 * Area42 v2 Separator Element
 *
 * Simple horizontal or vertical divider line for layout.
 */

import { SceneNode } from "../core/scene.js";

export type SeparatorDirection = "horizontal" | "vertical";

export interface SeparatorOptions {
  id?: string;
  direction?: SeparatorDirection;
  /** Length in pixels (width for horizontal, height for vertical) */
  length?: number;
  /** Line color (default: uses style border) */
  color?: string;
  /** Margin on each side of the line */
  margin?: number;
}

export class Separator extends SceneNode {
  private _direction: SeparatorDirection;
  private _color?: string;
  private _margin: number;

  constructor(options: SeparatorOptions = {}) {
    const dir = options.direction ?? "horizontal";
    const len = options.length ?? 200;
    super({
      id: options.id,
      size: dir === "horizontal"
        ? { x: len, y: (options.margin ?? 8) * 2 + 1 }
        : { x: (options.margin ?? 8) * 2 + 1, y: len },
    });
    this._direction = dir;
    this._color = options.color;
    this._margin = options.margin ?? 8;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.resolvedStyle();
    ctx.strokeStyle = this._color ?? s.border;
    ctx.lineWidth = 1;
    ctx.globalAlpha *= 0.5;
    ctx.beginPath();

    if (this._direction === "horizontal") {
      const y = this.size.y / 2;
      ctx.moveTo(0, y);
      ctx.lineTo(this.size.x, y);
    } else {
      const x = this.size.x / 2;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.size.y);
    }

    ctx.stroke();
  }
}
