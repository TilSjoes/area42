/**
 * Area42 Help Overlay
 *
 * Semi-transparent panel showing all keyboard shortcuts and mouse interactions.
 * Toggled with ? or H key.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

const HELP_SECTIONS = [
  {
    title: "MOUSE",
    items: [
      ["Click node", "Inspect details"],
      ["Shift+Click", "Multi-select"],
      ["Double-click", "Drill-down"],
      ["Right-click", "Context menu"],
      ["Drag node", "Reposition"],
      ["Drag title bar", "Move panel"],
      ["Drag corner", "Resize panel"],
      ["Scroll wheel", "Zoom graph"],
      ["Ctrl+Drag", "Pan graph"],
      ["Middle-drag", "Pan graph"],
    ],
  },
  {
    title: "KEYBOARD",
    items: [
      ["Escape", "Close / Clear"],
      ["Space", "Pause physics"],
      ["F", "Fit to view"],
      ["G", "Toggle grid"],
      ["R", "Reset layout"],
      ["Delete", "Close panel"],
      ["1-5", "Select panel"],
      ["Ctrl+A", "Select all nodes"],
      ["?  H", "This help"],
    ],
  },
];

const LINE_HEIGHT = 20;
const SECTION_GAP = 12;
const PANEL_PADDING = 24;
const KEY_COL_WIDTH = 140;
const DESC_COL_WIDTH = 160;
const TOTAL_WIDTH = KEY_COL_WIDTH + DESC_COL_WIDTH + PANEL_PADDING * 2;

export class HelpOverlay {
  private visible = false;

  toggle(): void {
    this.visible = !this.visible;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.visible) return;

    // Calculate height
    let totalLines = 1; // title
    for (const section of HELP_SECTIONS) {
      totalLines += 2; // section title + separator
      totalLines += section.items.length;
      totalLines += 1; // gap
    }
    const panelHeight = totalLines * LINE_HEIGHT + PANEL_PADDING * 2;

    const x = (canvasWidth - TOTAL_WIDTH) / 2;
    const y = (canvasHeight - panelHeight) / 2;

    ctx.save();

    // Full-screen dimmer
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Glass panel
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;

    ctx.beginPath();
    this.roundRect(ctx, x, y, TOTAL_WIDTH, panelHeight, 10);
    ctx.fillStyle = "rgba(10, 14, 23, 0.92)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Border
    ctx.beginPath();
    this.roundRect(ctx, x, y, TOTAL_WIDTH, panelHeight, 10);
    ctx.strokeStyle = "rgba(123, 104, 238, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top accent line
    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, x, y, TOTAL_WIDTH, 2, 10);
    ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x + TOTAL_WIDTH, y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.3, withAlpha(NeonTheme.accent, "88"));
    grad.addColorStop(0.7, "#7b68ee88");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TOTAL_WIDTH, 2);
    ctx.restore();

    let cy = y + PANEL_PADDING;

    // Title
    ctx.fillStyle = NeonTheme.accent;
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.letterSpacing = "3px";
    ctx.fillText("AREA42 CONTROLS", x + TOTAL_WIDTH / 2, cy);
    ctx.letterSpacing = "0px";
    cy += LINE_HEIGHT + 4;

    for (const section of HELP_SECTIONS) {
      // Separator line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + PANEL_PADDING, cy + 4);
      ctx.lineTo(x + TOTAL_WIDTH - PANEL_PADDING, cy + 4);
      ctx.stroke();
      cy += SECTION_GAP;

      // Section title
      ctx.fillStyle = "#7b68ee";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.letterSpacing = "2px";
      ctx.fillText(section.title, x + PANEL_PADDING, cy);
      ctx.letterSpacing = "0px";
      cy += LINE_HEIGHT;

      // Items
      for (const [key, desc] of section.items) {
        // Key
        ctx.fillStyle = NeonTheme.text;
        ctx.font = "11px 'SF Mono', 'Cascadia Code', 'Consolas', monospace";
        ctx.textAlign = "left";
        ctx.fillText(key, x + PANEL_PADDING + 8, cy);

        // Description
        ctx.fillStyle = NeonTheme.textDim;
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillText(desc, x + PANEL_PADDING + KEY_COL_WIDTH, cy);

        cy += LINE_HEIGHT;
      }

      cy += 4;
    }

    // Footer hint
    ctx.fillStyle = NeonTheme.textDim;
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Press ? or Escape to close", x + TOTAL_WIDTH / 2, y + panelHeight - 14);

    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
