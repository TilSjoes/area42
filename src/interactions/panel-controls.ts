/**
 * Area42 Panel Controls — HTML overlay controls positioned relative to panels.
 *
 * Controls are DOM elements that stay anchored to their parent Panel's
 * canvas position. They move when the panel moves, hide when collapsed,
 * and support touch/keyboard natively.
 *
 * Usage:
 * ```ts
 * const cm = new ControlManager(container);
 * const slider = cm.slider(panel, { x: 120, y: 30, min: 1, max: 4, label: "Parallel" });
 * slider.onChange = (v) => console.log(v);
 * // Call cm.update() each frame to sync positions
 * ```
 */

import { NeonTheme } from "../themes/neon.js";

// ─── CSS Injection ──────────────────────────────────────────────

let cssInjected = false;

function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .a42-control-container {
      position: absolute;
      top: 0; left: 0;
      pointer-events: none;
      z-index: 15;
      transition: opacity 0.2s;
    }
    .a42-control-container.hidden { opacity: 0; pointer-events: none; }
    .a42-control {
      position: absolute;
      pointer-events: auto;
      font-family: system-ui, -apple-system, sans-serif;
    }

    /* ── Button ── */
    .a42-btn {
      padding: 5px 12px;
      border: 1px solid rgba(0,212,170,0.3);
      background: rgba(0,212,170,0.08);
      color: #00d4aa;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 4px;
      letter-spacing: 0.05em;
      transition: all 0.15s;
      text-transform: uppercase;
    }
    .a42-btn:hover { background: rgba(0,212,170,0.15); border-color: rgba(0,212,170,0.5); }
    .a42-btn:active { transform: scale(0.97); }
    .a42-btn.active { background: rgba(0,212,170,0.2); box-shadow: 0 0 8px rgba(0,212,170,0.3); }
    .a42-btn.danger { color: #ff6b6b; border-color: rgba(255,107,107,0.3); background: rgba(255,107,107,0.08); }
    .a42-btn.danger:hover { background: rgba(255,107,107,0.15); }
    .a42-btn.warning { color: #ffd43b; border-color: rgba(255,212,59,0.3); background: rgba(255,212,59,0.08); }

    /* ── Radio Group ── */
    .a42-radio-group {
      display: flex;
      gap: 0;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .a42-radio-btn {
      padding: 5px 14px;
      background: rgba(255,255,255,0.03);
      color: #6b7b8d;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      border-right: 1px solid rgba(255,255,255,0.06);
      transition: all 0.15s;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .a42-radio-btn:last-child { border-right: none; }
    .a42-radio-btn:hover { background: rgba(255,255,255,0.06); color: #c8d6e5; }
    .a42-radio-btn.active {
      background: rgba(0,212,170,0.15);
      color: #00d4aa;
      box-shadow: inset 0 0 10px rgba(0,212,170,0.1);
    }

    /* ── Slider ── */
    .a42-slider-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .a42-slider-header {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #6b7b8d;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .a42-slider-value { color: #00d4aa; }
    .a42-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.06);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    .a42-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #00d4aa;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(0,212,170,0.5);
      transition: box-shadow 0.15s;
    }
    .a42-slider::-webkit-slider-thumb:hover {
      box-shadow: 0 0 14px rgba(0,212,170,0.7);
    }
    .a42-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #00d4aa;
      cursor: pointer;
      border: none;
      box-shadow: 0 0 8px rgba(0,212,170,0.5);
    }

    /* ── Toggle ── */
    .a42-toggle-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .a42-toggle-track {
      width: 36px;
      height: 18px;
      border-radius: 9px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      position: relative;
      transition: all 0.2s;
    }
    .a42-toggle-track.on {
      background: rgba(0,212,170,0.2);
      border-color: rgba(0,212,170,0.4);
    }
    .a42-toggle-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #6b7b8d;
      position: absolute;
      top: 1px;
      left: 1px;
      transition: all 0.2s;
    }
    .a42-toggle-track.on .a42-toggle-thumb {
      left: 19px;
      background: #00d4aa;
      box-shadow: 0 0 8px rgba(0,212,170,0.5);
    }
    .a42-toggle-label {
      font-size: 10px;
      color: #6b7b8d;
    }
    .a42-toggle-track.on + .a42-toggle-label { color: #c8d6e5; }

    /* ── Input ── */
    .a42-input {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      color: #c8d6e5;
      font-size: 11px;
      font-family: system-ui;
      padding: 5px 8px;
      border-radius: 4px;
      outline: none;
      transition: border-color 0.15s;
    }
    .a42-input:focus {
      border-color: rgba(0,212,170,0.5);
      box-shadow: 0 0 6px rgba(0,212,170,0.15);
    }
    .a42-input::placeholder { color: rgba(107,123,141,0.5); }

    /* ── Label ── */
    .a42-label {
      font-size: 8px;
      color: #6b7b8d;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 2px;
    }
  `;
  document.head.appendChild(style);
}


// ─── Types ──────────────────────────────────────────────────────

interface ControlBase {
  element: HTMLElement;
  panel: any;  // Panel reference
  offset: { x: number; y: number };
  destroy: () => void;
}

export interface ButtonControl extends ControlBase {
  type: "button";
  onClick: ((e: MouseEvent) => void) | null;
  setText: (text: string) => void;
  setLoading: (loading: boolean) => void;
}

export interface RadioGroupControl extends ControlBase {
  type: "radioGroup";
  value: number;
  onChange: ((index: number, label: string) => void) | null;
  setValue: (index: number) => void;
}

export interface SliderControl extends ControlBase {
  type: "slider";
  value: number;
  displayValue: number;
  onChange: ((value: number, displayValue: number) => void) | null;
  setValue: (normalized: number) => void;
}

export interface ToggleControl extends ControlBase {
  type: "toggle";
  value: boolean;
  onChange: ((value: boolean) => void) | null;
  setValue: (on: boolean) => void;
}

export interface InputControl extends ControlBase {
  type: "input";
  value: string;
  onChange: ((value: string) => void) | null;
  onSubmit: ((value: string) => void) | null;
  clear: () => void;
}

export type PanelControl = ButtonControl | RadioGroupControl | SliderControl | ToggleControl | InputControl;


// ─── Control Manager ────────────────────────────────────────────

/**
 * Manages HTML overlay controls anchored to Area42 panels.
 * Call update() every frame (or use autoUpdate) to sync positions.
 */
export class ControlManager {
  private container: HTMLElement;
  private controls: PanelControl[] = [];
  private panelContainers = new Map<any, HTMLDivElement>();
  private animId: number | null = null;

  constructor(container: HTMLElement, autoUpdate = true) {
    injectCSS();
    this.container = container;
    if (autoUpdate) this.startAutoUpdate();
  }

  private getOrCreatePanelContainer(panel: any): HTMLDivElement {
    let div = this.panelContainers.get(panel);
    if (!div) {
      div = document.createElement("div");
      div.className = "a42-control-container";
      this.container.appendChild(div);
      this.panelContainers.set(panel, div);
    }
    return div;
  }

  /** Sync all control container positions to their panel's worldPosition */
  update() {
    for (const [panel, div] of this.panelContainers) {
      const wp = panel.worldPosition ? panel.worldPosition() : panel.position;
      const hidden = panel.collapsed || panel.minimized || !panel.visible;
      div.classList.toggle("hidden", hidden);
      if (!hidden) {
        const headerH = panel.compact ? 22 : 28;
        const pad = panel.compact ? 4 : 8;
        div.style.transform = `translate(${wp.x + pad}px, ${wp.y + headerH + pad}px)`;
      }
    }
  }

  private startAutoUpdate() {
    const tick = () => {
      this.update();
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  // ── Button ──

  button(panel: any, opts: {
    x: number; y: number;
    label: string;
    color?: "accent" | "danger" | "warning";
    onClick?: (e: MouseEvent) => void;
  }): ButtonControl {
    const div = this.getOrCreatePanelContainer(panel);
    const btn = document.createElement("button");
    btn.className = `a42-control a42-btn ${opts.color === "danger" ? "danger" : opts.color === "warning" ? "warning" : ""}`;
    btn.textContent = opts.label;
    btn.style.left = opts.x + "px";
    btn.style.top = opts.y + "px";
    div.appendChild(btn);

    const control: ButtonControl = {
      type: "button",
      element: btn,
      panel,
      offset: { x: opts.x, y: opts.y },
      onClick: opts.onClick || null,
      setText: (text: string) => { btn.textContent = text; },
      setLoading: (loading: boolean) => {
        btn.style.opacity = loading ? "0.6" : "1";
        btn.style.pointerEvents = loading ? "none" : "auto";
      },
      destroy: () => { btn.remove(); this.removeControl(control); },
    };

    btn.addEventListener("click", (e) => control.onClick?.(e));
    this.controls.push(control);
    return control;
  }

  // ── Radio Group ──

  radioGroup(panel: any, opts: {
    x: number; y: number;
    options: string[];
    value?: number;
    colors?: string[];
    onChange?: (index: number, label: string) => void;
  }): RadioGroupControl {
    const div = this.getOrCreatePanelContainer(panel);
    const group = document.createElement("div");
    group.className = "a42-control a42-radio-group";
    group.style.left = opts.x + "px";
    group.style.top = opts.y + "px";

    const buttons: HTMLButtonElement[] = [];
    const colors = opts.colors || [];

    opts.options.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.className = "a42-radio-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        control.value = i;
        buttons.forEach((b, j) => b.classList.toggle("active", j === i));
        if (colors[i]) {
          buttons[i].style.color = colors[i];
          buttons[i].style.background = `${colors[i]}22`;
          buttons[i].style.boxShadow = `inset 0 0 10px ${colors[i]}15`;
        }
        control.onChange?.(i, label);
      });
      buttons.push(btn);
      group.appendChild(btn);
    });

    div.appendChild(group);

    const control: RadioGroupControl = {
      type: "radioGroup",
      element: group,
      panel,
      offset: { x: opts.x, y: opts.y },
      value: opts.value ?? 0,
      onChange: opts.onChange || null,
      setValue: (index: number) => {
        control.value = index;
        buttons.forEach((b, j) => {
          b.classList.toggle("active", j === index);
          if (j === index && colors[index]) {
            b.style.color = colors[index];
            b.style.background = `${colors[index]}22`;
          } else {
            b.style.color = "";
            b.style.background = "";
            b.style.boxShadow = "";
          }
        });
      },
      destroy: () => { group.remove(); this.removeControl(control); },
    };

    // Set initial value
    control.setValue(control.value);
    this.controls.push(control);
    return control;
  }

  // ── Slider ──

  slider(panel: any, opts: {
    x: number; y: number; width?: number;
    min?: number; max?: number; step?: number;
    value?: number;
    label?: string;
    unit?: string;
    color?: string;
    onChange?: (value: number, displayValue: number) => void;
  }): SliderControl {
    const div = this.getOrCreatePanelContainer(panel);
    const min = opts.min ?? 0;
    const max = opts.max ?? 100;
    const step = opts.step ?? 1;
    const width = opts.width ?? 180;
    const color = opts.color || "#00d4aa";

    const wrap = document.createElement("div");
    wrap.className = "a42-control a42-slider-wrap";
    wrap.style.left = opts.x + "px";
    wrap.style.top = opts.y + "px";
    wrap.style.width = width + "px";

    const header = document.createElement("div");
    header.className = "a42-slider-header";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = opts.label || "";
    const valueSpan = document.createElement("span");
    valueSpan.className = "a42-slider-value";
    valueSpan.style.color = color;
    header.appendChild(labelSpan);
    header.appendChild(valueSpan);

    const input = document.createElement("input");
    input.type = "range";
    input.className = "a42-slider";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(opts.value ?? min);
    input.style.accentColor = color;

    // Apply color to thumb via CSS custom property
    input.style.setProperty("--thumb-color", color);

    wrap.appendChild(header);
    wrap.appendChild(input);
    div.appendChild(wrap);

    function updateDisplay() {
      const dv = Number(input.value);
      const unit = opts.unit || "";
      valueSpan.textContent = (Number.isInteger(dv) ? String(dv) : dv.toFixed(1)) + unit;
    }
    updateDisplay();

    const control: SliderControl = {
      type: "slider",
      element: wrap,
      panel,
      offset: { x: opts.x, y: opts.y },
      get value() { return (Number(input.value) - min) / (max - min); },
      get displayValue() { return Number(input.value); },
      onChange: opts.onChange || null,
      setValue: (normalized: number) => {
        input.value = String(min + normalized * (max - min));
        updateDisplay();
      },
      destroy: () => { wrap.remove(); this.removeControl(control); },
    };

    input.addEventListener("input", () => {
      updateDisplay();
      control.onChange?.(control.value, control.displayValue);
    });

    this.controls.push(control);
    return control;
  }

  // ── Toggle ──

  toggle(panel: any, opts: {
    x: number; y: number;
    label?: string;
    value?: boolean;
    color?: string;
    onChange?: (value: boolean) => void;
  }): ToggleControl {
    const div = this.getOrCreatePanelContainer(panel);
    const color = opts.color || "#00d4aa";

    const wrap = document.createElement("div");
    wrap.className = "a42-control a42-toggle-wrap";
    wrap.style.left = opts.x + "px";
    wrap.style.top = opts.y + "px";

    const track = document.createElement("div");
    track.className = "a42-toggle-track";

    const thumb = document.createElement("div");
    thumb.className = "a42-toggle-thumb";
    track.appendChild(thumb);

    const label = document.createElement("span");
    label.className = "a42-toggle-label";
    label.textContent = opts.label || "";

    wrap.appendChild(track);
    wrap.appendChild(label);
    div.appendChild(wrap);

    const control: ToggleControl = {
      type: "toggle",
      element: wrap,
      panel,
      offset: { x: opts.x, y: opts.y },
      value: opts.value ?? false,
      onChange: opts.onChange || null,
      setValue: (on: boolean) => {
        control.value = on;
        track.classList.toggle("on", on);
      },
      destroy: () => { wrap.remove(); this.removeControl(control); },
    };

    control.setValue(control.value);

    wrap.addEventListener("click", () => {
      control.value = !control.value;
      track.classList.toggle("on", control.value);
      control.onChange?.(control.value);
    });

    this.controls.push(control);
    return control;
  }

  // ── Input ──

  input(panel: any, opts: {
    x: number; y: number; width?: number;
    placeholder?: string;
    label?: string;
    value?: string;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
  }): InputControl {
    const div = this.getOrCreatePanelContainer(panel);
    const width = opts.width ?? 200;

    const wrap = document.createElement("div");
    wrap.className = "a42-control";
    wrap.style.left = opts.x + "px";
    wrap.style.top = opts.y + "px";

    if (opts.label) {
      const lbl = document.createElement("div");
      lbl.className = "a42-label";
      lbl.textContent = opts.label;
      wrap.appendChild(lbl);
    }

    const input = document.createElement("input");
    input.type = "text";
    input.className = "a42-input";
    input.style.width = width + "px";
    input.placeholder = opts.placeholder || "";
    input.value = opts.value || "";
    wrap.appendChild(input);
    div.appendChild(wrap);

    const control: InputControl = {
      type: "input",
      element: wrap,
      panel,
      offset: { x: opts.x, y: opts.y },
      get value() { return input.value; },
      onChange: opts.onChange || null,
      onSubmit: opts.onSubmit || null,
      clear: () => { input.value = ""; },
      destroy: () => { wrap.remove(); this.removeControl(control); },
    };

    input.addEventListener("input", () => control.onChange?.(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") control.onSubmit?.(input.value);
    });

    this.controls.push(control);
    return control;
  }

  // ── Cleanup ──

  private removeControl(control: PanelControl) {
    const idx = this.controls.indexOf(control);
    if (idx >= 0) this.controls.splice(idx, 1);
  }

  destroy() {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    for (const c of this.controls) c.element.remove();
    for (const [, div] of this.panelContainers) div.remove();
    this.controls.length = 0;
    this.panelContainers.clear();
  }
}
