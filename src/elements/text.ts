/**
 * Area42 v2 Text Element
 *
 * Styled text block with word wrap, alignment, and style inheritance.
 * Zero dependencies — uses Canvas 2D measureText for layout.
 */

import { SceneNode, type Vec2 } from "../core/scene.js";

export type TextAlign = "left" | "center" | "right";
export type TextWeight = "normal" | "bold" | "light";

export interface TextOptions {
  id?: string;
  text: string;
  size?: Vec2;
  align?: TextAlign;
  weight?: TextWeight;
  color?: string;
  fontSize?: number;
  lineHeight?: number;
  /** If true, text is uppercase */
  uppercase?: boolean;
  /** If true, wraps text to fit width */
  wrap?: boolean;
  /** Letter spacing in px */
  letterSpacing?: number;
  /** Dim style (uses textDim color) */
  dim?: boolean;
}

export class Text extends SceneNode {
  private _text: string;
  private _align: TextAlign;
  private _weight: TextWeight;
  private _color?: string;
  private _fontSize?: number;
  private _lineHeight: number;
  private _uppercase: boolean;
  private _wrap: boolean;
  private _letterSpacing: number;
  private _dim: boolean;
  private _lines: string[] | null = null;

  constructor(options: TextOptions) {
    super({
      id: options.id,
      size: options.size ?? { x: 200, y: 20 },
    });
    this._text = options.text;
    this._align = options.align ?? "left";
    this._weight = options.weight ?? "normal";
    this._color = options.color;
    this._fontSize = options.fontSize;
    this._lineHeight = options.lineHeight ?? 1.4;
    this._uppercase = options.uppercase ?? false;
    this._wrap = options.wrap ?? true;
    this._letterSpacing = options.letterSpacing ?? 0;
    this._dim = options.dim ?? false;
  }

  /** Update the text content */
  setText(text: string): void {
    this._text = text;
    this._lines = null; // Invalidate wrap cache
  }

  /** Get current text */
  getText(): string {
    return this._text;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.resolvedStyle();
    const fontSize = this._fontSize ?? s.fontSize;
    const fontWeight = this._weight === "bold" ? "bold" : this._weight === "light" ? "300" : "";
    const font = `${fontWeight} ${fontSize}px ${s.fontFamily}`.trim();

    ctx.font = font;
    ctx.fillStyle = this._color ?? (this._dim ? s.textDim : s.fg);
    ctx.textBaseline = "top";
    ctx.letterSpacing = this._letterSpacing ? `${this._letterSpacing}px` : "0px";

    const text = this._uppercase ? this._text.toUpperCase() : this._text;
    const lineH = fontSize * this._lineHeight;

    if (this._wrap) {
      // Word wrap
      if (!this._lines) {
        this._lines = this._wrapText(ctx, text, this.size.x);
      }

      for (let i = 0; i < this._lines.length; i++) {
        const y = i * lineH;
        if (y + lineH > this.size.y) break; // Clip to height
        const x = this._getAlignX(ctx, this._lines[i], this.size.x);
        ctx.fillText(this._lines[i], x, y);
      }
    } else {
      // Single line
      const x = this._getAlignX(ctx, text, this.size.x);
      ctx.fillText(text, x, 0);
    }

    ctx.letterSpacing = "0px";
  }

  private _getAlignX(ctx: CanvasRenderingContext2D, text: string, width: number): number {
    switch (this._align) {
      case "center": return (width - ctx.measureText(text).width) / 2;
      case "right": return width - ctx.measureText(text).width;
      default: return 0;
    }
  }

  private _wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}
