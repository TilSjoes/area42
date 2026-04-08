/**
 * Area42 v2 Button Element
 *
 * Canvas-rendered clickable button with hover/active states.
 * Uses resolved style for colors. Integrates with the container
 * event system for click handling.
 */

import { SceneNode, type Vec2 } from "../core/scene.js";

export type ButtonVariant = "default" | "accent" | "danger" | "warning" | "ghost";

export interface ButtonOptions {
  id?: string;
  label: string;
  size?: Vec2;
  variant?: ButtonVariant;
  /** Custom accent color (overrides variant) */
  color?: string;
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
}

export class Button extends SceneNode {
  private _label: string;
  private _variant: ButtonVariant;
  private _color?: string;
  private _onClick?: () => void;
  private _disabled: boolean;

  /** Visual states (set by HUD event system or external code) */
  hovered = false;
  pressed = false;

  constructor(options: ButtonOptions) {
    super({
      id: options.id,
      size: options.size ?? { x: 120, y: 32 },
      interactive: true,
    });
    this._label = options.label;
    this._variant = options.variant ?? "default";
    this._color = options.color;
    this._onClick = options.onClick;
    this._disabled = options.disabled ?? false;
  }

  /** Set click handler */
  onClick(handler: () => void): this {
    this._onClick = handler;
    return this;
  }

  /** Trigger the click handler */
  click(): void {
    if (!this._disabled && this._onClick) {
      this._onClick();
    }
  }

  /** Set disabled state */
  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
  }

  /** Update label */
  setLabel(label: string): void {
    this._label = label;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.resolvedStyle();
    const w = this.size.x;
    const h = this.size.y;
    const r = Math.min(4, s.borderRadius);

    // Determine colors from variant
    let btnColor: string;
    let textColor: string;
    switch (this._variant) {
      case "accent":
        btnColor = this._color ?? s.accent;
        textColor = "#ffffff";
        break;
      case "danger":
        btnColor = s.danger;
        textColor = "#ffffff";
        break;
      case "warning":
        btnColor = s.warning;
        textColor = "#0a0e17";
        break;
      case "ghost":
        btnColor = "transparent";
        textColor = this._color ?? s.accent;
        break;
      default:
        btnColor = this._color ?? s.accent;
        textColor = btnColor;
        break;
    }

    if (this._disabled) {
      ctx.globalAlpha *= 0.4;
    }

    ctx.save();

    // Background
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);

    if (this._variant === "ghost") {
      // Ghost: no fill, just border on hover
      if (this.hovered) {
        ctx.fillStyle = textColor + "10";
        ctx.fill();
      }
      ctx.strokeStyle = textColor + (this.hovered ? "44" : "22");
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (this._variant === "default") {
      // Default: outline style
      ctx.fillStyle = this.pressed ? btnColor + "22" : this.hovered ? btnColor + "15" : btnColor + "0a";
      ctx.fill();
      ctx.strokeStyle = this.hovered ? btnColor + "66" : btnColor + "33";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Filled variants (accent, danger, warning)
      const alpha = this.pressed ? "cc" : this.hovered ? "ee" : "bb";
      ctx.fillStyle = btnColor + alpha;
      ctx.fill();

      if (this.hovered) {
        ctx.shadowColor = btnColor;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = btnColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Label
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.max(9, s.fontSize - 1)}px ${s.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "0.5px";
    ctx.fillText(this._label.toUpperCase(), w / 2, h / 2);
    ctx.textAlign = "left";
    ctx.letterSpacing = "0px";

    ctx.restore();
  }
}
