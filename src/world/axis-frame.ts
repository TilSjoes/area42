/**
 * AxisFrame — a visible coordinate frame for data-axes-as-spatial-axes.
 *
 * SELDON's WorldView (and any consumer mapping data dimensions to
 * spatial axes) needs the user to *see* what each axis means. Without
 * this, the scene is "a cloud of spheres in space." With it, the user
 * reads the world: time goes →, confidence goes ↑, phase goes ↗.
 *
 * Composition: an AxisFrame is a THREE.Group you add to your scene.
 * It draws three orthogonal axis lines from origin out to ±span,
 * a ground grid on the XZ plane, and three text sprites at the +X, +Y,
 * +Z tips with caller-provided labels.
 *
 * Honest about defaults: red = X, green = Y, blue = Z (Three.js / VR
 * convention). Override colors per-axis if your aesthetic diverges.
 */

import * as THREE from "three";
import { makeTextSprite } from "./labels.js";

export interface AxisFrameOptions {
  /** Half-extent of each axis. The frame spans from -span to +span. */
  span?: number;
  /** Labels at the +X, +Y, +Z tips. */
  labels?: { x?: string; y?: string; z?: string };
  /** Per-axis colors. Defaults follow VR convention. */
  colors?: { x?: number; y?: number; z?: number };
  /**
   * Whether to draw a ground grid on the XZ plane (Y=−span). Off-by-
   * default since not all consumers want a "floor" — depth-as-Z without
   * a floor reads more like a free-floating volume.
   */
  grid?: boolean;
  /** Number of grid divisions when grid is on. Default 16. */
  gridDivisions?: number;
  /** Subtle background color for the grid lines. */
  gridColor?: number;
}

const AXIS_DEFAULT = { x: 0xff6b6b, y: 0x51cf66, z: 0x4dabf7 };

export class AxisFrame {
  readonly group: THREE.Group;
  private spriteX: THREE.Sprite | null = null;
  private spriteY: THREE.Sprite | null = null;
  private spriteZ: THREE.Sprite | null = null;

  constructor(options: AxisFrameOptions = {}) {
    const span = options.span ?? 320;
    const colors = { ...AXIS_DEFAULT, ...options.colors };
    const labels = options.labels ?? {};

    this.group = new THREE.Group();
    this.group.name = "AxisFrame";

    // Axis lines from origin out along each + axis. We extend to ~110%
    // of span so the labels at the tips don't sit *on* the data.
    const tip = span * 1.1;
    this.group.add(this.makeAxisLine([0, 0, 0], [tip, 0, 0], colors.x));
    this.group.add(this.makeAxisLine([0, 0, 0], [0, tip, 0], colors.y));
    this.group.add(this.makeAxisLine([0, 0, 0], [0, 0, tip], colors.z));

    // Negative-side dim lines so the user sees the full extent of the
    // coordinate frame, not just the positive octant.
    this.group.add(this.makeAxisLine([0, 0, 0], [-tip, 0, 0], colors.x, 0.25));
    this.group.add(this.makeAxisLine([0, 0, 0], [0, -tip, 0], colors.y, 0.25));
    this.group.add(this.makeAxisLine([0, 0, 0], [0, 0, -tip], colors.z, 0.25));

    // Ground grid on XZ plane. Many viz contexts want a floor anchor;
    // others (free-volume) prefer no horizon. Off by default.
    if (options.grid) {
      const grid = new THREE.GridHelper(
        span * 2,
        options.gridDivisions ?? 16,
        options.gridColor ?? 0x1a2333,
        options.gridColor ?? 0x1a2333,
      );
      grid.position.y = -span;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.4;
      this.group.add(grid);
    }

    // Axis tip labels. Sprites billboard to the camera automatically.
    if (labels.x) {
      this.spriteX = makeTextSprite(labels.x, { color: "#ff6b6b", scale: 36 });
      this.spriteX.position.set(tip + 30, 0, 0);
      this.group.add(this.spriteX);
    }
    if (labels.y) {
      this.spriteY = makeTextSprite(labels.y, { color: "#51cf66", scale: 36 });
      this.spriteY.position.set(0, tip + 30, 0);
      this.group.add(this.spriteY);
    }
    if (labels.z) {
      this.spriteZ = makeTextSprite(labels.z, { color: "#4dabf7", scale: 36 });
      this.spriteZ.position.set(0, 0, tip + 30);
      this.group.add(this.spriteZ);
    }
  }

  private makeAxisLine(
    from: [number, number, number],
    to: [number, number, number],
    color: number,
    opacity = 0.85,
  ): THREE.Line {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geom, mat);
  }
}
