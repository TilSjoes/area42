/**
 * Area42 Table/List Renderer
 *
 * Canvas-based data table for rendering inside panels.
 * Designed for transaction lists, audit trails, process steps.
 * Uses NeonTheme colors with alternating row backgrounds and badge support.
 * Supports text truncation with ellipsis, sparkline columns, and row filtering.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
  color?: string;
  format?: (value: any) => string;
  type?: 'text' | 'badge' | 'sparkline';
  sparklineColor?: string;
}

export interface TableRow {
  [key: string]: any;
  _color?: string;
  _badge?: string;
  _badgeColor?: string;
}

export class Table {
  columns: TableColumn[];
  rows: TableRow[] = [];
  private filteredRows: TableRow[] | null = null;
  private scrollY = 0;
  private rowHeight = 20;
  private headerHeight = 24;
  private selectedRow = -1;
  private maxScrollY = 0;

  constructor(columns: TableColumn[]) {
    this.columns = columns;
  }

  setData(rows: TableRow[]): void {
    this.rows = rows;
    this.filteredRows = null;
    this.scrollY = 0;
    this.selectedRow = -1;
  }

  addRow(row: TableRow): void {
    this.rows.unshift(row);
    if (this.filteredRows !== null) {
      this.filteredRows = null;
    }
  }

  /** Filter rows by a search query. Empty query clears the filter. */
  filter(query: string): void {
    if (!query) {
      this.filteredRows = null;
      return;
    }
    const q = query.toLowerCase();
    this.filteredRows = this.rows.filter(row =>
      Object.values(row).some(v => {
        if (v == null) return false;
        if (Array.isArray(v)) return false;
        return String(v).toLowerCase().includes(q);
      })
    );
    this.scrollY = 0;
    this.selectedRow = -1;
  }

  scroll(deltaY: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + deltaY * 0.5));
  }

  clickAt(localY: number): number {
    const rowY = localY - this.headerHeight + this.scrollY;
    if (rowY < 0) return -1;
    const displayRows = this.getDisplayRows();
    const idx = Math.floor(rowY / this.rowHeight);
    if (idx >= 0 && idx < displayRows.length) {
      this.selectedRow = this.selectedRow === idx ? -1 : idx;
      return this.selectedRow;
    }
    return -1;
  }

  /** Get the rows currently being displayed (filtered or all) */
  private getDisplayRows(): TableRow[] {
    return this.filteredRows !== null ? this.filteredRows : this.rows;
  }

  /** Truncate text with ellipsis if it exceeds maxWidth */
  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '\u2026').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated.length > 0 ? truncated + '\u2026' : '\u2026';
  }

  /** Render a sparkline (mini area chart) inside a cell */
  private renderSparkline(
    ctx: CanvasRenderingContext2D,
    values: number[],
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number,
    color: string
  ): void {
    if (!values || values.length < 2) return;

    const pad = 3;
    const x0 = cellX + pad;
    const y0 = cellY + pad;
    const w = cellW - pad * 2;
    const h = cellH - pad * 2;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const stepX = w / (values.length - 1);

    // Area fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    for (let i = 0; i < values.length; i++) {
      const px = x0 + i * stepX;
      const py = y0 + h - ((values[i] - min) / range) * h;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x0 + (values.length - 1) * stepX, y0 + h);
    ctx.closePath();
    ctx.fillStyle = withAlpha(color, "18");
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const px = x0 + i * stepX;
      const py = y0 + h - ((values[i] - min) / range) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // End dot
    const lastX = x0 + (values.length - 1) * stepX;
    const lastY = y0 + h - ((values[values.length - 1] - min) / range) * h;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const displayRows = this.getDisplayRows();
    const colWidths = this.resolveColumnWidths(w);
    const totalContentH = displayRows.length * this.rowHeight;
    const viewH = h - this.headerHeight;
    this.maxScrollY = Math.max(0, totalContentH - viewH);

    // Header background
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x, y, w, this.headerHeight);

    // Header bottom border
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(x, y + this.headerHeight);
    ctx.lineTo(x + w, y + this.headerHeight);
    ctx.stroke();

    // Header text
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    let hx = x;
    for (let c = 0; c < this.columns.length; c++) {
      const col = this.columns[c];
      const cw = colWidths[c];
      const tx = this.textX(hx, cw, col.align || "left");
      ctx.fillStyle = NeonTheme.textDim;
      ctx.textAlign = col.align || "left";
      ctx.letterSpacing = "1px";
      ctx.fillText(col.label.toUpperCase(), tx, y + this.headerHeight / 2);
      ctx.letterSpacing = "0px";
      hx += cw;
    }
    ctx.restore();

    // Filter indicator
    if (this.filteredRows !== null) {
      ctx.save();
      ctx.fillStyle = NeonTheme.accent;
      ctx.font = "8px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${this.filteredRows.length}/${this.rows.length}`, x + w - 6, y + this.headerHeight / 2);
      ctx.restore();
    }

    // Rows (clipped)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + this.headerHeight, w, viewH);
    ctx.clip();

    ctx.save();
    ctx.translate(0, -this.scrollY);

    for (let i = 0; i < displayRows.length; i++) {
      const row = displayRows[i];
      const ry = y + this.headerHeight + i * this.rowHeight;

      if (ry - this.scrollY + this.rowHeight < y + this.headerHeight) continue;
      if (ry - this.scrollY > y + h) break;

      // Alternating background
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)";
      ctx.fillRect(x, ry, w, this.rowHeight);

      // Row highlight color
      if (row._color) {
        ctx.fillStyle = withAlpha(row._color, "11");
        ctx.fillRect(x, ry, w, this.rowHeight);
      }

      // Selected row
      if (i === this.selectedRow) {
        ctx.fillStyle = withAlpha(NeonTheme.accent, "15");
        ctx.fillRect(x, ry, w, this.rowHeight);
        ctx.fillStyle = NeonTheme.accent;
        ctx.fillRect(x, ry, 2, this.rowHeight);
      }

      // Cell values
      let cx = x;
      for (let c = 0; c < this.columns.length; c++) {
        const col = this.columns[c];
        const cw = colWidths[c];
        const val = row[col.key];

        // Save context for cell clipping
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, ry, cw, this.rowHeight);
        ctx.clip();

        if (col.type === 'sparkline' && Array.isArray(val)) {
          this.renderSparkline(
            ctx, val, cx, ry, cw, this.rowHeight,
            col.sparklineColor || col.color || NeonTheme.accent
          );
        } else {
          const displayVal = col.format ? col.format(val) : String(val ?? "");
          const tx = this.textX(cx, cw, col.align || "left");
          const pad = 6;
          const maxTextWidth = cw - pad * 2;

          ctx.fillStyle = col.color || row._color || NeonTheme.text;
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = col.align || "left";
          ctx.textBaseline = "middle";

          const truncated = this.truncateText(ctx, displayVal, maxTextWidth);
          ctx.fillText(truncated, tx, ry + this.rowHeight / 2);
        }

        ctx.restore();
        cx += cw;
      }

      // Badge
      if (row._badge) {
        const badgeColor = row._badgeColor || NeonTheme.accent;
        const badgeText = row._badge;
        ctx.font = "bold 8px system-ui, sans-serif";
        const badgeW = ctx.measureText(badgeText).width + 10;
        const badgeH = 14;
        const badgeX = x + w - badgeW - 6;
        const badgeY = ry + (this.rowHeight - badgeH) / 2;

        ctx.fillStyle = withAlpha(badgeColor, "22");
        this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
        ctx.fill();

        ctx.strokeStyle = withAlpha(badgeColor, "44");
        ctx.lineWidth = 0.5;
        this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
        ctx.stroke();

        ctx.fillStyle = badgeColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
      }
    }

    ctx.restore();
    ctx.restore();

    // Scrollbar
    if (this.maxScrollY > 0) {
      const scrollbarH = Math.max(20, viewH * (viewH / totalContentH));
      const scrollbarY = y + this.headerHeight + (this.scrollY / this.maxScrollY) * (viewH - scrollbarH);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      this.roundRect(ctx, x + w - 4, scrollbarY, 3, scrollbarH, 1.5);
      ctx.fill();
    }
  }

  private resolveColumnWidths(totalWidth: number): number[] {
    const widths: number[] = new Array(this.columns.length).fill(0);
    let usedPx = 0;
    let totalFraction = 0;
    const unset: number[] = [];

    for (let i = 0; i < this.columns.length; i++) {
      const w = this.columns[i].width;
      if (w === undefined) {
        unset.push(i);
      } else if (w > 0 && w <= 1) {
        totalFraction += w;
      } else {
        widths[i] = w;
        usedPx += w;
      }
    }

    const remaining = totalWidth - usedPx;

    for (let i = 0; i < this.columns.length; i++) {
      const w = this.columns[i].width;
      if (w !== undefined && w > 0 && w <= 1) {
        widths[i] = remaining * (w / (totalFraction || 1));
      }
    }

    if (unset.length > 0) {
      const fractionUsed = totalFraction > 0 ? remaining * (totalFraction / (totalFraction || 1)) : 0;
      const leftover = remaining - fractionUsed;
      const each = leftover / unset.length;
      for (const idx of unset) {
        widths[idx] = each;
      }
    }

    return widths;
  }

  private textX(cellX: number, cellW: number, align: string): number {
    const pad = 6;
    if (align === "right") return cellX + cellW - pad;
    if (align === "center") return cellX + cellW / 2;
    return cellX + pad;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
