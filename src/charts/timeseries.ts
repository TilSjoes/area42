/**
 * Area42 TimeSeries Chart
 *
 * A lightweight sparkline / filled area chart rendered in Canvas.
 * Designed for use inside Panel content areas to show real-time metrics.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

/** A single data point with timestamp and value */
export interface TimeSeriesPoint {
  time: number;
  value: number;
}

/**
 * Renders a filled area chart with a glowing line on top.
 *
 * Usage:
 * ```ts
 * const ts = new TimeSeries({ color: "#00d4aa", maxPoints: 60 });
 * ts.push(42);
 * // In panel content renderer:
 * ts.render(ctx, x, y, w, h);
 * ```
 */
export class TimeSeries {
  private data: TimeSeriesPoint[] = [];
  private maxPoints: number;
  private color: string;
  private fillOpacity: number;
  private lineWidth: number;
  private showDots: boolean;
  private minValue: number | null;
  private maxValue: number | null;

  /**
   * @param options - Chart configuration
   */
  constructor(options: {
    color?: string;
    maxPoints?: number;
    fillOpacity?: number;
    lineWidth?: number;
    showDots?: boolean;
    minValue?: number;
    maxValue?: number;
  } = {}) {
    this.color = options.color ?? NeonTheme.accent;
    this.maxPoints = options.maxPoints ?? 60;
    this.fillOpacity = options.fillOpacity ?? 0.15;
    this.lineWidth = options.lineWidth ?? 1.5;
    this.showDots = options.showDots ?? false;
    this.minValue = options.minValue ?? null;
    this.maxValue = options.maxValue ?? null;
  }

  /**
   * Push a new value. Automatically timestamps and trims old data.
   * @param value - The numeric value to add
   */
  push(value: number): void {
    this.data.push({ time: Date.now(), value });
    if (this.data.length > this.maxPoints) {
      this.data.shift();
    }
  }

  /**
   * Get the current data points.
   */
  getData(): TimeSeriesPoint[] {
    return this.data;
  }

  /**
   * Get the latest value, or null if empty.
   */
  latest(): number | null {
    return this.data.length > 0 ? this.data[this.data.length - 1].value : null;
  }

  /** Clear all data */
  clear(): void {
    this.data.length = 0;
  }

  /**
   * Render the chart into a rectangular area.
   * @param ctx - Canvas 2D rendering context
   * @param x - Left edge
   * @param y - Top edge
   * @param w - Width
   * @param h - Height
   */
  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.data.length < 2) {
      // Not enough data -- draw placeholder line
      ctx.save();
      ctx.strokeStyle = withAlpha(this.color, "33");
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }

    // Calculate value range
    let min = this.minValue ?? Infinity;
    let max = this.maxValue ?? -Infinity;
    if (this.minValue === null || this.maxValue === null) {
      for (const p of this.data) {
        if (this.minValue === null && p.value < min) min = p.value;
        if (this.maxValue === null && p.value > max) max = p.value;
      }
    }
    // Add padding
    const range = max - min || 1;
    if (this.minValue === null) min -= range * 0.05;
    if (this.maxValue === null) max += range * 0.05;
    const finalRange = max - min || 1;

    const stepX = w / (this.data.length - 1);

    // Build path points
    const points: { px: number; py: number }[] = [];
    for (let i = 0; i < this.data.length; i++) {
      const px = x + i * stepX;
      const py = y + h - ((this.data[i].value - min) / finalRange) * h;
      points.push({ px, py });
    }

    ctx.save();

    // Filled area
    ctx.beginPath();
    ctx.moveTo(points[0].px, y + h);
    for (const p of points) {
      ctx.lineTo(p.px, p.py);
    }
    ctx.lineTo(points[points.length - 1].px, y + h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, this.color + Math.round(this.fillOpacity * 255).toString(16).padStart(2, "0"));
    grad.addColorStop(1, withAlpha(this.color, "00"));
    ctx.fillStyle = grad;
    ctx.fill();

    // Glowing line on top
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].px, points[i].py);
      else ctx.lineTo(points[i].px, points[i].py);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.stroke();

    // Second pass without shadow for crisp line
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Optional dots on each data point
    if (this.showDots) {
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.px, p.py, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    // Highlight latest point
    if (points.length > 0) {
      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(last.px, last.py, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    ctx.restore();
  }
}
