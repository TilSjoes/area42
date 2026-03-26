/**
 * Area42 Export System
 *
 * Export capabilities -- users can export what they see to various formats:
 * PNG screenshots, CSV table data, JSON graph data, and investigation reports.
 */

import type { Table } from "../panels/table.js";
import type { Graph } from "../graph/graph.js";

export class Exporter {
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** Screenshot: render current canvas to PNG */
  async toPNG(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export canvas as PNG"));
      }, "image/png");
    });
  }

  /** Table data: export visible table data as CSV */
  toCSV(table: Table): string {
    const cols = table.columns;
    const header = cols.map(c => this.csvEscape(c.label)).join(",");
    const rows = table.rows.map(row =>
      cols.map(c => {
        const val = row[c.key];
        const formatted = c.format ? c.format(val) : String(val ?? "");
        return this.csvEscape(formatted);
      }).join(",")
    );
    return [header, ...rows].join("\n");
  }

  /** Graph data: export nodes/edges as JSON */
  toJSON(graph: Graph): string {
    const nodes = graph.getNodes().map(n => ({
      id: n.id,
      label: n.label,
      x: Math.round(n.x * 100) / 100,
      y: Math.round(n.y * 100) / 100,
      color: n.color,
      shape: n.shape,
      radius: n.radius,
      selected: n.selected,
      pinned: n.pinned,
      data: n.data,
      parentId: n.parentId,
      childIds: n.childIds,
    }));
    const edges = graph.getEdges().map(e => ({
      from: e.from,
      to: e.to,
      label: e.label,
      color: e.color,
      width: e.width,
      selected: e.selected,
      data: e.data,
    }));
    return JSON.stringify({ nodes, edges, exportedAt: new Date().toISOString() }, null, 2);
  }

  /** Breadcrumb context: export current drill-down path + visible data */
  toReport(path: string[], nodes: any[], tables: any[]): {
    path: string[];
    nodes: any[];
    tables: any[];
    timestamp: string;
  } {
    return {
      path,
      nodes,
      tables,
      timestamp: new Date().toISOString(),
    };
  }

  /** Trigger browser download */
  download(data: Blob | string, filename: string, mimeType?: string): void {
    let blob: Blob;
    if (typeof data === "string") {
      blob = new Blob([data], { type: mimeType || "text/plain;charset=utf-8" });
    } else {
      blob = data;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /** Export canvas as PNG and trigger download */
  async downloadPNG(filename?: string): Promise<void> {
    const blob = await this.toPNG();
    this.download(blob, filename || "area42-screenshot.png", "image/png");
  }

  /** Export table as CSV and trigger download */
  downloadCSV(table: Table, filename?: string): void {
    const csv = this.toCSV(table);
    this.download(csv, filename || "area42-table.csv", "text/csv;charset=utf-8");
  }

  /** Export graph as JSON and trigger download */
  downloadJSON(graph: Graph, filename?: string): void {
    const json = this.toJSON(graph);
    this.download(json, filename || "area42-graph.json", "application/json");
  }

  private csvEscape(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }
}
