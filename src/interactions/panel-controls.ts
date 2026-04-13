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

// ───────── CSS Injection ─────────────────────────────────────────────

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

    /* ─── Button ─── */
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

    /* ─── Radio Group ─── */
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

    /* ─── Slider ─── */
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

    /* ─── Toggle ─── */
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

    /* ─── Input ─── */
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

    /* ─── Lock Icon Button ─── */
    .a42-lock-btn {
      padding: 4px 8px;
      border: 1px solid rgba(123,104,238,0.3);
      background: rgba(123,104,238,0.08);
      color: #7b68ee;
      font-size: 12px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .a42-lock-btn:hover { background: rgba(123,104,238,0.15); border-color: rgba(123,104,238,0.5); }
    .a42-lock-btn.locked { background: rgba(123,104,238,0.2); color: #a890ee; border-color: rgba(123,104,238,0.6); }
  `;
  document.head.appendChild(style);
}


// ───────── Types ───────────────────────────────────────────────────

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


// ───────── Control Manager ─────────────────────────────────────────

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

  // ─── Button ───

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

  // ─── Radio Group ───

  radioGroup(panel: any, opts: {
    x: number; y: number;
    options: string[];
    value?: number;
    colors?: string[];
    onChange?: (index: number, label: string) => void;
  }): RadioGroupControl {
    const div = this.getOrCreatePanelContainer(panel);
    const wrap = document.createElement("div");
    wrap.className = "a42-control a42-radio-group";
    wrap.style.left = opts.x + "px";
    wrap.style.top = opts.y + "px";

    const buttons: HTMLButtonElement[] = [];
    opts.options.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.className = "a42-radio-btn";
      btn.textContent = label;
      if (i === (opts.value ?? 0)) btn.classList.add("active");
      wrap.appendChild(btn);
      buttons.push(btn);
    });
    div.appendChild(wrap);

    const control: RadioGroupControl = {
      type: "radioGroup",
      element: wrap,
      panel,
      offset: { x: opts.x, y: opts.y },
      value: opts.value ?? 0,
      onChange: opts.onChange || null,
      setValue: (index: number) => {
        control.value = index;
        buttons.forEach((b, i) => b.classList.toggle("active", i === index));
        opts.onChange?.(index, opts.options[index]);
      },
      destroy: () => { wrap.remove(); this.removeControl(control); },
    };

    buttons.forEach((btn, i) => {
      btn.addEventListener("click", () => control.setValue(i));
    });

    this.controls.push(control);
    return control;
  }

  // ─── Slider 

  slider(panel: any, opts: {
    x: number; y: number;
    min: number;
    max: number;
    step?: number;
    label?: string;
    value?: number;
    onChange?: (value: number, displayValue: number) => void;
  }): SliderControl {
    const div = this.getOrCreatePanelContainer(panel);
    const wrap = document.createElement("div");
    wrap.className = "a42-control a42-slider-wrap";
    wrap.style.left = opts.x + "px";
    wrap.style.top = opts.y + "px";

    if (opts.label) {
      const header = document.createElement("div");
      header.className = "a42-slider-header";
      header.innerHTML = `<span>${opts.label}</span><span class="a42-slider-value">${opts.value ?? opts.min}</span>`;
      wrap.appendChild(header);
    }

    const input = document.createElement("input");
    input.type = "range";
    input.min = opts.min.toString();
    input.max = opts.max.toString();
    input.step = (opts.step ?? 1).toString();
    input.value = (opts.value ?? opts.min).toString();
    input.className = "a42-slider";
    wrap.appendChild(input);

    const control: SliderControl = {
      type: "slider",
      element: wrap,
      panel,
      offset: { x: opts.x, y: opts.y },
      value: opts.value ?? opts.min,
      displayValue: opts.value ?? opts.min,
      onChange: opts.onChange || null,
      setValue: (normalized: number) => {
        const value = opts.min + normalized * (opts.max - opts.min);
        input.value = value.toString();
        control.value = value;
        control.displayValue = value;
        if (opts.label) {
          const header = wrap.querySelector(".a42-slider-header");
          if (header) {
            const valueEl = header.querySelector(".a42-slider-value");
            if (valueEl) valueEl.textContent = value.toFixed(1);
          }
        }
        opts.onChange?.(value, value);
      },
      destroy: () => { wrap.remove(); this.removeControl(control); },
    };

    input.addEventListener("input", (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      control.value = value;
      control.displayValue = value;
      if (opts.label) {
        const header = wrap.querySelector(".a42-slider-header");
        if (header) {
          const valueEl = header.querySelector(".a42-slider-value");
          if (valueEl) valueEl.textContent = value.toFixed(1);
        }
      }
      opts.onChange?.(value, value);
    });

    this.controls.push(control);
    div.appendChild(wrap);
    return control;
  }

  // ─── Toggle ───

  toggle(panel: any, opts: {
    x: number; y: number;
    label?: string;
    value?: boolean;
    onChange?: (value: boolean) => void;
  }): ToggleControl {
    const div = this.getOrCreatePanelContainer(panel);
    const wrap = document.createElement("div");
    wrap.className = "a42-control a42-toggle-wrap";
    wrap.style.left = opts.x + "px";
    wrap.style.top = opts.y + "px";

    const track = document.createElement("div");
    track.className = `a42-toggle-track ${opts.value ? "on" : ""}`;
    const thumb = document.createElement("div");
    thumb.className = "a42-toggle-thumb";
    track.appendChild(thumb);
    wrap.appendChild(track);

    if (opts.label) {
      const label = document.createElement("span");
      label.className = "a42-toggle-label";
      label.textContent = opts.label;
      wrap.appendChild(label);
    }

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
        opts.onChange?.(on);
      },
      destroy: () => { wrap.remove(); this.removeControl(control); },
    };

    wrap.addEventListener("click", () => control.setValue(!control.value));
    this.controls.push(control);
    div.appendChild(wrap);
    return control;
  }

  // ─── Input ───

  input(panel: any, opts: {
    x: number; y: number;
    placeholder?: string;
    value?: string;
    onSubmit?: (value: string) => void;
    onChange?: (value: string) => void;
  }): InputControl {
    const div = this.getOrCreatePanelContainer(panel);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "a42-input";
    input.placeholder = opts.placeholder ?? "";
    input.value = opts.value ?? "";
    input.style.left = opts.x + "px";
    input.style.top = opts.y + "px";
    div.appendChild(input);

    const control: InputControl = {
      type: "input",
      element: input,
      panel,
      offset: { x: opts.x, y: opts.y },
      value: opts.value ?? "",
      onChange: opts.onChange || null,
      onSubmit: opts.onSubmit || null,
      clear: () => {
        input.value = "";
        control.value = "";
      },
      destroy: () => { input.remove(); this.removeControl(control); },
    };

    input.addEventListener("input", (e) => {
      control.value = (e.target as HTMLInputElement).value;
      opts.onChange?.(control.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        opts.onSubmit?.(control.value);
      }
    });

    this.controls.push(control);
    return control;
  }

  // ─── Lock Toggle ───

  /** Add a lock/unlock toggle button to a panel header */
  lockToggle(panel: any, opts: {
    x: number;
    y: number;
    onChange?: (locked: boolean) => void;
  }): ButtonControl {
    const div = this.getOrCreatePanelContainer(panel);
    const btn = document.createElement("button");
    btn.className = "a42-control a42-lock-btn locked";
    btn.innerHTML = "&#x1F512;"; // Lock icon
    btn.style.left = opts.x + "px";
    btn.style.top = opts.y + "px";
    div.appendChild(btn);

    // Load saved state from localStorage
    let locked = true; // Default locked
    try {
      const saved = localStorage.getItem('a42-panels-locked');
      if (saved !== null) locked = saved !== 'false';
    } catch (e) {
      // localStorage unavailable
    }

    // Update button appearance
    const updateAppearance = () => {
      btn.textContent = locked ? "&#x1F512;" : "&#x1F513;"; // Lock/Unlock icon
      btn.classList.toggle("locked", locked);
    };
    updateAppearance();

    const control: ButtonControl = {
      type: "button",
      element: btn,
      panel,
      offset: { x: opts.x, y: opts.y },
      onClick: null,
      setText: (text: string) => { btn.innerHTML = text; },
      setLoading: (loading: boolean) => {
        btn.style.opacity = loading ? "0.6" : "1";
        btn.style.pointerEvents = loading ? "none" : "auto";
      },
      destroy: () => { btn.remove(); this.removeControl(control); },
    };

    btn.addEventListener("click", () => {
      locked = !locked;
      try {
        localStorage.setItem('a42-panels-locked', locked ? 'true' : 'false');
      } catch (e) {
        // localStorage unavailable
      }
      updateAppearance();
      opts.onChange?.(locked);
    });

    this.controls.push(control);
    return control;
  }

  private removeControl(control: PanelControl) {
    const idx = this.controls.indexOf(control);
    if (idx >= 0) this.controls.splice(idx, 1);
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.controls.forEach(c => c.destroy());
    this.controls = [];
    this.panelContainers.clear();
  }
}
