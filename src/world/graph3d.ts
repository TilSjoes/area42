/**
 * Graph3D — entities and edges as a Three.js scene graph.
 *
 * Conceptually parallel to the 2D Graph: addNode / addEdge / picking,
 * but data-axes-as-spatial-axes by default. Consumers compute
 * positions from their own data dimensions (e.g. SELDON places
 * X = time, Y = confidence, Z = phase) and pass them in.
 *
 * Layout is *deterministic*: positions are set by data, not physics.
 * This is the deliberate departure from the 2D force-directed Graph —
 * the 3D world is *the* layout, not something to organise after.
 *
 * MVP intentionally bare:
 * - Each node = SphereGeometry mesh. InstancedMesh is the next pass
 *   (kicks in around 1k entities; not yet needed for SELDON's 151).
 * - Each edge = a thin Line, optionally with a cone arrowhead at the
 *   `to` end for directional types.
 * - Per-node label sprite, hidden by default; surfaced on hover or
 *   selection. Always-on labels at 1k+ nodes is unreadable; the
 *   hover-only pattern keeps the scene quiet until the user asks.
 */

import * as THREE from "three";
import { makeTextSprite } from "./labels.js";

/**
 * Geometric shape per node. Mirrors the 2D Graph's shape language
 * where the metaphor maps cleanly (sphere↔circle, box↔rect,
 * octahedron↔diamond, cylinder-hex↔hexagon) and adds 3D-only
 * primitives for richer kind-differentiation.
 */
export type Node3DShape =
  | "sphere"        // default — generic / initiative
  | "box"           // solid / capability
  | "cone"          // directed / dependency
  | "cylinder"      // pillar (hexagonal prism for regulation)
  | "octahedron"    // diamond / risk
  | "tetrahedron"   // sharp / novelty
  | "icosahedron"   // multi-faceted / security or maturity
  | "torus";        // cyclic / event

export interface Node3DOptions {
  id: string;
  label?: string;
  position: [number, number, number];
  color?: number | string;
  /** Sphere radius (or equivalent characteristic size). Default 6. */
  size?: number;
  /** Geometry shape. Default "sphere". */
  shape?: Node3DShape;
  /** Free-form payload — picked up by hit-test handlers. */
  data?: unknown;
}

export interface Edge3DOptions {
  from: string;
  to: string;
  color?: number | string;
  /** Line width — capped by Three.js implementation, expect ~1px. */
  width?: number;
  directional?: boolean;
  data?: unknown;
}

interface Node3D {
  id: string;
  options: Node3DOptions;
  mesh: THREE.Mesh;
  /** Hover/selection label sprite, hidden by default. */
  labelSprite: THREE.Sprite | null;
  /** Base radius — used to restore size when un-highlighted. */
  baseScale: number;
}

interface Edge3D {
  options: Edge3DOptions;
  line: THREE.Line;
  arrow?: THREE.Mesh;
}

export class Graph3D {
  /** Group that all node/edge meshes live under — add to a Scene. */
  readonly group: THREE.Group;

  private nodes = new Map<string, Node3D>();
  private edges: Edge3D[] = [];
  private nodeMaterialCache = new Map<number, THREE.MeshStandardMaterial>();
  private edgeMaterialCache = new Map<number, THREE.LineBasicMaterial>();
  private arrowMaterialCache = new Map<number, THREE.MeshBasicMaterial>();

  /** Reusable raycaster for picking. */
  private raycaster = new THREE.Raycaster();
  private hoveredId: string | null = null;
  private selectedId: string | null = null;

  /**
   * Fired when the hovered node changes. `id` is the new hover target,
   * or null when leaving all nodes. Useful for upstream tooltip UI
   * outside the scene.
   */
  onHoverChange?: (id: string | null) => void;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Graph3D";
  }

  addNode(options: Node3DOptions): void {
    const color = toColor(options.color ?? 0x4dabf7);
    const radius = options.size ?? 6;
    const material = this.getNodeMaterial(color);
    // Geometry is per-node so we can vary radius. Cheap for <1k nodes;
    // when we hit InstancedMesh we'll merge per-shape buckets.
    const geom = makeShapeGeometry(options.shape ?? "sphere", radius);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(options.position[0], options.position[1], options.position[2]);
    mesh.userData.nodeId = options.id;
    mesh.userData.payload = options.data;
    this.group.add(mesh);

    // Label sprite: created up front, attached to the mesh so it
    // inherits the node's position. Hidden by default; setHovered /
    // setSelected toggle visibility. Sprite anchor is below-center so
    // the text sits above the sphere in screen space regardless of
    // camera angle.
    let labelSprite: THREE.Sprite | null = null;
    if (options.label) {
      labelSprite = makeTextSprite(options.label, {
        scale: 18,
        color: "#e0e8f0",
        background: "rgba(8, 12, 20, 0.78)",
      });
      labelSprite.center.set(0.5, -0.4);
      labelSprite.position.set(0, radius + 2, 0);
      labelSprite.visible = false;
      mesh.add(labelSprite);
    }

    this.nodes.set(options.id, {
      id: options.id,
      options,
      mesh,
      labelSprite,
      baseScale: 1,
    });
  }

  addEdge(options: Edge3DOptions): void {
    const fromN = this.nodes.get(options.from);
    const toN = this.nodes.get(options.to);
    if (!fromN || !toN) return;
    const color = toColor(options.color ?? 0x8b9bb4);
    const material = this.getEdgeMaterial(color);
    const geom = new THREE.BufferGeometry().setFromPoints([
      fromN.mesh.position.clone(),
      toN.mesh.position.clone(),
    ]);
    const line = new THREE.Line(geom, material);
    this.group.add(line);

    let arrow: THREE.Mesh | undefined;
    if (options.directional) {
      arrow = this.makeArrow(fromN.mesh.position, toN.mesh.position, color, toN.options.size ?? 6);
      this.group.add(arrow);
    }
    this.edges.push({ options, line, arrow });
  }

  /** Build a small cone aligned with the edge, sitting at the `to` boundary. */
  private makeArrow(from: THREE.Vector3, to: THREE.Vector3, color: number, targetRadius: number): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    dir.normalize();

    const coneLength = 8;
    const coneRadius = 2.5;
    const tipDistance = len - targetRadius - coneLength * 0.5;
    const tipPos = new THREE.Vector3().copy(from).addScaledVector(dir, tipDistance);

    const geom = new THREE.ConeGeometry(coneRadius, coneLength, 12);
    const material = this.getArrowMaterial(color);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.copy(tipPos);
    // ConeGeometry's default axis is +Y; rotate so the tip faces the
    // `to` node.
    const yAxis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);
    mesh.setRotationFromQuaternion(quat);
    return mesh;
  }

  /** Pick a node from a normalized device-space click. */
  pick(ndcX: number, ndcY: number, camera: THREE.Camera): Node3DOptions | null {
    const node = this.pickNode(ndcX, ndcY, camera);
    return node ? node.options : null;
  }

  /** Internal raycast that returns the Node3D record (with mesh access). */
  private pickNode(ndcX: number, ndcY: number, camera: THREE.Camera): Node3D | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const meshes: THREE.Object3D[] = [];
    for (const n of this.nodes.values()) meshes.push(n.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const id = hits[0].object.userData.nodeId as string | undefined;
    if (!id) return null;
    return this.nodes.get(id) ?? null;
  }

  /**
   * Update hover state from a normalized device-space pointer. Call
   * from a pointermove handler. Fires `onHoverChange` if the hovered
   * node identity changes; toggles the label sprite + size highlight.
   */
  updateHover(ndcX: number, ndcY: number, camera: THREE.Camera): void {
    const node = this.pickNode(ndcX, ndcY, camera);
    const newId = node ? node.id : null;
    if (newId === this.hoveredId) return;
    // Restore previous
    if (this.hoveredId) this.applyHighlight(this.hoveredId);
    this.hoveredId = newId;
    // Apply new
    if (newId) this.applyHighlight(newId);
    if (this.onHoverChange) this.onHoverChange(newId);
  }

  /** Set the persistent selection. Pass null to clear. */
  setSelected(id: string | null): void {
    if (id === this.selectedId) return;
    const prev = this.selectedId;
    this.selectedId = id;
    if (prev) this.applyHighlight(prev);
    if (id) this.applyHighlight(id);
  }

  /** Recompute scale + label visibility for a node based on hover/selection. */
  private applyHighlight(id: string): void {
    const n = this.nodes.get(id);
    if (!n) return;
    const isHover = this.hoveredId === id;
    const isSelected = this.selectedId === id;
    const scale = isSelected ? 1.45 : isHover ? 1.2 : 1.0;
    n.mesh.scale.setScalar(scale * n.baseScale);
    if (n.labelSprite) n.labelSprite.visible = isHover || isSelected;
  }

  /**
   * Diff-update: take new node + edge specs and mutate the scene to
   * match without tearing everything down. Existing nodes get position
   * + color patched in place; missing nodes are removed; brand-new
   * nodes are added. Edges are simpler to clear-and-readd (small,
   * unkeyed) — node teardown is what causes visible flicker, not
   * edges.
   *
   * Use this instead of `clear() + addNode/addEdge` whenever the data
   * is *evolving* rather than wholesale-replaced — e.g. time scrubbing
   * where most entities exist in both before/after frames.
   *
   * Limitation: node SIZE isn't updated (radius is baked into geometry).
   * Time scrubbing rarely changes confidence dramatically; if it does,
   * caller can `clear()` for a full rebuild.
   */
  update(spec: { nodes: Node3DOptions[]; edges: Edge3DOptions[] }): void {
    const newIds = new Set<string>();
    for (const n of spec.nodes) newIds.add(n.id);

    // Drop nodes no longer present.
    const toRemove: string[] = [];
    for (const id of this.nodes.keys()) {
      if (!newIds.has(id)) toRemove.push(id);
    }
    for (const id of toRemove) this.removeNode(id);

    // Add or patch.
    for (const opts of spec.nodes) {
      const existing = this.nodes.get(opts.id);
      if (existing) {
        this.patchNode(existing, opts);
      } else {
        this.addNode(opts);
      }
    }

    // Edges: clear and re-add. Lines are cheap; their teardown isn't
    // what causes flicker. If profiling shows otherwise, swap to a
    // diff keyed on `${from}::${to}::${type}`.
    this.clearEdges();
    for (const opts of spec.edges) this.addEdge(opts);

    // Hover/selected may now reference removed nodes — clear if so.
    if (this.hoveredId && !this.nodes.has(this.hoveredId)) this.hoveredId = null;
    if (this.selectedId && !this.nodes.has(this.selectedId)) this.selectedId = null;
  }

  /** Remove a node + its label, keep edges (caller manages those). */
  private removeNode(id: string): void {
    const n = this.nodes.get(id);
    if (!n) return;
    if (n.labelSprite) {
      n.mesh.remove(n.labelSprite);
      n.labelSprite.material.map?.dispose();
      n.labelSprite.material.dispose();
    }
    this.group.remove(n.mesh);
    n.mesh.geometry.dispose();
    this.nodes.delete(id);
  }

  /** Patch position + color on an existing node in place — no teardown. */
  private patchNode(node: Node3D, opts: Node3DOptions): void {
    node.mesh.position.set(opts.position[0], opts.position[1], opts.position[2]);
    if (opts.color !== undefined) {
      const color = toColor(opts.color);
      node.mesh.material = this.getNodeMaterial(color);
    }
    // Keep the existing label; updating text would re-paint canvas
    // and re-upload texture — not free, and rarely needed under scrub.
    node.options = opts;
    node.mesh.userData.payload = opts.data;
  }

  /** Tear down all edges (kept for clear() + diff-update flows). */
  private clearEdges(): void {
    for (const e of this.edges) {
      this.group.remove(e.line);
      e.line.geometry.dispose();
      if (e.arrow) {
        this.group.remove(e.arrow);
        e.arrow.geometry.dispose();
      }
    }
    this.edges = [];
  }

  /** Compute a bounding box around all node positions — useful for fitToBox. */
  computeBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const n of this.nodes.values()) {
      box.expandByPoint(n.mesh.position);
    }
    return box;
  }

  /**
   * World-space position of a node by id, or null if unknown. Useful
   * for upstream UI (panels, tooltips) that wants to anchor to a node
   * without diving into the internal mesh map.
   */
  getNodePosition(id: string): THREE.Vector3 | null {
    const n = this.nodes.get(id);
    return n ? n.mesh.position.clone() : null;
  }

  /** Effective rendered radius of a node (size × baseScale). */
  getNodeRadius(id: string): number {
    const n = this.nodes.get(id);
    if (!n) return 0;
    return (n.options.size ?? 6) * n.baseScale;
  }

  clear(): void {
    for (const id of Array.from(this.nodes.keys())) this.removeNode(id);
    this.clearEdges();
    this.hoveredId = null;
    this.selectedId = null;
  }

  // ── Material caches keep one material per color, sharing GPU state ──
  private getNodeMaterial(color: number): THREE.MeshStandardMaterial {
    let m = this.nodeMaterialCache.get(color);
    if (!m) {
      // Tuned alongside WorldHUD's bloom defaults — emissive ~0.85
      // with bloom threshold ~0.65 produces a subtle glow on bright
      // cores, no wash on the surrounding scene. Iter 3 of the tuning
      // (Frode found the prior 1.0 + 0.45 still too hot).
      m = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85,
        roughness: 0.5,
        metalness: 0.05,
      });
      this.nodeMaterialCache.set(color, m);
    }
    return m;
  }

  private getEdgeMaterial(color: number): THREE.LineBasicMaterial {
    let m = this.edgeMaterialCache.get(color);
    if (!m) {
      m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
      this.edgeMaterialCache.set(color, m);
    }
    return m;
  }

  private getArrowMaterial(color: number): THREE.MeshBasicMaterial {
    let m = this.arrowMaterialCache.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
      this.arrowMaterialCache.set(color, m);
    }
    return m;
  }
}

/** Accept "#rrggbb" / "rgb(...)" / hex number → number for THREE materials. */
function toColor(c: number | string): number {
  if (typeof c === "number") return c;
  return new THREE.Color(c).getHex();
}

/**
 * Build a Three.js BufferGeometry for the requested shape, normalised
 * so the visual weight at a given `size` is roughly comparable across
 * shapes. Each primitive has its own characteristic radius; we scale
 * the constructor inputs so an octahedron and a sphere at size=10 read
 * as similar volumes.
 *
 * Caller owns disposal — geometries are per-node here (small N), so
 * we don't share. InstancedMesh merge is the obvious next perf step.
 */
function makeShapeGeometry(shape: Node3DShape, size: number): THREE.BufferGeometry {
  switch (shape) {
    case "box":
      return new THREE.BoxGeometry(size * 1.55, size * 1.55, size * 1.55);
    case "cone":
      return new THREE.ConeGeometry(size * 0.95, size * 1.85, 14);
    case "cylinder":
      // Hex prism — 6 radial segments so it reads as a hexagonal pillar
      // (matches the 2D Graph's "hexagon" shape).
      return new THREE.CylinderGeometry(size * 0.95, size * 0.95, size * 1.5, 6);
    case "octahedron":
      return new THREE.OctahedronGeometry(size * 1.2);
    case "tetrahedron":
      return new THREE.TetrahedronGeometry(size * 1.3);
    case "icosahedron":
      return new THREE.IcosahedronGeometry(size * 1.05);
    case "torus":
      return new THREE.TorusGeometry(size * 0.9, size * 0.32, 12, 24);
    case "sphere":
    default:
      return new THREE.SphereGeometry(size, 16, 12);
  }
}
