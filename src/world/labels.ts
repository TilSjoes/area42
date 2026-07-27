/**
 * Text labels in 3D — two strategies, two roles.
 *
 * - **Sprite + canvas texture** (`makeTextSprite`): cheap to implement,
 *   billboards automatically, blurs slightly when zoomed past native
 *   resolution. Right for ephemeral readouts (hover labels, tick
 *   value annotations) — short text, billboarding is correct, blur
 *   under extreme zoom is rare in those roles.
 *
 * - **SDF text via troika-three-text** (`makeTextMesh`): sharp at any
 *   distance — the sampled distance field renders crisp from up close
 *   to far away. Right for axis names and any world-locked label the
 *   user might fly up to. Adds a peer dependency on
 *   `troika-three-text` (~135 KB gz including bidi-js); consumers
 *   that don't import `/world` don't pay for it.
 *
 * Both return a Three.js Object3D the caller positions and adds to a
 * scene; consumer never sees the implementation difference.
 */

import * as THREE from "three";
import { Text } from "troika-three-text";

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

/**
 * World-locked SDF text. Backed by `troika-three-text`'s `Text`
 * (which extends `THREE.Mesh`), so the returned mesh inherits parent
 * group rotation just like any other scene node — axis labels rotate
 * WITH the data when the camera orbits (Sprites would billboard,
 * which we explicitly don't want here).
 *
 * Sharp at any distance: troika builds a signed distance field for
 * each glyph and samples it in the fragment shader. Fly close, the
 * text stays crisp; pull far away, no jagged aliasing.
 *
 * `text.sync()` is async — troika rebuilds the SDF in a Web Worker
 * and the mesh shows nothing until ready. For static labels (axis
 * names, set once) this is invisible; for rapidly-changing text,
 * call sync() again after each change.
 */
export interface TextMeshOptions extends TextSpriteOptions {
  /**
   * Direction the plane "faces" — its surface normal. Default (0,0,1)
   * which means the plane lies in XY. Pass [1,0,0] for a plane in YZ
   * (readable from along the X axis), etc.
   */
  normal?: [number, number, number];
}

export function makeTextMesh(text: string, opts: TextMeshOptions = {}): THREE.Object3D {
  // Cast: Text extends Three.Object3D; the troika types describe its
  // public surface but TS can't always pin the inheritance chain
  // through the cross-package boundary. We treat the result as a
  // plain Object3D for the caller's purposes (position, parent, etc).
  const t = new Text();
  t.text = text;
  // troika expects a hex number or CSS string; pass through.
  t.color = opts.color ?? "#e0e8f0";
  t.fontSize = opts.scale ?? 28;
  t.anchorX = "left";
  t.anchorY = "middle";
  t.fontWeight = (opts.weight ?? "600") as unknown as number;
  // Two-sided so the plane is visible from behind too. SDF text reads
  // mirrored from the back, but it's better than vanishing.
  t.material.side = THREE.DoubleSide;
  // Kicks off async SDF generation. The mesh is empty until ready;
  // for static labels this happens within a frame or two.
  t.sync();

  if (opts.normal) {
    const target = new THREE.Vector3(...opts.normal).normalize();
    const z = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(z, target);
    t.setRotationFromQuaternion(quat);
  }

  return t as unknown as THREE.Object3D;
}
