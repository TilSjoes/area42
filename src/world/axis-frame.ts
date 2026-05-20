/**
 * AxisFrame — a visible coordinate frame for data-axes-as-spatial-axes.
 *
 * SELDON's WorldView (and any consumer mapping data dimensions to
 * spatial axes) needs the user to *see* what each axis means. Without
 * this, the scene is "a cloud of spheres in space." With it, the user
 * reads the world: understanding goes →, confidence goes ↑, phase ↗.
 *
 * Composition: an AxisFrame is a THREE.Group you add to your scene.
 * It draws three orthogonal axis lines from origin out to ±span,
 * optional ground grid, optional wireframe cube around the data
 * volume, tick marks at named divisions per axis, and labels at the
 * axis tips that rotate with the data (world-locked, not billboarded).
 *
 * Two label roles:
 * - Axis name (tip): world-locked Mesh. Rotates with the data so the
 *   spatial intuition stays intact when the camera orbits.
 * - Tick value: billboarded Sprite. Always readable regardless of
 *   camera angle — the right behaviour for short value annotations.
 *
 * Honest about defaults: red = X, green = Y, blue = Z (Three.js / VR
 * convention). Override colors per-axis if your aesthetic diverges.
 */

import * as THREE from "three";
import { makeTextSprite, makeTextMesh } from "./labels.js";

/**
 * One tick on an axis. `t` is parametric in [-1, +1] mapping to
 * [-span, +span]; `label` renders next to the tick mark. Useful for
 * named regions on discrete axes (low/medium/high) or value
 * annotations on continuous axes (0/25/50/75/100%).
 */
export interface AxisTick {
  t: number;
  label: string;
}

export interface AxisFrameOptions {
  /** Half-extent of each axis. The frame spans from -span to +span. */
  span?: number;
  /** Tip labels — world-locked Mesh text. Rotate with the data. */
  labels?: { x?: string; y?: string; z?: string };
  /**
   * Per-axis tick marks + value labels. Tick `t` ∈ [-1, +1]; label
   * is short text rendered as a billboarded sprite next to the tick.
   */
  divisions?: { x?: AxisTick[]; y?: AxisTick[]; z?: AxisTick[] };
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
  /**
   * Whether to draw a wireframe cube around the data volume so the
   * extent reads as a *shape*, not just three rays. Lines are dim by
   * design — they're context, not foreground.
   */
  cube?: boolean;
  /** Cube line color. Default matches grid. */
  cubeColor?: number;
}

const AXIS_DEFAULT = { x: 0xff6b6b, y: 0x51cf66, z: 0x4dabf7 };

export class AxisFrame {
  readonly group: THREE.Group;

  constructor(options: AxisFrameOptions = {}) {
    const span = options.span ?? 320;
    const colors = { ...AXIS_DEFAULT, ...options.colors };
    const labels = options.labels ?? {};
    const divisions = options.divisions ?? {};

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

    // Ground grid on XZ plane.
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

    // Wireframe cube around the data volume — gives the world a SHAPE
    // and reads regions as boxes ("late-phase + high-confidence" is a
    // CORNER, not just a direction). LineSegments is one draw call.
    if (options.cube) {
      const cubeColor = options.cubeColor ?? 0x1a2333;
      const box = new THREE.BoxGeometry(span * 2, span * 2, span * 2);
      const edges = new THREE.EdgesGeometry(box);
      const cube = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: cubeColor, transparent: true, opacity: 0.35 }),
      );
      this.group.add(cube);
      box.dispose();
    }

    // Ticks per axis. Each tick = a small perpendicular line + a
    // billboarded sprite label. Tick lines are world-locked but tick
    // labels billboard — short text is easier to read camera-aligned.
    if (divisions.x) this.addTicks("x", divisions.x, span, colors.x);
    if (divisions.y) this.addTicks("y", divisions.y, span, colors.y);
    if (divisions.z) this.addTicks("z", divisions.z, span, colors.z);

    // Axis name labels at the +tip — world-locked Mesh text. The plane
    // is oriented perpendicular to its axis so it reads cleanly when
    // the camera looks down that axis.
    if (labels.x) {
      const m = makeTextMesh(labels.x, { color: "#ff6b6b", scale: 38, normal: [1, 0, 0] });
      m.position.set(tip + 38, 0, 0);
      this.group.add(m);
    }
    if (labels.y) {
      const m = makeTextMesh(labels.y, { color: "#51cf66", scale: 38, normal: [0, 1, 0] });
      m.position.set(0, tip + 38, 0);
      this.group.add(m);
    }
    if (labels.z) {
      const m = makeTextMesh(labels.z, { color: "#4dabf7", scale: 38, normal: [0, 0, 1] });
      m.position.set(0, 0, tip + 38);
      this.group.add(m);
    }
  }

  private addTicks(axis: "x" | "y" | "z", ticks: AxisTick[], span: number, color: number): void {
    const tickLen = span * 0.04;  // perpendicular line length

    for (const t of ticks) {
      // Position along the axis at parametric t.
      const p = t.t * span;
      // Tick line endpoints — perpendicular to the axis, in the plane
      // most natural for that axis (X tick goes along Y, Y tick along
      // X, Z tick along X — keeps ticks visible from default camera).
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const labelPos = new THREE.Vector3();
      if (axis === "x") {
        a.set(p, -tickLen, 0); b.set(p, tickLen, 0);
        labelPos.set(p, -tickLen * 2, 0);
      } else if (axis === "y") {
        a.set(-tickLen, p, 0); b.set(tickLen, p, 0);
        labelPos.set(-tickLen * 2.5, p, 0);
      } else {
        a.set(-tickLen, 0, p); b.set(tickLen, 0, p);
        labelPos.set(-tickLen * 2.5, 0, p);
      }
      const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
      this.group.add(new THREE.Line(geom, mat));

      // Tick label: short text, billboard-readable from any angle.
      const sprite = makeTextSprite(t.label, {
        scale: 14,
        color: "#c8d6e5",
        background: "rgba(8, 12, 20, 0.6)",
      });
      sprite.position.copy(labelPos);
      this.group.add(sprite);
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
