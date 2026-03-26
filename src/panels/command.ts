/**
 * Area42 Command Palette
 *
 * A Ctrl+K / Cmd+K overlay for searching nodes, panels, actions.
 * Glass morphism styling, keyboard navigation, fuzzy filtering.
 */

import { NeonTheme } from "../themes/neon.js";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category?: string;
  action: () => void;
}

export class CommandPalette {
  private visible = false;
  private query = "";
  private items: CommandItem[] = [];
  private filteredItems: CommandItem[] = [];
  private selectedIndex = 0;

  /** Register command items */
  register(items: CommandItem[]): void {
    this.items.push(...items);
  }

  /** Clear all registered items */
  clearItems(): void {
    this.items = [];
  }

  /** Show the palette */
  show(): void {
    this.visible = true;
    this.query = "";
    this.selectedIndex = 0;
    this.filter();
  }

  /** Hide the palette */
  hide(): void {
    this.visible = false;
    this.query = "";
    this.selectedIndex = 0;
  }

  /** Toggle visibility */
  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  /** Check if visible */
  isVisible(): boolean {
    return this.visible;
  }

  /** Filter items based on current query */
  private filter(): void {
    if (this.query.length === 0) {
      this.filteredItems = [...this.items];
    } else {
      const q = this.query.toLowerCase();
      this.filteredItems = this.items.filter((item) => {
        return (
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false) ||
          (item.category?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    if (this.selectedIndex >= this.filteredItems.length) {
      this.selectedIndex = Math.max(0, this.filteredItems.length - 1);
    }
  }

  /** Handle keyboard input. Returns true if the event was consumed. */
  handleKey(key: string, ctrl = false, meta = false): boolean {
    if (!this.visible) {
      if ((ctrl || meta) && key === "k") {
        this.show();
        return true;
      }
      return false;
    }

    if (key === "Escape") {
      this.hide();
      return true;
    }

    if (key === "ArrowDown") {
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredItems.length - 1);
      return true;
    }

    if (key === "ArrowUp") {
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      return true;
    }

    if (key === "Enter") {
      if (this.filteredItems[this.selectedIndex]) {
        this.filteredItems[this.selectedIndex].action();
        this.hide();
      }
      return true;
    }

    if (key === "Backspace") {
      this.query = this.query.slice(0, -1);
      this.filter();
      return true;
    }

    // Printable character
    if (key.length === 1 && !ctrl && !meta) {
      this.query += key;
      this.filter();
      return true;
    }

    return false;
  }

  /** Render the command palette overlay */
  render(ctx: CanvasRenderingContext2D, containerW: number, containerH: number): void {
    if (!this.visible) return;

    // Dim background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, containerW, containerH);

    // Palette dimensions
    const paletteW = Math.min(520, containerW - 60);
    const itemH = 36;
    const inputH = 42;
    const maxVisible = Math.min(this.filteredItems.length, 8);
    const paletteH = inputH + maxVisible * itemH + 12;
    const px = (containerW - paletteW) / 2;
    const py = Math.max(80, containerH * 0.2);

    // Glass background
    ctx.save();
    ctx.fillStyle = "rgba(15, 20, 35, 0.92)";
    ctx.strokeStyle = NeonTheme.border;
    ctx.lineWidth = 1;

    // Rounded rect
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + paletteW - r, py);
    ctx.quadraticCurveTo(px + paletteW, py, px + paletteW, py + r);
    ctx.lineTo(px + paletteW, py + paletteH - r);
    ctx.quadraticCurveTo(px + paletteW, py + paletteH, px + paletteW - r, py + paletteH);
    ctx.lineTo(px + r, py + paletteH);
    ctx.quadraticCurveTo(px, py + paletteH, px, py + paletteH - r);
    ctx.lineTo(px, py + r);
    ctx.quadraticCurveTo(px, py, px + r, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle glow
    ctx.shadowColor = NeonTheme.accent;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "rgba(0, 212, 170, 0.15)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Search input area
    const inputY = py + 6;
    const inputX = px + 12;

    // Search icon
    ctx.fillStyle = NeonTheme.textDim;
    ctx.font = "13px system-ui";
    ctx.textBaseline = "middle";
    ctx.fillText(">", inputX, inputY + inputH / 2);

    // Input text
    ctx.font = "14px system-ui";
    ctx.fillStyle = this.query ? NeonTheme.text : NeonTheme.textDim;
    const displayText = this.query || "Type to search...";
    ctx.fillText(displayText, inputX + 18, inputY + inputH / 2);

    // Cursor blink
    const cursorX = inputX + 18 + ctx.measureText(this.query).width + 2;
    const blink = Math.floor(Date.now() / 530) % 2 === 0;
    if (blink) {
      ctx.fillStyle = NeonTheme.accent;
      ctx.fillRect(cursorX, inputY + 10, 1.5, inputH - 20);
    }

    // Divider line below input
    ctx.strokeStyle = NeonTheme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 8, inputY + inputH);
    ctx.lineTo(px + paletteW - 8, inputY + inputH);
    ctx.stroke();

    // Results
    const listY = inputY + inputH + 4;
    ctx.textBaseline = "middle";

    for (let i = 0; i < maxVisible; i++) {
      const item = this.filteredItems[i];
      if (!item) break;

      const iy = listY + i * itemH;
      const isSelected = i === this.selectedIndex;

      // Highlight selected
      if (isSelected) {
        ctx.fillStyle = "rgba(0, 212, 170, 0.1)";
        ctx.fillRect(px + 4, iy, paletteW - 8, itemH);
        // Left accent bar
        ctx.fillStyle = NeonTheme.accent;
        ctx.fillRect(px + 4, iy + 4, 2, itemH - 8);
      }

      // Category badge
      let textX = px + 16;
      if (item.category) {
        ctx.fillStyle = "rgba(77, 171, 247, 0.15)";
        ctx.font = "bold 8px system-ui";
        const catW = ctx.measureText(item.category.toUpperCase()).width + 8;
        ctx.fillRect(textX, iy + (itemH - 16) / 2, catW, 16);
        ctx.fillStyle = NeonTheme.accent2;
        ctx.fillText(item.category.toUpperCase(), textX + 4, iy + itemH / 2);
        textX += catW + 8;
      }

      // Icon
      if (item.icon) {
        ctx.font = "13px system-ui";
        ctx.fillStyle = NeonTheme.textDim;
        ctx.fillText(item.icon, textX, iy + itemH / 2);
        textX += 20;
      }

      // Label
      ctx.font = isSelected ? "bold 12px system-ui" : "12px system-ui";
      ctx.fillStyle = isSelected ? NeonTheme.text : NeonTheme.textDim;
      ctx.fillText(item.label, textX, iy + itemH / 2);

      // Description (right-aligned)
      if (item.description) {
        ctx.font = "10px system-ui";
        ctx.fillStyle = "rgba(107, 123, 141, 0.6)";
        ctx.textAlign = "right";
        ctx.fillText(item.description, px + paletteW - 16, iy + itemH / 2);
        ctx.textAlign = "left";
      }
    }

    // Footer hint
    if (this.filteredItems.length > 0) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = "9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Up/Down navigate  Enter select  Esc close", containerW / 2, py + paletteH - 4);
      ctx.textAlign = "left";
    } else if (this.query.length > 0) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("No results", containerW / 2, listY + 20);
      ctx.textAlign = "left";
    }

    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
}
