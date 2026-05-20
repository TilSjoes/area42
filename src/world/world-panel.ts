/**
 * WorldPanel — translucent inspection card living in the 3D scene.
 *
 * The Area42 2D HUD has glass-morphism panels that float over the
 * canvas. Their natural 3D analogue is a textured plane mesh that
 * sits *in* the world: anchored to a node, billboarded toward the
 * camera, painted with Canvas 2D for ergonomic content authoring.
 *
 * Three roles in mind:
 * - **Inspection card** — pinned near a selected node, summary text +
 *   confidence bar etc.
 * - **Hover tooltip** — same primitive, ephemeral, follows hover.
 * - **Annotation** — pinned in space without a node anchor, e.g.
 *   "high-confidence late-phase region" floating in a quadrant of
 *   the data cube.
 *
 * Content is authored via a `draw(painter)` callback — same shape as
 * Area42's 2D Panel.onContent, so muscle memory carries over.
 *
 * Billboarding (face-camera) is on by default. For annotations that
 * should keep their world-orientation, pass `billboard: false`.
 */

import * as THREE from "three";

export interface WorldPanelOptions {
  /** Panel size in world units. Default 240 × 140. */
  size?: { x: number; y: number };
  /** Background fill — hex color. Default 0x0e1421 (var(--bg-1)). */
  background?: number;
  /** Border / accent color. Default 0x4dabf7 (var(--accent)). */
  borderColor?: number;
  /** Background opacity 0..1. Default 0.82 — translucent but readable. */
  opacity?: number;
  /** Always face the camera. Default true. */
  billboard?: boolean;
  /**
   * Pixel-density multiplier for the underlying canvas texture. 4 keeps
   * text crisp at typical view distances; bump to 6 for fly-close
   * scenarios. Trade-off: GPU memory + texture upload cost on draw().
   */
  resolution?: number;
}

export class WorldPanel {
  /** The mesh — caller adds it to a scene or parents to a node. */
  readonly mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private size: { x: number; y: number };
  private billboard: boolean;
  private chromeOpts: Required<Pick<WorldPanelOptions, "background" | "borderColor" | "opacity">>;

  constructor(options: WorldPanelOptions = {}) {
    this.size = options.size ?? { x: 240, y: 140 };
    this.billboard = options.billboard ?? true;
    this.chromeOpts = {
      background:  options.background  ?? 0x0e1421,
      borderColor: options.borderColor ?? 0x4dabf7,
      opacity:     options.opacity     ?? 0.82,
    };

    const res = options.resolution ?? 4;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size.x * res;
    this.canvas.height = this.size.y * res;
    this.ctx = this.canvas.getContext("2d")!;
    // Scale the rendering context so the painter callback works in
    // panel-local coordinates (0..size.x by 0..size.y) regardless of
    // the underlying texture resolution.
    this.ctx.scale(res, res);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    const geom = new THREE.PlaneGeometry(this.size.x, this.size.y);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geom, mat);

    // Paint default chrome so the panel is visible immediately even
    // before a draw() call.
    this.paintChrome();
  }

  /**
   * Re-paint the panel: chrome first, then the caller's painter on top.
   * Always uploads the fresh canvas to the GPU.
   */
  draw(painter: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    this.paintChrome();
    painter(this.ctx, this.size.x, this.size.y);
    this.texture.needsUpdate = true;
  }

  /** Show / hide convenience. */
  set visible(v: boolean) { this.mesh.visible = v; }
  get visible(): boolean { return this.mesh.visible; }

  /**
   * Per-frame update — billboards the mesh toward the camera if
   * billboard=true. Cheap (one matrix lookAt) so consumers can just
   * call this every frame from their render loop.
   */
  update(camera: THREE.Camera): void {
    if (!this.billboard) return;
    this.mesh.lookAt(camera.position);
  }

  /** Free GPU resources. */
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.MeshBasicMaterial).map?.dispose();
    (this.mesh.material as THREE.MeshBasicMaterial).dispose();
    this.texture.dispose();
  }

  // ── chrome ──────────────────────────────────────────────────────
  private paintChrome(): void {
    const { background, borderColor, opacity } = this.chromeOpts;
    const ctx = this.ctx;
    const w = this.size.x;
    const h = this.size.y;

    ctx.clearRect(0, 0, w, h);

    // Translucent rounded-rect background.
    ctx.fillStyle = rgba(background, opacity);
    roundRect(ctx, 1, 1, w - 2, h - 2, 8);
    ctx.fill();

    // Border — thin accent line.
    ctx.strokeStyle = hex(borderColor);
    ctx.lineWidth = 1.5;
    roundRect(ctx, 1, 1, w - 2, h - 2, 8);
    ctx.stroke();

    // Tiny accent strip in the top-left so the panel reads as
    // "card-with-tab" — matches the Area42 2D panel styling cue.
    ctx.fillStyle = hex(borderColor);
    roundRect(ctx, 1, 1, 36, 4, 2);
    ctx.fill();
  }
}

// ── helpers ───────────────────────────────────────────────────────
function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

function rgba(n: number, a: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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
