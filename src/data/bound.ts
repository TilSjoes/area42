/**
 * Area42 v2 Bound Elements
 *
 * SceneNode subclasses that auto-update from ReactiveSource data.
 * These replace manual onContent() callbacks for common patterns.
 */

import { SceneNode, type Vec2 } from "../core/scene.js";
import { type ReactiveSource, type Unsubscribe } from "./reactive.js";

// ─── BoundMetric ───────────────────────────────────────────────────

export interface BoundMetricOptions {
  id?: string;
  label: string;
  source: ReactiveSource<any>;
  /** Field to extract from source data (dot notation not supported — use FieldSource) */
  field?: string;
  /** Format function for display (default: String) */
  format?: (value: any) => string;
  /** Size of this element */
  size?: Vec2;
  /** Accent color override (otherwise uses resolved style) */
  color?: string;
}

/**
 * A metric card that auto-updates from a ReactiveSource.
 * Shows label + large value, styled with the container's resolved style.
 */
export class BoundMetric extends SceneNode {
  private _label: string;
  private _source: ReactiveSource<any>;
  private _field?: string;
  private _format: (value: any) => string;
  private _color?: string;
  private _value: string = "—";
  private _unsub: Unsubscribe;
  private _prevRaw: any = undefined;

  constructor(options: BoundMetricOptions) {
    super({
      id: options.id,
      size: options.size ?? { x: 200, y: 60 },
    });
    this._label = options.label;
    this._source = options.source;
    this._field = options.field;
    this._format = options.format ?? String;
    this._color = options.color;

    if (options.color) {
      this.style = { accent: options.color };
    }

    // Initial value
    this._updateValue(this._source.data);

    // Subscribe to changes
    this._unsub = this._source.onChange((data) => {
      this._updateValue(data);
    });
  }

  private _updateValue(data: any): void {
    const raw = this._field ? data?.[this._field] : data;
    if (raw !== this._prevRaw) {
      this._prevRaw = raw;
      this._value = raw !== undefined && raw !== null ? this._format(raw) : "—";
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.resolvedStyle();
    const w = this.size.x;
    const h = this.size.y;

    // Card background
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 4);
    ctx.fill();

    // Left accent bar
    const accent = this._color ?? s.accent;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 3, h);

    // Label
    ctx.fillStyle = s.textDim;
    ctx.font = `bold ${s.fontSize - 2}px ${s.fontFamily}`;
    ctx.letterSpacing = "1px";
    ctx.textBaseline = "top";
    ctx.fillText(this._label.toUpperCase(), 12, 8);

    // Value — scale font to fit available width
    ctx.fillStyle = accent;
    const maxW = w - 16;
    let fontSize = 22;
    ctx.font = `bold ${fontSize}px ${s.fontFamily}`;
    ctx.letterSpacing = "0px";
    while (fontSize > 10 && ctx.measureText(this._value).width > maxW) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px ${s.fontFamily}`;
    }
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.fillText(this._value, 12, 28 - (22 - fontSize) / 2);
    ctx.shadowBlur = 0;
  }

  /** Clean up subscription */
  destroy(): void {
    this._unsub();
  }
}

// ─── BoundLabel ────────────────────────────────────────────────────

export interface BoundLabelOptions {
  id?: string;
  source: ReactiveSource<any>;
  field?: string;
  format?: (value: any) => string;
  size?: Vec2;
  color?: string;
  fontSize?: number;
}

/**
 * A simple text label that auto-updates from a ReactiveSource.
 */
export class BoundLabel extends SceneNode {
  private _source: ReactiveSource<any>;
  private _field?: string;
  private _format: (value: any) => string;
  private _color?: string;
  private _fontSize?: number;
  private _value: string = "";
  private _unsub: Unsubscribe;

  constructor(options: BoundLabelOptions) {
    super({
      id: options.id,
      size: options.size ?? { x: 200, y: 20 },
    });
    this._source = options.source;
    this._field = options.field;
    this._format = options.format ?? String;
    this._color = options.color;
    this._fontSize = options.fontSize;

    this._updateValue(this._source.data);
    this._unsub = this._source.onChange((data) => this._updateValue(data));
  }

  private _updateValue(data: any): void {
    const raw = this._field ? data?.[this._field] : data;
    this._value = raw !== undefined && raw !== null ? this._format(raw) : "";
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.resolvedStyle();
    ctx.fillStyle = this._color ?? s.fg;
    ctx.font = `${this._fontSize ?? s.fontSize}px ${s.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(this._value, 0, 0);
  }

  destroy(): void {
    this._unsub();
  }
}

// ─── BoundStatusDot ────────────────────────────────────────────────

export interface BoundStatusDotOptions {
  id?: string;
  label: string;
  source: ReactiveSource<any>;
  field?: string;
  /** Map values to colors (e.g., { "healthy": "#51cf66", "degraded": "#ffd43b" }) */
  colorMap?: Record<string, string>;
  size?: Vec2;
}

/**
 * A status indicator dot with label, auto-updating color from a ReactiveSource.
 */
export class BoundStatusDot extends SceneNode {
  private _label: string;
  private _source: ReactiveSource<any>;
  private _field?: string;
  private _colorMap: Record<string, string>;
  private _currentColor: string = "#51cf66";
  private _unsub: Unsubscribe;

  constructor(options: BoundStatusDotOptions) {
    super({
      id: options.id,
      size: options.size ?? { x: 150, y: 20 },
    });
    this._label = options.label;
    this._source = options.source;
    this._field = options.field;
    this._colorMap = options.colorMap ?? {
      healthy: "#51cf66",
      green: "#51cf66",
      degraded: "#ffd43b",
      yellow: "#ffd43b",
      down: "#ff6b6b",
      red: "#ff6b6b",
    };

    this._updateColor(this._source.data);
    this._unsub = this._source.onChange((data) => this._updateColor(data));
  }

  private _updateColor(data: any): void {
    const raw = this._field ? data?.[this._field] : data;
    const key = String(raw).toLowerCase();
    this._currentColor = this._colorMap[key] ?? "#6b7b8d";
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.resolvedStyle();

    // Status dot
    ctx.fillStyle = this._currentColor;
    ctx.shadowColor = this._currentColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(6, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = s.fg;
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.fillText(this._label, 18, 10);
  }

  destroy(): void {
    this._unsub();
  }
}
