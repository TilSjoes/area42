/**
 * Area42 Metric Display
 *
 * A panel content helper for displaying key metrics in a grid layout.
 * Each metric has a label, value, and optional color.
 * Designed for use inside Panel.onContent() callbacks.
 */

import { NeonTheme } from "../themes/neon.js";

/** A single metric entry */
export interface MetricEntry {
  label: string;
  value: string | number;
  color?: string;
}

/**
 * Renders a grid of labeled metrics with large values.
 *
 * Usage:
 * ```ts
 * const metrics = new MetricDisplay();
 * metrics.set("Requests", 82);
 * metrics.set("Cost", "$0.94", "#51cf66");
 * // In panel content renderer:
 * metrics.render(ctx, x, y, w, h);
 * ```
 */
export class MetricDisplay {
  metrics: MetricEntry[] = [];
  private columns: number;
  private valueSize: number;
  private labelSize: number;

  /**
   * @param options - Display configuration
   */
  constructor(options: {
    columns?: number;
    valueSize?: number;
    labelSize?: number;
  } = {}) {
    this.columns = options.columns ?? 2;
    this.valueSize = options.valueSize ?? 22;
    this.labelSize = options.labelSize ?? 9;
  }

  /**
   * Set or update a metric by label.
   * If the label already exists, its value and color are updated.
   * @param label - Metric label
   * @param value - Display value (string or number)
   * @param color - Optional accent color
   */
  set(label: string, value: string | number, color?: string): void {
    const existing = this.metrics.find((m) => m.label === label);
    if (existing) {
      existing.value = value;
      if (color !== undefined) existing.color = color;
    } else {
      this.metrics.push({ label, value, color });
    }
  }

  /**
   * Remove a metric by label.
   */
  remove(label: string): void {
    this.metrics = this.metrics.filter((m) => m.label !== label);
  }

  /** Clear all metrics */
  clear(): void {
    this.metrics.length = 0;
  }

  /**
   * Render the metrics grid into a rectangular area.
   * @param ctx - Canvas 2D rendering context
   * @param x - Left edge
   * @param y - Top edge
   * @param w - Width
   * @param h - Height
   */
  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.metrics.length === 0) return;

    const cols = Math.min(this.columns, this.metrics.length);
    const colWidth = w / cols;
    const rowHeight = Math.max(50, h / Math.ceil(this.metrics.length / cols));

    for (let i = 0; i < this.metrics.length; i++) {
      const m = this.metrics[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const mx = x + col * colWidth;
      const my = y + row * rowHeight;

      // Label
      ctx.save();
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = `${this.labelSize}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.letterSpacing = "1px";
      ctx.fillText(m.label.toUpperCase(), mx, my);

      // Value
      const valueColor = m.color ?? NeonTheme.text;
      ctx.fillStyle = valueColor;
      ctx.font = `bold ${this.valueSize}px system-ui, sans-serif`;
      ctx.shadowColor = valueColor;
      ctx.shadowBlur = 6;
      ctx.fillText(String(m.value), mx, my + this.labelSize + 4);
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }
}
