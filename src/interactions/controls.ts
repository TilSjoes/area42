/**
 * Area42 Interactive Controls
 *
 * Canvas-rendered UI controls with neon/glass theme.
 * Knob (rotary dial), Slider, Toggle, InputField.
 * All controls emit onChange callbacks and render via ctx.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

// ─── Knob ───────────────────────────────────────────────────────────

export interface KnobOptions {
  value?: number;      // 0-1 normalized
  min?: number;        // display min (default 0)
  max?: number;        // display max (default 100)
  label?: string;      // label below knob
  size?: number;       // diameter in px (default 80)
  color?: string;      // accent color
  steps?: number;      // snap to N steps (0 = continuous)
  unit?: string;       // display unit suffix (e.g., "K", "%", "ms")
  onChange?: (value: number, displayValue: number) => void;
}

/**
 * Rotary knob control. Drag up/down to change value.
 * Renders as a neon ring with indicator dot and glow.
 *
 * ```ts
 * const knob = new Knob({ label: "Parallel", min: 1, max: 4, steps: 4 });
 * knob.render(ctx, x, y);
 * ```
 */
export class Knob {
  value: number;
  min: number;
  max: number;
  label: string;
  size: number;
  color: string;
  steps: number;
  unit: string;
  onChange: ((value: number, displayValue: number) => void) | null;

  private _dragging = false;
  private _dragStartY = 0;
  private _dragStartValue = 0;
  private _hover = false;
  private _cx = 0;
  private _cy = 0;

  constructor(options: KnobOptions = {}) {
    this.value = options.value ?? 0.5;
    this.min = options.min ?? 0;
    this.max = options.max ?? 100;
    this.label = options.label ?? "";
    this.size = options.size ?? 80;
    this.color = options.color ?? NeonTheme.accent;
    this.steps = options.steps ?? 0;
    this.unit = options.unit ?? "";
    this.onChange = options.onChange ?? null;
  }

  get displayValue(): number {
    return this.min + this.value * (this.max - this.min);
  }

  set displayValue(v: number) {
    this.value = Math.max(0, Math.min(1, (v - this.min) / (this.max - this.min)));
  }

  private snap(v: number): number {
    if (this.steps <= 0) return v;
    const step = 1 / this.steps;
    return Math.round(v / step) * step;
  }

  /** Check if point is within knob bounds */
  hitTest(mx: number, my: number): boolean {
    const dx = mx - this._cx;
    const dy = my - this._cy;
    return dx * dx + dy * dy <= (this.size / 2 + 8) * (this.size / 2 + 8);
  }

  /** Call from canvas mousedown */
  onMouseDown(mx: number, my: number): boolean {
    if (!this.hitTest(mx, my)) return false;
    this._dragging = true;
    this._dragStartY = my;
    this._dragStartValue = this.value;
    return true;
  }

  /** Call from canvas mousemove */
  onMouseMove(mx: number, my: number): boolean {
    this._hover = this.hitTest(mx, my);
    if (!this._dragging) return false;
    const dy = this._dragStartY - my;  // up = increase
    const sensitivity = 200;
    let newValue = this._dragStartValue + dy / sensitivity;
    newValue = Math.max(0, Math.min(1, newValue));
    newValue = this.snap(newValue);
    if (newValue !== this.value) {
      this.value = newValue;
      this.onChange?.(this.value, this.displayValue);
    }
    return true;
  }

  /** Call from canvas mouseup */
  onMouseUp(): void {
    this._dragging = false;
  }

  /** Render the knob centered at (x, y) */
  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    this._cx = x;
    this._cy = y;

    const r = this.size / 2 - 4;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalArc = endAngle - startAngle;
    const valueAngle = startAngle + totalArc * this.value;

    ctx.save();

    // Outer ring (background)
    ctx.beginPath();
    ctx.arc(x, y, r, startAngle, endAngle);
    ctx.strokeStyle = withAlpha(NeonTheme.border, "66");
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();

    // Step marks
    if (this.steps > 0) {
      for (let i = 0; i <= this.steps; i++) {
        const a = startAngle + totalArc * (i / this.steps);
        const ir = r - 8;
        const or_ = r + 8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * ir, y + Math.sin(a) * ir);
        ctx.lineTo(x + Math.cos(a) * or_, y + Math.sin(a) * or_);
        ctx.strokeStyle = withAlpha(NeonTheme.textDim, "44");
        ctx.lineWidth = 1;
        ctx.lineCap = "butt";
        ctx.stroke();
      }
    }

    // Value arc (colored, glowing)
    if (this.value > 0.01) {
      ctx.beginPath();
      ctx.arc(x, y, r, startAngle, valueAngle);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this._dragging ? 16 : (this._hover ? 12 : 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Indicator dot at current position
    const dotR = this._dragging ? 7 : 5;
    const dotX = x + Math.cos(valueAngle) * r;
    const dotY = y + Math.sin(valueAngle) * r;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner fill (glass)
    ctx.beginPath();
    ctx.arc(x, y, r - 10, 0, Math.PI * 2);
    ctx.fillStyle = this._hover || this._dragging
      ? withAlpha(this.color, "0a")
      : "rgba(255,255,255,0.02)";
    ctx.fill();

    // Value text (center)
    const dv = this.displayValue;
    const displayText = Number.isInteger(dv) ? String(dv) : dv.toFixed(1);
    const fontSize = Math.max(12, Math.floor(this.size * 0.24));
    ctx.fillStyle = NeonTheme.text;
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayText + this.unit, x, y - (this.label ? 4 : 0));

    // Label below
    if (this.label) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = `${Math.max(8, Math.floor(this.size * 0.12))}px system-ui`;
      ctx.fillText(this.label, x, y + fontSize * 0.5 + 4);
    }

    // Drag hint
    if (this._hover && !this._dragging) {
      ctx.fillStyle = withAlpha(NeonTheme.textDim, "66");
      ctx.font = "7px system-ui";
      ctx.fillText("drag ↕", x, y + this.size / 2 + 8);
    }

    ctx.restore();
  }
}

// ─── Slider ─────────────────────────────────────────────────────────

export interface SliderOptions {
  value?: number;       // 0-1 normalized
  min?: number;
  max?: number;
  label?: string;
  width?: number;       // track width (default 200)
  color?: string;
  steps?: number;
  unit?: string;
  showValue?: boolean;
  onChange?: (value: number, displayValue: number) => void;
}

/**
 * Horizontal slider control.
 *
 * ```ts
 * const slider = new Slider({ label: "Context", min: 16, max: 128, unit: "K" });
 * slider.render(ctx, x, y, w);
 * ```
 */
export class Slider {
  value: number;
  min: number;
  max: number;
  label: string;
  width: number;
  color: string;
  steps: number;
  unit: string;
  showValue: boolean;
  onChange: ((value: number, displayValue: number) => void) | null;

  private _dragging = false;
  private _hover = false;
  private _trackX = 0;
  private _trackY = 0;
  private _trackW = 0;

  constructor(options: SliderOptions = {}) {
    this.value = options.value ?? 0.5;
    this.min = options.min ?? 0;
    this.max = options.max ?? 100;
    this.label = options.label ?? "";
    this.width = options.width ?? 200;
    this.color = options.color ?? NeonTheme.accent;
    this.steps = options.steps ?? 0;
    this.unit = options.unit ?? "";
    this.showValue = options.showValue ?? true;
    this.onChange = options.onChange ?? null;
  }

  get displayValue(): number {
    return this.min + this.value * (this.max - this.min);
  }

  private snap(v: number): number {
    if (this.steps <= 0) return v;
    const step = 1 / this.steps;
    return Math.round(v / step) * step;
  }

  hitTest(mx: number, my: number): boolean {
    return mx >= this._trackX - 4 && mx <= this._trackX + this._trackW + 4 &&
           my >= this._trackY - 12 && my <= this._trackY + 12;
  }

  onMouseDown(mx: number, my: number): boolean {
    if (!this.hitTest(mx, my)) return false;
    this._dragging = true;
    this._updateFromMouse(mx);
    return true;
  }

  onMouseMove(mx: number, my: number): boolean {
    this._hover = this.hitTest(mx, my);
    if (!this._dragging) return false;
    this._updateFromMouse(mx);
    return true;
  }

  onMouseUp(): void {
    this._dragging = false;
  }

  private _updateFromMouse(mx: number): void {
    let v = (mx - this._trackX) / this._trackW;
    v = Math.max(0, Math.min(1, v));
    v = this.snap(v);
    if (v !== this.value) {
      this.value = v;
      this.onChange?.(this.value, this.displayValue);
    }
  }

  /** Render at (x, y) with optional width override */
  render(ctx: CanvasRenderingContext2D, x: number, y: number, w?: number): void {
    const trackW = w ?? this.width;
    this._trackX = x;
    this._trackY = y;
    this._trackW = trackW;

    const thumbX = x + trackW * this.value;

    ctx.save();

    // Label (left)
    if (this.label) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, x, y - 14);
    }

    // Value (right)
    if (this.showValue) {
      const dv = this.displayValue;
      const text = (Number.isInteger(dv) ? String(dv) : dv.toFixed(1)) + this.unit;
      ctx.fillStyle = this.color;
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(text, x + trackW, y - 14);
    }

    // Track background
    ctx.fillStyle = withAlpha(NeonTheme.border, "44");
    ctx.beginPath();
    ctx.roundRect(x, y - 3, trackW, 6, 3);
    ctx.fill();

    // Step marks
    if (this.steps > 0) {
      for (let i = 0; i <= this.steps; i++) {
        const sx = x + trackW * (i / this.steps);
        ctx.fillStyle = withAlpha(NeonTheme.textDim, "44");
        ctx.fillRect(sx - 0.5, y - 6, 1, 12);
      }
    }

    // Filled track
    if (this.value > 0.01) {
      ctx.fillStyle = withAlpha(this.color, "88");
      ctx.beginPath();
      ctx.roundRect(x, y - 3, trackW * this.value, 6, 3);
      ctx.fill();
    }

    // Thumb
    const thumbR = this._dragging ? 8 : (this._hover ? 7 : 6);
    ctx.beginPath();
    ctx.arc(thumbX, y, thumbR, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this._dragging ? 14 : 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Thumb inner dot
    ctx.beginPath();
    ctx.arc(thumbX, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = NeonTheme.bg;
    ctx.fill();

    ctx.restore();
  }
}

// ─── Toggle ─────────────────────────────────────────────────────────

export interface ToggleOptions {
  value?: boolean;
  label?: string;
  onLabel?: string;
  offLabel?: string;
  color?: string;
  width?: number;
  onChange?: (value: boolean) => void;
}

/**
 * On/off toggle switch with neon glow.
 *
 * ```ts
 * const toggle = new Toggle({ label: "Agent Loop", value: true });
 * toggle.render(ctx, x, y);
 * ```
 */
export class Toggle {
  value: boolean;
  label: string;
  onLabel: string;
  offLabel: string;
  color: string;
  width: number;
  onChange: ((value: boolean) => void) | null;

  private _hover = false;
  private _x = 0;
  private _y = 0;
  private _animPos = 0;  // 0 = off, 1 = on

  constructor(options: ToggleOptions = {}) {
    this.value = options.value ?? false;
    this.label = options.label ?? "";
    this.onLabel = options.onLabel ?? "ON";
    this.offLabel = options.offLabel ?? "OFF";
    this.color = options.color ?? NeonTheme.accent;
    this.width = options.width ?? 44;
    this.onChange = options.onChange ?? null;
    this._animPos = this.value ? 1 : 0;
  }

  hitTest(mx: number, my: number): boolean {
    return mx >= this._x && mx <= this._x + this.width &&
           my >= this._y - 10 && my <= this._y + 10;
  }

  onMouseDown(mx: number, my: number): boolean {
    if (!this.hitTest(mx, my)) return false;
    this.value = !this.value;
    this.onChange?.(this.value);
    return true;
  }

  onMouseMove(mx: number, my: number): boolean {
    this._hover = this.hitTest(mx, my);
    return false;
  }

  onMouseUp(): void {}

  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    this._x = x;
    this._y = y;

    // Animate position
    const target = this.value ? 1 : 0;
    this._animPos += (target - this._animPos) * 0.15;
    if (Math.abs(this._animPos - target) < 0.01) this._animPos = target;

    const h = 20;
    const r = h / 2;
    const thumbX = x + r + (this.width - h) * this._animPos;
    const color = this.value ? this.color : NeonTheme.textDim;

    ctx.save();

    // Track
    ctx.beginPath();
    ctx.roundRect(x, y - r, this.width, h, r);
    ctx.fillStyle = this.value
      ? withAlpha(this.color, "22")
      : "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, "44");
    ctx.lineWidth = 1;
    ctx.stroke();

    // Thumb
    ctx.beginPath();
    ctx.arc(thumbX, y, r - 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.value ? 10 : 0;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label (right of toggle)
    if (this.label) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, x + this.width + 8, y);
    }

    // State label inside track
    const stateLabel = this.value ? this.onLabel : this.offLabel;
    ctx.fillStyle = withAlpha(color, "88");
    ctx.font = "bold 7px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelX = this.value ? x + r * 0.8 : x + this.width - r * 0.8;
    ctx.fillText(stateLabel, labelX, y);

    ctx.restore();
  }
}

// ─── InputField ─────────────────────────────────────────────────────

export interface InputFieldOptions {
  value?: string;
  placeholder?: string;
  label?: string;
  width?: number;
  color?: string;
  maxLength?: number;
  onSubmit?: (value: string) => void;
  onChange?: (value: string) => void;
}

/**
 * Text input field rendered on canvas.
 * Supports focus, cursor, basic editing (type, backspace, enter).
 * Uses a hidden DOM input for actual text capture.
 *
 * ```ts
 * const input = new InputField({ placeholder: "Mission objective...", width: 300 });
 * input.render(ctx, x, y);
 * ```
 */
export class InputField {
  value: string;
  placeholder: string;
  label: string;
  width: number;
  color: string;
  maxLength: number;
  onSubmit: ((value: string) => void) | null;
  onChange: ((value: string) => void) | null;

  private _focused = false;
  private _hover = false;
  private _x = 0;
  private _y = 0;
  private _cursorBlink = 0;
  private _hiddenInput: HTMLInputElement | null = null;

  constructor(options: InputFieldOptions = {}) {
    this.value = options.value ?? "";
    this.placeholder = options.placeholder ?? "";
    this.label = options.label ?? "";
    this.width = options.width ?? 200;
    this.color = options.color ?? NeonTheme.accent;
    this.maxLength = options.maxLength ?? 500;
    this.onSubmit = options.onSubmit ?? null;
    this.onChange = options.onChange ?? null;
  }

  /** Attach to a canvas container for keyboard capture */
  attach(container: HTMLElement): void {
    if (this._hiddenInput) return;
    const input = document.createElement("input");
    input.type = "text";
    input.style.cssText = "position:absolute;left:-9999px;top:-9999px;opacity:0;width:1px;height:1px;";
    input.maxLength = this.maxLength;
    container.appendChild(input);
    this._hiddenInput = input;

    input.addEventListener("input", () => {
      this.value = input.value;
      this.onChange?.(this.value);
    });
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        this.onSubmit?.(this.value);
      }
      if (e.key === "Escape") {
        this._focused = false;
        input.blur();
      }
    });
    input.addEventListener("blur", () => {
      this._focused = false;
    });
  }

  hitTest(mx: number, my: number): boolean {
    return mx >= this._x && mx <= this._x + this.width &&
           my >= this._y - 14 && my <= this._y + 14;
  }

  onMouseDown(mx: number, my: number): boolean {
    if (!this.hitTest(mx, my)) {
      if (this._focused) {
        this._focused = false;
        this._hiddenInput?.blur();
      }
      return false;
    }
    this._focused = true;
    if (this._hiddenInput) {
      this._hiddenInput.value = this.value;
      this._hiddenInput.focus();
    }
    return true;
  }

  onMouseMove(mx: number, my: number): boolean {
    this._hover = this.hitTest(mx, my);
    return false;
  }

  onMouseUp(): void {}

  /** Clear the input */
  clear(): void {
    this.value = "";
    if (this._hiddenInput) this._hiddenInput.value = "";
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number, w?: number): void {
    this._x = x;
    this._y = y;
    const width = w ?? this.width;
    const h = 28;
    this._cursorBlink = (this._cursorBlink + 0.03) % 2;

    ctx.save();

    // Label above
    if (this.label) {
      ctx.fillStyle = NeonTheme.textDim;
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(this.label, x, y - h / 2 - 2);
    }

    // Background
    ctx.beginPath();
    ctx.roundRect(x, y - h / 2, width, h, 4);
    ctx.fillStyle = this._focused
      ? "rgba(255,255,255,0.06)"
      : (this._hover ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)");
    ctx.fill();

    // Border
    ctx.strokeStyle = this._focused
      ? withAlpha(this.color, "66")
      : withAlpha(NeonTheme.border, "44");
    ctx.lineWidth = 1;
    ctx.stroke();

    // Focus glow
    if (this._focused) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Text or placeholder
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const textX = x + 8;
    const textY = y;
    const maxTextW = width - 16;

    if (this.value) {
      ctx.fillStyle = NeonTheme.text;
      // Truncate from left if too wide
      let display = this.value;
      while (display.length > 1 && ctx.measureText(display).width > maxTextW) {
        display = display.slice(1);
      }
      ctx.fillText(display, textX, textY);

      // Cursor
      if (this._focused && this._cursorBlink < 1) {
        const cursorX = textX + ctx.measureText(display).width + 1;
        ctx.fillStyle = this.color;
        ctx.fillRect(cursorX, y - 8, 1.5, 16);
      }
    } else {
      ctx.fillStyle = withAlpha(NeonTheme.textDim, "66");
      ctx.fillText(this.placeholder, textX, textY);

      // Cursor at start when focused
      if (this._focused && this._cursorBlink < 1) {
        ctx.fillStyle = this.color;
        ctx.fillRect(textX, y - 8, 1.5, 16);
      }
    }

    ctx.restore();
  }

  destroy(): void {
    this._hiddenInput?.remove();
    this._hiddenInput = null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Wire all controls in an array to a canvas element.
 * Handles mousedown/mousemove/mouseup delegation.
 */
export function wireControls(
  canvas: HTMLCanvasElement,
  controls: Array<Knob | Slider | Toggle | InputField>,
): () => void {
  function getPoint(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: MouseEvent) {
    const p = getPoint(e);
    for (const c of controls) {
      if (c.onMouseDown(p.x, p.y)) {
        e.preventDefault();
        break;
      }
    }
  }

  function onMove(e: MouseEvent) {
    const p = getPoint(e);
    let handled = false;
    for (const c of controls) {
      if (c.onMouseMove(p.x, p.y)) handled = true;
    }
    canvas.style.cursor = handled ? "grabbing" : (
      controls.some(c => (c as any)._hover) ? "pointer" : "default"
    );
  }

  function onUp() {
    for (const c of controls) c.onMouseUp();
  }

  canvas.addEventListener("mousedown", onDown);
  canvas.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);

  return () => {
    canvas.removeEventListener("mousedown", onDown);
    canvas.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
}
