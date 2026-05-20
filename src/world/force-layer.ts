/**
 * ForceLayer — visualize the spec's first-class Forces concept.
 *
 * Forces are *separate from edges* in SELDON v2's data model: edges
 * encode static structural relationships, forces encode directional
 * pressure that varies over time. Each force is anchored at one or
 * more affected entities and points somewhere — toward another
 * entity, along a viewpoint track, or as a free 3D vector.
 *
 * Visualization: a Three.js ArrowHelper per (force × affected entity)
 * pair. Length encodes magnitude (0..1). Color is per-force so the
 * user can read "this is the regulatory-pressure force" at a glance.
 *
 * Composition: a ForceLayer is a THREE.Group you add to your scene.
 * Call setForces() with the resolved spec (positions + directions
 * already in scene coords); call clear() to drop them all. visible
 * setter for the legend toggle.
 */

import * as THREE from "three";

export interface ForceArrowSpec {
  /** Force ID — for downstream picking / hover. */
  id: string;
  /** Where the arrow starts (typically an affected entity's position). */
  origin: [number, number, number];
  /** Unit direction. Caller resolves "entity"/"track" → world vector. */
  direction: [number, number, number];
  /** 0..1 — drives length. Below `minMagnitude` the arrow is omitted. */
  magnitude: number;
  /** Hex / CSS color. Default 0xf06595 (theme --force). */
  color?: number | string;
  /** Free-form payload for picking / hover. */
  data?: unknown;
}

export interface ForceLayerOptions {
  /** Length when magnitude=1, in scene units. Default 80. */
  baseLength?: number;
  /** Skip arrows for forces below this magnitude. Default 0.05. */
  minMagnitude?: number;
}

export class ForceLayer {
  readonly group: THREE.Group;
  private arrows: THREE.ArrowHelper[] = [];
  private opts: Required<ForceLayerOptions>;

  constructor(options: ForceLayerOptions = {}) {
    this.group = new THREE.Group();
    this.group.name = "ForceLayer";
    this.opts = {
      baseLength:    options.baseLength ?? 80,
      minMagnitude:  options.minMagnitude ?? 0.05,
    };
  }

  /** Replace all arrows with the new spec. Cheap teardown — arrows
   *  are lightweight, no textures or geometries to retain. */
  setForces(specs: ForceArrowSpec[]): void {
    this.clear();
    for (const s of specs) {
      if (s.magnitude < this.opts.minMagnitude) continue;
      const dir = new THREE.Vector3(...s.direction);
      if (dir.lengthSq() < 1e-6) continue;
      dir.normalize();
      const origin = new THREE.Vector3(...s.origin);
      const length = this.opts.baseLength * Math.max(0, Math.min(1, s.magnitude));
      const color = toColor(s.color ?? 0xf06595);
      const headLen   = length * 0.25;
      const headWidth = length * 0.12;
      const arrow = new THREE.ArrowHelper(dir, origin, length, color, headLen, headWidth);
      arrow.userData.forceId = s.id;
      arrow.userData.payload = s.data;
      this.group.add(arrow);
      this.arrows.push(arrow);
    }
  }

  clear(): void {
    for (const a of this.arrows) {
      this.group.remove(a);
      // ArrowHelper composes a Line + Mesh internally; both share a
      // single geometry that THREE.js manages, but we dispose the
      // ones it allocated for our colors.
      a.line.geometry.dispose();
      (a.line.material as THREE.Material).dispose();
      a.cone.geometry.dispose();
      (a.cone.material as THREE.Material).dispose();
    }
    this.arrows = [];
  }

  set visible(v: boolean) { this.group.visible = v; }
  get visible(): boolean { return this.group.visible; }

  dispose(): void {
    this.clear();
  }
}

function toColor(c: number | string): number {
  if (typeof c === "number") return c;
  return new THREE.Color(c).getHex();
}
