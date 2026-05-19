/**
 * Text labels in 3D — Canvas-painted sprites.
 *
 * Three.js doesn't ship a first-class text primitive. The trade-offs:
 * - **Sprite + canvas texture** (this module): cheap to implement,
 *   billboards automatically, blurs slightly when zoomed past native
 *   resolution. Right for axis labels and ephemeral hover text.
 * - **SDF text** (e.g. troika-three-text): sharp at any distance,
 *   third-party dep, more setup. Reach for it once we hit the limits
 *   of sprite labels.
 * - **CSS3DRenderer**: DOM in 3D space — sharp text, but a separate
 *   render pass and slow at 1000+ labels.
 *
 * Strategy for the world: sprite labels everywhere for MVP, swap in
 * SDF for node labels once we have evidence it's needed.
 */

import * as THREE from "three";

export interface TextSpriteOptions {
  /** Foreground (text) color. CSS color string. */
  color?: string;
  /** Optional pill-style background. CSS color or null. */
  background?: string | null;
  /** Font family. */
  font?: string;
  /** Font weight. */
  weight?: string;
  /**
   * Scale of the rendered sprite in scene units (height in world
   * coordinates of the resulting sprite). Default 28.
   */
  scale?: number;
  /** Padding around text inside the canvas, in pixels. */
  padding?: number;
}

/**
 * Build a sprite that renders text via a Canvas2D texture. Cheap,
 * billboards automatically. Disposable: caller should keep the sprite
 * reference and call .geometry.dispose() / material.map.dispose() when
 * removing it.
 */
export function makeTextSprite(text: string, opts: TextSpriteOptions = {}): THREE.Sprite {
  const fontSize = 64;     // generate at high-DPI, scale down via sprite.scale
  const padding = opts.padding ?? 12;
  const font = `${opts.weight ?? "600"} ${fontSize}px ${opts.font ?? "system-ui, sans-serif"}`;

  // Measure first to size the canvas tightly.
  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = font;
  const metrics = measureCtx.measureText(text);
  const w = Math.ceil(metrics.width + padding * 2);
  const h = fontSize + padding * 2;

  // Bump to nearest power of two helps GPU sampling on some drivers.
  const cw = nextPow2(w);
  const ch = nextPow2(h);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  if (opts.background) {
    ctx.fillStyle = opts.background;
    roundRect(ctx, 0, 0, cw, ch, 8);
    ctx.fill();
  }

  ctx.font = font;
  ctx.fillStyle = opts.color ?? "#e0e8f0";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, padding, ch / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);

  // Scale so visible height ≈ opts.scale world-units, preserving aspect.
  const scale = opts.scale ?? 28;
  const aspect = cw / ch;
  sprite.scale.set(scale * aspect, scale, 1);

  return sprite;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
