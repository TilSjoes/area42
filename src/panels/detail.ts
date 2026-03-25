/**
 * Area42 Detail Panel
 *
 * Auto-appears when a graph node is clicked. Shows contextual details.
 * Supports multiple simultaneous panels, scrolling, and close callbacks.
 * Designed for drill-down investigation (AML, dependencies, orchestration).
 */

import { Panel } from "./panel.js";
import type { Vec2 } from "../core/scene.js";

export interface DetailField {
  label: string;
  value: string | number;
  color?: string;
  type?: "text" | "badge" | "bar" | "link" | "list";
}

export interface DetailSection {
  title: string;
  fields: DetailField[];
}

export interface NodeDetail {
  nodeId: string;
  title: string;
  subtitle?: string;
  color?: string;
  sections: DetailSection[];
  actions?: { label: string; color?: string; callback: () => void }[];
  /** Optional custom table renderer (rendered after sections) */
  _tableRenderer?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
  /** Optional custom mini-graph renderer (rendered after sections) */
  _miniGraphRenderer?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
}

let detailPanelCounter = 0;

export class DetailPanel extends Panel {
  private detail: NodeDetail | null = null;
  private scrollY = 0;
  private maxScrollY = 0;
  private lineHeight = 16;
  private contentHeight = 0;

  nodeId: string;

  constructor(nodeId: string, position?: Vec2) {
    detailPanelCounter++;
    super({
      id: "detail-" + nodeId,
      title: "Details",
      position: position || { x: 20, y: 20 },
      size: { x: 320, y: 400 },
      glass: true,
      titleColor: "#4dabf7",
      closable: true,
    });
    this.nodeId = nodeId;
    this.visible = false;
  }

  show(detail: NodeDetail) {
    this.detail = detail;
    this.title = detail.title;
    this.titleColor = detail.color || "#4dabf7";
    this.visible = true;
    this.scrollY = 0;

    // Calculate content height
    this.contentHeight = this.calculateContentHeight(detail);

    // Auto-size based on content, but cap at 500
    const headerHeight = 28;
    const desiredHeight = headerHeight + this.contentHeight + 10;
    this.size.y = Math.min(500, Math.max(200, desiredHeight));

    // Calculate max scroll
    const viewableHeight = this.size.y - headerHeight;
    this.maxScrollY = Math.max(0, this.contentHeight - viewableHeight + 10);
  }

  hide() {
    this.visible = false;
    this.detail = null;
  }

  /** Scroll the content by deltaY pixels */
  scroll(deltaY: number) {
    if (!this.detail || this.collapsed) return;
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + deltaY * 0.5));
  }

  private calculateContentHeight(d: NodeDetail): number {
    let h = 0;
    if (d.subtitle) h += 18;
    for (const section of d.sections) {
      h += 14; // section header + separator
      h += section.fields.length * this.lineHeight;
      h += 8; // section gap
    }
    if (d.actions) h += 30;
    // Custom renderers get extra space
    if (d._tableRenderer) h += 220;
    if (d._miniGraphRenderer) h += 100;
    return h;
  }

  render(ctx: CanvasRenderingContext2D) {
    if (!this.detail) return;

    // Render base panel (glass background, title bar, etc.)
    super.render(ctx);
    if (this.collapsed) return;

    const d = this.detail;
    const headerHeight = 28;
    const panelW = this.size.x;
    const panelH = this.size.y;
    const contentAreaH = panelH - headerHeight;

    // Clip to content area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, headerHeight, panelW, contentAreaH);
    ctx.clip();

    // Apply scroll offset
    ctx.save();
    ctx.translate(0, -this.scrollY);

    const x = 12;
    let y = headerHeight + 8;

    // Subtitle
    if (d.subtitle) {
      ctx.fillStyle = "#6b7b8d";
      ctx.font = "10px system-ui";
      ctx.fillText(d.subtitle, x, y);
      y += 18;
    }

    // Sections
    for (const section of d.sections) {
      ctx.fillStyle = d.color || "#4dabf7";
      ctx.font = "bold 9px system-ui";
      ctx.letterSpacing = "1px";
      ctx.fillText(section.title.toUpperCase(), x, y);
      ctx.letterSpacing = "0px";
      y += 4;

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(panelW - 12, y);
      ctx.stroke();
      y += 10;

      for (const field of section.fields) {
        const fieldColor = field.color || "#c8d6e5";

        if (field.type === "badge") {
          ctx.fillStyle = fieldColor + "22";
          const badgeWidth = ctx.measureText(String(field.value)).width + 12;
          this.drawRoundRect(ctx, panelW - 12 - badgeWidth, y - 10, badgeWidth, 16, 3);
          ctx.fill();
          ctx.fillStyle = fieldColor;
          ctx.font = "bold 10px system-ui";
          ctx.textAlign = "right";
          ctx.fillText(String(field.value), panelW - 18, y);
          ctx.textAlign = "left";

          ctx.fillStyle = "#6b7b8d";
          ctx.font = "10px system-ui";
          ctx.fillText(field.label, x, y);
        } else if (field.type === "bar") {
          ctx.fillStyle = "#6b7b8d";
          ctx.font = "10px system-ui";
          ctx.fillText(field.label, x, y);

          const barX = x + 80;
          const barW = panelW - barX - 50;
          const pct = typeof field.value === "number" ? field.value : parseFloat(String(field.value)) || 0;

          ctx.fillStyle = "rgba(255,255,255,0.03)";
          this.drawRoundRect(ctx, barX, y - 8, barW, 10, 3);
          ctx.fill();
          ctx.fillStyle = fieldColor;
          this.drawRoundRect(ctx, barX, y - 8, barW * (pct / 100), 10, 3);
          ctx.fill();

          ctx.fillStyle = fieldColor;
          ctx.font = "bold 10px system-ui";
          ctx.textAlign = "right";
          ctx.fillText(pct + "%", panelW - 12, y);
          ctx.textAlign = "left";
        } else if (field.type === "list") {
          ctx.fillStyle = fieldColor;
          ctx.font = "10px system-ui";
          ctx.fillText("  \u2022 " + field.label + ": " + field.value, x, y);
        } else {
          ctx.fillStyle = "#6b7b8d";
          ctx.font = "10px system-ui";
          ctx.fillText(field.label, x, y);

          ctx.fillStyle = fieldColor;
          ctx.font = "bold 11px system-ui";
          ctx.textAlign = "right";
          ctx.fillText(String(field.value), panelW - 12, y);
          ctx.textAlign = "left";
        }

        y += this.lineHeight;
      }

      y += 8;
    }

    // Actions
    if (d.actions) {
      y += 4;
      let ax = x;
      for (const action of d.actions) {
        const color = action.color || "#4dabf7";
        const tw = ctx.measureText(action.label).width + 16;
        ctx.fillStyle = color + "22";
        this.drawRoundRect(ctx, ax, y - 10, tw, 20, 4);
        ctx.fill();
        ctx.strokeStyle = color + "44";
        this.drawRoundRect(ctx, ax, y - 10, tw, 20, 4);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "bold 9px system-ui";
        ctx.fillText(action.label, ax + 8, y + 2);
        ax += tw + 8;
      }
      y += 20;
    }

    // Custom mini-graph renderer
    if (d._miniGraphRenderer) {
      y += 8;
      d._miniGraphRenderer(ctx, x, y, panelW - 24, 90);
      y += 100;
    }

    // Custom table renderer — fills remaining panel height
    if (d._tableRenderer) {
      y += 8;
      const remainingH = Math.max(100, this.size.y - y - 12);
      d._tableRenderer(ctx, x, y, panelW - 24, remainingH);
      y += remainingH;
    }

    ctx.restore(); // undo translate
    ctx.restore(); // undo clip

    // Draw scrollbar indicator if content overflows
    if (this.maxScrollY > 0) {
      const scrollbarH = Math.max(20, contentAreaH * (contentAreaH / (this.contentHeight + 10)));
      const scrollbarY = headerHeight + (this.scrollY / this.maxScrollY) * (contentAreaH - scrollbarH);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      this.drawRoundRect(ctx, panelW - 5, scrollbarY, 3, scrollbarH, 1.5);
      ctx.fill();
    }
  }

  private drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
