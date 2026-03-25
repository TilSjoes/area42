/**
 * Area42 Detail Panel
 *
 * Auto-appears when a graph node is clicked. Shows contextual details.
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
}

export class DetailPanel extends Panel {
  private detail: NodeDetail | null = null;
  private scrollY = 0;
  private lineHeight = 16;

  constructor(position?: Vec2) {
    super({
      id: "detail-panel",
      title: "Details",
      position: position || { x: 20, y: 20 },
      size: { x: 320, y: 400 },
      glass: true,
      titleColor: "#4dabf7",
    });
    this.visible = false;
  }

  show(detail: NodeDetail) {
    this.detail = detail;
    this.title = detail.title;
    this.titleColor = detail.color || "#4dabf7";
    this.visible = true;
    this.scrollY = 0;

    // Auto-size based on content
    const lines = detail.sections.reduce((sum, s) => sum + 1 + s.fields.length, 0);
    const actionsHeight = detail.actions ? 35 : 0;
    this.size.y = Math.min(500, Math.max(200, 40 + lines * this.lineHeight + actionsHeight + (detail.subtitle ? 20 : 0)));
  }

  hide() {
    this.visible = false;
    this.detail = null;
  }

  toggle(detail: NodeDetail) {
    if (this.visible && this.detail?.nodeId === detail.nodeId) {
      this.hide();
    } else {
      this.show(detail);
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (!this.detail) return;

    // Render base panel
    super.render(ctx);
    if (this.collapsed) return;

    const d = this.detail;
    const x = 12;
    let y = 36;  // below title bar

    // Subtitle
    if (d.subtitle) {
      ctx.fillStyle = "#6b7b8d";
      ctx.font = "10px system-ui";
      ctx.fillText(d.subtitle, x, y);
      y += 18;
    }

    // Sections
    for (const section of d.sections) {
      // Section header
      ctx.fillStyle = d.color || "#4dabf7";
      ctx.font = "bold 9px system-ui";
      ctx.letterSpacing = "1px";
      ctx.fillText(section.title.toUpperCase(), x, y);
      ctx.letterSpacing = "0px";
      y += 4;

      // Separator line
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(this.size.x - 12, y);
      ctx.stroke();
      y += 10;

      // Fields
      for (const field of section.fields) {
        const fieldColor = field.color || "#c8d6e5";

        if (field.type === "badge") {
          // Badge: colored rounded rect
          ctx.fillStyle = fieldColor + "22";
          const badgeWidth = ctx.measureText(String(field.value)).width + 12;
          this.drawRoundRect(ctx, this.size.x - 12 - badgeWidth, y - 10, badgeWidth, 16, 3);
          ctx.fill();
          ctx.fillStyle = fieldColor;
          ctx.font = "bold 10px system-ui";
          ctx.textAlign = "right";
          ctx.fillText(String(field.value), this.size.x - 18, y);
          ctx.textAlign = "left";

          ctx.fillStyle = "#6b7b8d";
          ctx.font = "10px system-ui";
          ctx.fillText(field.label, x, y);
        } else if (field.type === "bar") {
          // Progress bar
          ctx.fillStyle = "#6b7b8d";
          ctx.font = "10px system-ui";
          ctx.fillText(field.label, x, y);

          const barX = x + 80;
          const barW = this.size.x - barX - 50;
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
          ctx.fillText(pct + "%", this.size.x - 12, y);
          ctx.textAlign = "left";
        } else if (field.type === "list") {
          // Indented list item
          ctx.fillStyle = fieldColor;
          ctx.font = "10px system-ui";
          ctx.fillText("  • " + field.label + ": " + field.value, x, y);
        } else {
          // Default: label on left, value on right
          ctx.fillStyle = "#6b7b8d";
          ctx.font = "10px system-ui";
          ctx.fillText(field.label, x, y);

          ctx.fillStyle = fieldColor;
          ctx.font = "bold 11px system-ui";
          ctx.textAlign = "right";
          ctx.fillText(String(field.value), this.size.x - 12, y);
          ctx.textAlign = "left";
        }

        y += this.lineHeight;
      }

      y += 8;  // Section gap
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
