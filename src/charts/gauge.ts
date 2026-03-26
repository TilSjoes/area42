/**
 * Area42 Gauge/Ring Chart
 *
 * Circular gauge for showing percentages, scores, health status.
 * Think: Trust Index ring, compliance score, CPU usage.
 * Smooth animation when value changes via requestAnimationFrame.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

export interface GaugeOptions {
  value: number;       // 0-100
  label?: string;      // center text (e.g., "82.1")
  sublabel?: string;   // below value (e.g., "Trust Index")
  color?: string;      // arc color (auto: green>80, yellow>50, red<50)
  size?: number;       // diameter in px
  thickness?: number;  // arc thickness
  animated?: boolean;  // animate value changes
}

/**
 * Renders a circular gauge with animated value arc, glow, tick marks,
 * and center label text.
 *
 * Usage:
 * ```ts
 * const gauge = new Gauge({ value: 82.1, sublabel: "Trust Index" });
 * gauge.render(ctx, cx, cy);
 * ```
 */
export class Gauge {
  private currentValue = 0;
  private targetValue = 0;
  private label: string;
  private sublabel: string;
  private color: string | null;
  private size: number;
  private thickness: number;
  private animated: boolean;

  constructor(options: GaugeOptions) {
    this.targetValue = Math.max(0, Math.min(100, options.value));
    this.currentValue = options.animated === false ? this.targetValue : 0;
    this.label = options.label ?? "";
    this.sublabel = options.sublabel ?? "";
    this.color = options.color ?? null;
    this.size = options.size ?? 120;
    this.thickness = options.thickness ?? 10;
    this.animated = options.animated ?? true;
  }

  /** Set a new target value, triggering animation */
  setValue(value: number): void {
    this.targetValue = Math.max(0, Math.min(100, value));
    if (!this.animated) {
      this.currentValue = this.targetValue;
    }
  }

  /** Set the display label (center text) */
  setLabel(label: string): void {
    this.label = label;
  }

  /** Set the sublabel (below center text) */
  setSublabel(sublabel: string): void {
    this.sublabel = sublabel;
  }

  /** Get the auto color based on value thresholds */
  private getColor(value: number): string {
    if (this.color) return this.color;
    if (value >= 80) return NeonTheme.success;
    if (value >= 50) return NeonTheme.warning;
    return NeonTheme.danger;
  }

  /**
   * Render the gauge centered at (cx, cy).
   * Call this every frame for smooth animation.
   */
  render(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Animate toward target
    if (this.animated && Math.abs(this.currentValue - this.targetValue) > 0.05) {
      this.currentValue += (this.targetValue - this.currentValue) * 0.08;
      if (Math.abs(this.currentValue - this.targetValue) < 0.1) {
        this.currentValue = this.targetValue;
      }
    }

    const radius = this.size / 2 - this.thickness / 2 - 4;
    const startAngle = Math.PI * 0.75;  // 135 degrees
    const endAngle = Math.PI * 2.25;    // 405 degrees
    const totalArc = endAngle - startAngle;
    const valueAngle = startAngle + totalArc * (this.currentValue / 100);
    const color = this.getColor(this.currentValue);

    ctx.save();

    // Background arc (dim)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = withAlpha(NeonTheme.border, "88");
    ctx.lineWidth = this.thickness;
    ctx.lineCap = "round";
    ctx.stroke();

    // Tick marks at 25, 50, 75
    for (const tick of [25, 50, 75]) {
      const tickAngle = startAngle + totalArc * (tick / 100);
      const innerR = radius - this.thickness / 2 - 2;
      const outerR = radius + this.thickness / 2 + 2;
      const tx1 = cx + Math.cos(tickAngle) * innerR;
      const ty1 = cy + Math.sin(tickAngle) * innerR;
      const tx2 = cx + Math.cos(tickAngle) * outerR;
      const ty2 = cy + Math.sin(tickAngle) * outerR;
      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo(tx2, ty2);
      ctx.strokeStyle = withAlpha(NeonTheme.textDim, "66");
      ctx.lineWidth = 1;
      ctx.lineCap = "butt";
      ctx.stroke();
    }

    // Value arc (colored with glow)
    if (this.currentValue > 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, valueAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = this.thickness;
      ctx.lineCap = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Second pass without shadow for crisp arc
      ctx.shadowBlur = 0;
      ctx.stroke();
    }

    // Center text: label (big bold number)
    const displayLabel = this.label || this.currentValue.toFixed(1);
    const fontSize = Math.max(12, Math.floor(this.size * 0.22));
    ctx.fillStyle = NeonTheme.text;
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayLabel, cx, cy - (this.sublabel ? 6 : 0));

    // Sublabel below value
    if (this.sublabel) {
      const subSize = Math.max(8, Math.floor(this.size * 0.09));
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = `${subSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(this.sublabel, cx, cy + fontSize * 0.5 + 2);
    }

    ctx.restore();
  }
}
