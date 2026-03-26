/**
 * Area42 Heatmap Chart
 *
 * A grid heatmap for showing activity density, like GitHub's
 * contribution graph. Default color scale goes from dark to
 * NeonTheme green, matching the neon aesthetic.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

export interface HeatmapOptions {
  rows: number;
  cols: number;
  cellSize?: number;
  gap?: number;
  colorScale?: (value: number) => string;  // 0-1 -> color
  labels?: { rows?: string[]; cols?: string[] };
}

/**
 * Renders a grid heatmap with hover detection support.
 *
 * Usage:
 * ```ts
 * const hm = new Heatmap({ rows: 7, cols: 13 });
 * hm.setData(data);  // 7x13 array of 0-1 values
 * hm.render(ctx, x, y, w, h);
 * ```
 */
export class Heatmap {
  private data: number[][] = [];
  private rows: number;
  private cols: number;
  private cellSize: number;
  private gap: number;
  private colorScale: (value: number) => string;
  private labels: { rows?: string[]; cols?: string[] };

  // Cached layout for hit testing
  private lastX = 0;
  private lastY = 0;
  private lastCellW = 0;
  private lastCellH = 0;
  private lastLabelOffsetX = 0;
  private lastLabelOffsetY = 0;

  constructor(options: HeatmapOptions) {
    this.rows = options.rows;
    this.cols = options.cols;
    this.cellSize = options.cellSize ?? 14;
    this.gap = options.gap ?? 2;
    this.colorScale = options.colorScale ?? Heatmap.defaultColorScale;
    this.labels = options.labels ?? {};

    // Init empty data
    this.data = [];
    for (let r = 0; r < this.rows; r++) {
      this.data.push(new Array(this.cols).fill(0));
    }
  }

  /** Default color scale: dark -> NeonTheme green (GitHub-style) */
  static defaultColorScale(value: number): string {
    if (value <= 0) return "rgba(255,255,255,0.03)";
    if (value < 0.25) return withAlpha(NeonTheme.success, "33");
    if (value < 0.5) return withAlpha(NeonTheme.success, "66");
    if (value < 0.75) return withAlpha(NeonTheme.success, "aa");
    return NeonTheme.success;
  }

  /** Set the full data grid */
  setData(data: number[][]): void {
    this.data = data;
  }

  /** Set a single cell value */
  setCell(row: number, col: number, value: number): void {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.data[row][col] = value;
    }
  }

  /**
   * Render the heatmap into a rectangular area.
   * Adapts cell size to fit within (w, h) if needed.
   */
  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    // Calculate label offsets
    const hasRowLabels = this.labels.rows && this.labels.rows.length > 0;
    const hasColLabels = this.labels.cols && this.labels.cols.length > 0;
    const labelOffsetX = hasRowLabels ? 28 : 0;
    const labelOffsetY = hasColLabels ? 14 : 0;

    // Calculate cell size to fit
    const availW = w - labelOffsetX;
    const availH = h - labelOffsetY;
    const cellW = Math.min(this.cellSize, Math.floor((availW - this.gap * (this.cols - 1)) / this.cols));
    const cellH = Math.min(this.cellSize, Math.floor((availH - this.gap * (this.rows - 1)) / this.rows));
    const cSize = Math.max(4, Math.min(cellW, cellH));

    // Cache layout for hit testing
    this.lastX = x;
    this.lastY = y;
    this.lastCellW = cSize;
    this.lastCellH = cSize;
    this.lastLabelOffsetX = labelOffsetX;
    this.lastLabelOffsetY = labelOffsetY;

    ctx.save();

    // Column labels (top)
    if (hasColLabels) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = "7px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (let c = 0; c < this.cols && c < this.labels.cols!.length; c++) {
        const cx = x + labelOffsetX + c * (cSize + this.gap) + cSize / 2;
        ctx.fillText(this.labels.cols![c], cx, y + labelOffsetY - 2);
      }
    }

    // Row labels (left)
    if (hasRowLabels) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = "8px system-ui";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let r = 0; r < this.rows && r < this.labels.rows!.length; r++) {
        const ry = y + labelOffsetY + r * (cSize + this.gap) + cSize / 2;
        ctx.fillText(this.labels.rows![r], x + labelOffsetX - 4, ry);
      }
    }

    // Grid cells
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cx = x + labelOffsetX + c * (cSize + this.gap);
        const cy = y + labelOffsetY + r * (cSize + this.gap);
        const value = this.data[r] && this.data[r][c] !== undefined ? this.data[r][c] : 0;

        ctx.fillStyle = this.colorScale(value);
        // Rounded rect for cells
        const cr = Math.max(1, cSize * 0.15);
        ctx.beginPath();
        ctx.moveTo(cx + cr, cy);
        ctx.lineTo(cx + cSize - cr, cy);
        ctx.quadraticCurveTo(cx + cSize, cy, cx + cSize, cy + cr);
        ctx.lineTo(cx + cSize, cy + cSize - cr);
        ctx.quadraticCurveTo(cx + cSize, cy + cSize, cx + cSize - cr, cy + cSize);
        ctx.lineTo(cx + cr, cy + cSize);
        ctx.quadraticCurveTo(cx, cy + cSize, cx, cy + cSize - cr);
        ctx.lineTo(cx, cy + cr);
        ctx.quadraticCurveTo(cx, cy, cx + cr, cy);
        ctx.closePath();
        ctx.fill();

        // Subtle glow on high-value cells
        if (value >= 0.75) {
          ctx.shadowColor = NeonTheme.success;
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    ctx.restore();
  }

  /**
   * Find which cell a local coordinate maps to.
   * Coordinates should be relative to the render area origin.
   */
  findCellAt(localX: number, localY: number): { row: number; col: number; value: number } | null {
    const gx = localX - this.lastLabelOffsetX;
    const gy = localY - this.lastLabelOffsetY;

    const step = this.lastCellW + this.gap;
    if (step <= 0) return null;

    const col = Math.floor(gx / step);
    const row = Math.floor(gy / step);

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;

    // Check we are actually on the cell, not in the gap
    const cellX = gx - col * step;
    const cellY = gy - row * step;
    if (cellX > this.lastCellW || cellY > this.lastCellH) return null;

    const value = this.data[row] && this.data[row][col] !== undefined ? this.data[row][col] : 0;
    return { row, col, value };
  }
}
