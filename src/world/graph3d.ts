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
 *
 * "card" is a different beast: a billboarded translucent sprite
 * with kind-color accent + label text. Useful when you want every
 * entity to read as an Area42-style element rather than a geometric
 * primitive. Loses the kind→shape signal (kind→color stripe carries
 * it instead) but gains card-fidelity at every node.
 */
export type Node3DShape =
  | "sphere"        // default — generic / initiative
  | "box"           // solid / capability
  | "cone"          // directed / dependency
  | "cylinder"      // pillar (hexagonal prism for regulation)
  | "octahedron"    // diamond / risk
  | "tetrahedron"   // sharp / novelty
  | "icosahedron"   // multi-faceted / security or maturity
  | "torus"         // cyclic / event
  | "card";         // billboarded mini-card with label + kind stripe

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
  /** Either a Mesh (geometric shape) or a Sprite (card). */
  mesh: THREE.Object3D;
  /** True when `mesh` is a card sprite — affects disposal + label handling. */
  isCard: boolean;
  /** Hover/selection label sprite, hidden by default. Null for card nodes (the card already carries the label). */
  labelSprite: THREE.Sprite | null;
  /**
   * For card nodes only: a low-detail sphere shown when the camera is
   * further than `lodCardDistance`. Both representations share the same
   * world position; per-frame `applyLOD` flips visibility so we never
   * paint both at once. null for non-card nodes (those don't need a
   * fallback — sphere primitives stay visible at any distance).
   */
  fallbackMesh: THREE.Mesh | null;
  /** Hover label for the fallback sphere, mirrors labelSprite's role for non-card nodes. */
  fallbackLabel: THREE.Sprite | null;
  /**
   * Initial scale captured at addNode-time. We multiply by the
   * highlight factor on hover/select instead of using setScalar —
   * critical for Sprites (which store W/H/1 in their scale vec; a
   * scalar overwrite collapses them to a 1×1 world-units blob).
   */
  baseScale: THREE.Vector3;
  /** Current applied scale factor (× baseScale). Eased toward `targetScale` by tickScales. */
  scaleFactor: number;
  /** Pending eased-scale target, or null when the node is at rest. */
  targetScale: number | null;
}

interface Edge3D {
  options: Edge3DOptions;
  /** The edge's own Line, or null when edges are batched (then it lives at `index` in the shared LineSegments). */
  line: THREE.Line | null;
  arrow?: THREE.Mesh;
  /** Slot in the batch buffers (batched mode only). */
  index: number;
  /** Batched mode: false collapses the segment to a point so it draws nothing (isolation hides edges this way). */
  shown: boolean;
}

/** All edges in ONE LineSegments draw call: position + per-vertex colour buffers that grow by doubling. */
interface EdgeBatch {
  segments: THREE.LineSegments;
  capacity: number;
  pos: Float32Array;
  col: Float32Array;
  /** Resting rgb per edge. `col` holds RGBA per vertex: the rgb is this, the ALPHA is the highlight tier. */
  base: Float32Array;
}

export interface Graph3DOptions {
  /** Draw all edges as one LineSegments (one draw call, per-edge highlight tiers) instead of one THREE.Line each.
   *  Off by default so existing consumers are unchanged; turn it on for graphs with thousands of edges. */
  batchEdges?: boolean;
}

export class Graph3D {
  /** Group that all node/edge meshes live under — add to a Scene. */
  readonly group: THREE.Group;

  private nodes = new Map<string, Node3D>();
  private edges: Edge3D[] = [];
  private nodeMaterialCache = new Map<number, THREE.MeshStandardMaterial>();
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  private edgeMaterialCache = new Map<number, THREE.LineBasicMaterial>();
  private arrowMaterialCache = new Map<number, THREE.MeshBasicMaterial>();

  /** Reusable raycaster for picking. */
  private raycaster = new THREE.Raycaster();
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  /**
   * Multi-selection set, populated via shift-click or `setMultiSelected`.
   * Used for "drill-down into the relationships between these entities"
   * — edges *between* multi-selected nodes get rendered at full opacity
   * while unrelated edges dim. Independent of single-selectedId.
   */
  private multiSelectedIds = new Set<string>();

  /**
   * When non-null, only nodes whose id is in this set are visible; all
   * others (and edges touching them) are hidden. Survives the per-frame
   * LOD pass (applyLODForNode honors it). null = no isolation (all
   * visible). Set via setIsolated/clearIsolated — lets a consumer show
   * just a subgraph (e.g. "the entities this force affects") without
   * tearing down + rebuilding the scene.
   */
  private isolatedIds: Set<string> | null = null;

  /**
   * Fired when the hovered node changes. `id` is the new hover target,
   * or null when leaving all nodes. Useful for upstream tooltip UI
   * outside the scene.
   */
  onHoverChange?: (id: string | null) => void;

  /**
   * When false, hovering a node no longer reveals its in-scene label
   * sprite — the hover scale bump still applies and `onHoverChange` still
   * fires (so external readouts keep working), only the floating label is
   * suppressed. Selection and multi-select labels are unaffected. Lets a
   * consumer kill the "label pops up under the cursor and obstructs the
   * view" effect without losing hover tracking. Default true (prior
   * behavior).
   */
  showHoverLabel = true;

  /**
   * LOD: when set, card-shape nodes whose camera distance exceeds this
   * value swap to a small sphere fallback. Beyond this threshold the
   * card text becomes unreadable anyway, so trading it for a glowing
   * dot keeps the scene legible at zoom-out without losing the "this
   * thing exists here" cue. null = LOD disabled (card always visible).
   *
   * Caller drives the swap by calling `applyLOD(camera)` per frame —
   * Graph3D doesn't own a render loop.
   */
  private lodCardDistance: number | null = null;
  /** Last camera passed to applyLOD — used to apply LOD to nodes added after configuration. */
  private lastLODCamera: THREE.Camera | null = null;

  private batchEdges: boolean;
  private batch: EdgeBatch | null = null;

  constructor(opts: Graph3DOptions = {}) {
    this.batchEdges = opts.batchEdges === true;
    this.group = new THREE.Group();
    this.group.name = "Graph3D";
  }

  addNode(options: Node3DOptions): void {
    const color = toColor(options.color ?? 0x4dabf7);
    const radius = options.size ?? 6;
    const isCard = options.shape === "card";

    let mesh: THREE.Object3D;
    let labelSprite: THREE.Sprite | null = null;
    let fallbackMesh: THREE.Mesh | null = null;
    let fallbackLabel: THREE.Sprite | null = null;

    if (isCard) {
      // Card mode: a billboarded sprite with the label baked in.
      // The label IS the card content — no separate hover-label sprite.
      mesh = makeNodeCardSprite(options.label || options.id, color, radius);

      // LOD fallback: a small Area42-style emissive octahedron shown
      // when the camera is far enough that the card's text becomes
      // unreadable. Octahedron over a sphere because a glowing diamond
      // reads as a deliberate marker (think HUD waypoint) rather than
      // a marble — closer to the Area42 visual language. Shares the
      // node-material cache so the kind color glows uniformly.
      // Built alongside the card so applyLOD can flip visibility per
      // frame without rebuilding geometry. Hidden by default — the
      // card is the close-distance representation and stays visible
      // until setLODCardDistance + applyLOD say otherwise.
      const fallbackMaterial = this.getNodeMaterial(color);
      const fallbackGeom = this.getCachedGeometry(`fallback:${radius}`, () => new THREE.OctahedronGeometry(radius * 0.6));
      fallbackMesh = new THREE.Mesh(fallbackGeom, fallbackMaterial);
      fallbackMesh.visible = false;

      // Fallback gets its own hover label so far-away markers aren't
      // anonymous — same pattern as a regular sphere node.
      if (options.label) {
        fallbackLabel = makeTextSprite(options.label, {
          scale: 18,
          color: "#e0e8f0",
          background: "rgba(8, 12, 20, 0.78)",
        });
        fallbackLabel.center.set(0.5, -0.4);
        // Lift label clear of the octahedron's top vertex.
        fallbackLabel.position.set(0, radius * 0.6 + 2, 0);
        fallbackLabel.visible = false;
        fallbackMesh.add(fallbackLabel);
      }
    } else {
      // Geometric mode: a shared emissive material AND a shared geometry (one per shape+size, not one per node:
      // a 6,000-node graph used to build 6,000 geometries). The hover/select label is NOT built here — it is
      // created the first time the node is hovered or selected (`ensureLabel`), so a large graph never pays for
      // thousands of canvas textures nobody looks at.
      const material = this.getNodeMaterial(color);
      const geom = this.getShapeGeometry(options.shape ?? "sphere", radius);
      mesh = new THREE.Mesh(geom, material);
    }

    mesh.position.set(options.position[0], options.position[1], options.position[2]);
    mesh.userData.nodeId = options.id;
    mesh.userData.payload = options.data;
    this.group.add(mesh);

    if (fallbackMesh) {
      fallbackMesh.position.copy(mesh.position);
      fallbackMesh.userData.nodeId = options.id;
      fallbackMesh.userData.payload = options.data;
      this.group.add(fallbackMesh);
    }

    this.nodes.set(options.id, {
      id: options.id,
      options,
      mesh,
      isCard,
      labelSprite,
      fallbackMesh,
      fallbackLabel,
      baseScale: mesh.scale.clone(),
      scaleFactor: 1,
      targetScale: null,
    });

    // If LOD is already configured, apply it immediately to the new
    // node so it doesn't pop visible-then-hidden on the next frame.
    if (this.lodCardDistance !== null && this.lastLODCamera) {
      this.applyLODForNode(this.nodes.get(options.id)!, this.lastLODCamera);
    }
  }

  addEdge(options: Edge3DOptions): void {
    const fromN = this.nodes.get(options.from);
    const toN = this.nodes.get(options.to);
    if (!fromN || !toN) return;
    const color = toColor(options.color ?? 0x8b9bb4);

    let line: THREE.Line | null = null;
    let index = -1;
    if (this.batchEdges) {
      index = this.edges.length;
      this.ensureBatch(index + 1);
    } else {
      const material = this.getEdgeMaterial(color);
      const geom = new THREE.BufferGeometry().setFromPoints([
        fromN.mesh.position.clone(),
        toN.mesh.position.clone(),
      ]);
      line = new THREE.Line(geom, material);
      this.group.add(line);
    }

    let arrow: THREE.Mesh | undefined;
    if (options.directional) {
      arrow = this.makeArrow(fromN.mesh.position, toN.mesh.position, color, toN.options.size ?? 6);
      this.group.add(arrow);
    }
    const edge: Edge3D = { options, line, arrow, index, shown: true };
    this.edges.push(edge);
    if (this.batch) {
      const c = new THREE.Color(color);
      this.batch.base.set([c.r, c.g, c.b], index * 3);
      this.writeEdgePos(edge);
      this.writeEdgeColor(edge);
      this.batch.segments.geometry.setDrawRange(0, this.edges.length * 2);
      this.markBatchDirty();
    }
    // If a subgraph is isolated, a freshly added edge must respect it too.
    if (this.isolatedIds) {
      const vis = this.edgeEndpointsVisible(edge);
      this.setEdgeShown(edge, vis);
    }
  }

  // ── batched-edge plumbing ─────────────────────────────────────────────────────────────────────────────────────
  /** Make room for `n` edges: allocate the batch on first use, then grow by doubling (copying what is live). */
  private ensureBatch(n: number): void {
    if (!this.batch) {
      const capacity = Math.max(256, n);
      const segments = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1 }));
      segments.frustumCulled = false; // buffers change every update; a stale bounding sphere would cull live edges
      segments.name = "Graph3D.edges";
      this.batch = { segments, capacity: 0, pos: new Float32Array(0), col: new Float32Array(0), base: new Float32Array(0) };
      this.group.add(segments);
      this.growBatch(capacity);
      return;
    }
    if (n > this.batch.capacity) this.growBatch(Math.max(n, this.batch.capacity * 2));
  }

  private growBatch(capacity: number): void {
    const b = this.batch!;
    const pos = new Float32Array(capacity * 6); pos.set(b.pos);
    const col = new Float32Array(capacity * 8); col.set(b.col); // RGBA per vertex, two vertices per edge
    const base = new Float32Array(capacity * 3); base.set(b.base);
    const old = b.segments.geometry;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(col, 4)); // 4 components => three.js uses the vertex alpha
    geom.setDrawRange(0, this.edges.length * 2);
    b.segments.geometry = geom;
    old.dispose();
    b.capacity = capacity; b.pos = pos; b.col = col; b.base = base;
  }

  private markBatchDirty(): void {
    const g = this.batch!.segments.geometry;
    (g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Where a batched edge's two vertices sit: its nodes, or collapsed to its start when hidden (draws nothing). */
  private writeEdgePos(e: Edge3D): void {
    const b = this.batch!;
    const a = this.nodes.get(e.options.from)!.mesh.position;
    const z = e.shown ? this.nodes.get(e.options.to)!.mesh.position : a;
    b.pos.set([a.x, a.y, a.z, z.x, z.y, z.z], e.index * 6);
  }

  /** Brightness tier for an edge under the current multi-selection: between 1.0, incident 0.55, unrelated-while-active
   *  0.08, resting 0.55 (the same four levels the per-line opacity used, now genuinely per edge). */
  private edgeTier(e: Edge3D): number {
    const ms = this.multiSelectedIds;
    if (ms.size === 0) return 0.55;
    const fromHit = ms.has(e.options.from);
    const toHit = ms.has(e.options.to);
    return fromHit && toHit ? 1.0 : fromHit || toHit ? 0.55 : 0.08;
  }

  private writeEdgeColor(e: Edge3D): void {
    const b = this.batch!;
    // The tier is the vertex ALPHA, not a dimmer colour: premultiplying made resting edges dark and opaque, which showed
    // as dark stripes wherever an edge crossed in front of a node; alpha blends exactly like the per-line opacity did.
    const t = this.edgeTier(e);
    const i = e.index * 3;
    const r = b.base[i], g = b.base[i + 1], bl = b.base[i + 2];
    b.col.set([r, g, bl, t, r, g, bl, t], e.index * 8);
  }

  /** Show/hide one edge (and its arrow) in whichever mode is active. */
  private setEdgeShown(e: Edge3D, shown: boolean): void {
    if (e.line) e.line.visible = shown;
    if (e.arrow) e.arrow.visible = shown;
    if (this.batch && e.shown !== shown) {
      e.shown = shown;
      this.writeEdgePos(e);
      this.markBatchDirty();
    }
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
    // Include both the primary mesh and (when present + visible) the
    // LOD fallback. Three.js raycaster respects .visible by default,
    // so a hidden card or hidden fallback won't be hit — the user's
    // cursor always picks whichever representation they actually see.
    const meshes: THREE.Object3D[] = [];
    for (const n of this.nodes.values()) {
      meshes.push(n.mesh);
      if (n.fallbackMesh) meshes.push(n.fallbackMesh);
    }
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

  /** Add or remove a node from the multi-selection. Returns the new
   *  state of the toggled id (true = now in set). */
  toggleMultiSelected(id: string): boolean {
    if (this.multiSelectedIds.has(id)) {
      this.multiSelectedIds.delete(id);
      this.applyHighlight(id);
      this.applyEdgeHighlights();
      return false;
    }
    this.multiSelectedIds.add(id);
    this.applyHighlight(id);
    this.applyEdgeHighlights();
    return true;
  }

  /** Replace the entire multi-selection. */
  setMultiSelected(ids: string[]): void {
    const next = new Set(ids);
    const touched = new Set<string>([...this.multiSelectedIds, ...next]);
    this.multiSelectedIds = next;
    for (const id of touched) this.applyHighlight(id);
    this.applyEdgeHighlights();
  }

  /** Clear the multi-selection. Single selection is unaffected. */
  clearMultiSelected(): void {
    if (this.multiSelectedIds.size === 0) return;
    const prev = Array.from(this.multiSelectedIds);
    this.multiSelectedIds.clear();
    for (const id of prev) this.applyHighlight(id);
    this.applyEdgeHighlights();
  }

  /** Read the current multi-selection. */
  getMultiSelected(): string[] {
    return Array.from(this.multiSelectedIds);
  }

  /**
   * Isolate a subset: only the given node ids stay visible; every other
   * node — and any edge touching a hidden node — is hidden. Does NOT
   * remove anything, so it's instantly reversible via clearIsolated() and
   * survives axis-swaps / scrubs. Honored by the per-frame LOD pass.
   * Passing an empty array hides everything; use clearIsolated to restore.
   */
  setIsolated(ids: string[]): void {
    this.isolatedIds = new Set(ids);
    for (const [id, n] of this.nodes) {
      const vis = this.isolatedIds.has(id);
      n.mesh.visible = vis;
      if (n.fallbackMesh) n.fallbackMesh.visible = vis;
    }
    this.refreshEdgeVisibility();
  }

  /** Restore full visibility after setIsolated. No-op if not isolated. */
  clearIsolated(): void {
    if (!this.isolatedIds) return;
    this.isolatedIds = null;
    for (const n of this.nodes.values()) {
      n.mesh.visible = true;
      if (n.fallbackMesh) n.fallbackMesh.visible = true;
    }
    this.refreshEdgeVisibility();
  }

  /** Whether both of an edge's endpoints are currently visible. */
  private edgeEndpointsVisible(e: Edge3D): boolean {
    if (!this.isolatedIds) return true;
    return this.isolatedIds.has(e.options.from) && this.isolatedIds.has(e.options.to);
  }

  /** Re-hide/show edges to match the current isolation state. */
  private refreshEdgeVisibility(): void {
    for (const e of this.edges) this.setEdgeShown(e, this.edgeEndpointsVisible(e));
  }

  /** Recompute scale + label visibility for a node based on hover/selection. */
  private applyHighlight(id: string): void {
    const n = this.nodes.get(id);
    if (!n) return;
    const isHover    = this.hoveredId === id;
    const isSelected = this.selectedId === id;
    const isMulti    = this.multiSelectedIds.has(id);
    // Selection > multi > hover. Hover label appears for any of them.
    const factor = isSelected ? 1.45 : isMulti ? 1.3 : isHover ? 1.2 : 1.0;
    // Multiply baseScale (NOT setScalar) — Sprites store W/H/1 in
    // .scale, so any scalar overwrite collapses them to a 1×1 blob.
    // For Mesh nodes baseScale is (1,1,1) so this is equivalent to
    // setScalar(factor) anyway.
    n.mesh.scale.set(
      n.baseScale.x * factor,
      n.baseScale.y * factor,
      n.baseScale.z * factor,
    );
    // Keep the LOD fallback in sync — it has its own (1,1,1) baseScale
    // so a plain setScalar suffices. Without this the fallback sphere
    // would never react to hover/select when the camera is zoomed out.
    if (n.fallbackMesh) {
      n.fallbackMesh.scale.setScalar(factor);
    }
    // Hover alone reveals the label only when showHoverLabel is on;
    // selection + multi-select always label regardless.
    const labelOn = isSelected || isMulti || (isHover && this.showHoverLabel);
    if (labelOn) this.ensureLabel(n);
    if (n.labelSprite)   n.labelSprite.visible   = labelOn;
    if (n.fallbackLabel) n.fallbackLabel.visible = labelOn;
  }

  /**
   * When 1+ nodes are multi-selected, surface their local
   * neighbourhood: edges *between* multi-selected nodes get full
   * brightness, edges that *touch* any multi-selected node go
   * medium (still readable), and the rest dim hard. With three tiers
   * the user can read "what flows between THESE entities" even when
   * the pair has no direct edge — the shared neighbours stand out
   * via their connections to both.
   *
   * With 0 multi-selected, behaviour is the prior default
   * (edges at their normal 0.55 opacity).
   */
  private applyEdgeHighlights(): void {
    const ms = this.multiSelectedIds;
    const active = ms.size >= 1;
    for (const e of this.edges) {
      const fromHit = ms.has(e.options.from);
      const toHit   = ms.has(e.options.to);
      const between  = active && fromHit && toHit;
      const incident = active && (fromHit || toHit);

      // Three-tier hierarchy: between (the connections you asked for),
      // incident (their neighbourhood), other (background).
      if (e.line) {
        const mat = e.line.material as THREE.LineBasicMaterial;
        mat.opacity = between ? 1.0 : incident ? 0.55 : active ? 0.08 : 0.55;
      } else if (this.batch) {
        this.writeEdgeColor(e);
      }
      // Arrowheads ride along too — same hierarchy.
      if (e.arrow) {
        const am = e.arrow.material as THREE.MeshBasicMaterial;
        am.opacity = between ? 1.0 : incident ? 0.85 : active ? 0.12 : 0.85;
      }
    }
    if (this.batch) this.markBatchDirty();
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
    // Drop any multi-selected ids that no longer exist; keep the
    // ones that survived the diff so the selection persists across
    // time-scrub / axis-swap.
    for (const id of Array.from(this.multiSelectedIds)) {
      if (!this.nodes.has(id)) this.multiSelectedIds.delete(id);
    }
    // Edges were torn down + readded — re-apply the multi-select edge
    // highlight against the fresh edge set.
    this.applyEdgeHighlights();
  }

  /**
   * Cheap in-place rescale for time-scrubbing / animation. Multiplies the node's
   * captured base scale by `factor` (use 0 to hide) without rebuilding geometry,
   * edges, or running the node diff. Call this per scrub tick — never `update()` —
   * to keep scrubbing smooth on large graphs.
   */
  /** Set a node's scale factor (× baseScale). Instant by default; pass `smooth` to ease toward
   *  it over a few frames via tickScales — turns a discrete timeline scrub into a fluid grow/
   *  shrink instead of a pop. */
  setNodeScale(id: string, factor: number, smooth = false): void {
    const n = this.nodes.get(id);
    if (!n) return;
    if (smooth) {
      n.targetScale = factor;
      return;
    }
    n.targetScale = null;
    n.scaleFactor = factor;
    this.applyScale(n, factor);
  }

  private applyScale(n: Node3D, f: number): void {
    n.mesh.scale.copy(n.baseScale).multiplyScalar(f);
    if (n.fallbackMesh) n.fallbackMesh.scale.copy(n.baseScale).multiplyScalar(f);
  }

  /** Advance eased scale animations. Call once per frame from your render hook with the frame
   *  delta (seconds). Frame-rate independent; a no-op when nothing is animating. */
  tickScales(dt: number): void {
    if (dt <= 0) dt = 1 / 60;
    const rate = 1 - Math.exp(-dt * 14); // ~99% within ~330ms, smooth but snappy
    for (const n of this.nodes.values()) {
      if (n.targetScale === null) continue;
      const next = n.scaleFactor + (n.targetScale - n.scaleFactor) * rate;
      if (Math.abs(n.targetScale - next) < 0.004) {
        n.scaleFactor = n.targetScale;
        n.targetScale = null;
      } else {
        n.scaleFactor = next;
      }
      this.applyScale(n, n.scaleFactor);
    }
  }

  /** Recolor a node in place via the shared material cache — cheap enough for a scrub/lens
   *  loop (no teardown). Geometric nodes only; a card's color is baked into its texture and
   *  is skipped (re-painting the canvas under a lens is expensive and rarely wanted). */
  setNodeColor(id: string, color: number | string): void {
    const n = this.nodes.get(id);
    if (!n || n.isCard) return;
    const mat = this.getNodeMaterial(toColor(color));
    (n.mesh as THREE.Mesh).material = mat;
    if (n.fallbackMesh) n.fallbackMesh.material = mat;
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
    if (n.isCard) {
      // Card: Sprite owns its CanvasTexture material — dispose both.
      const sprite = n.mesh as THREE.Sprite;
      sprite.material.map?.dispose();
      sprite.material.dispose();
    } else {
      // Geometric: geometry AND material are shared via their caches — other nodes still use them, so neither is
      // disposed here (the cache is bounded by the number of distinct shape+size combinations).
    }
    // LOD fallback (cards only): dispose its label + geometry.
    if (n.fallbackMesh) {
      if (n.fallbackLabel) {
        n.fallbackMesh.remove(n.fallbackLabel);
        n.fallbackLabel.material.map?.dispose();
        n.fallbackLabel.material.dispose();
      }
      this.group.remove(n.fallbackMesh);
      // Geometry + material are shared via their caches — leave alone.
    }
    this.nodes.delete(id);
  }

  /** Patch position + color on an existing node in place — no teardown. */
  private patchNode(node: Node3D, opts: Node3DOptions): void {
    node.mesh.position.set(opts.position[0], opts.position[1], opts.position[2]);
    if (opts.color !== undefined && !node.isCard) {
      // Geometric mode: swap to the cached material for the new color.
      // Card mode skips this — the card's color is baked into its
      // canvas texture; re-painting under scrub is expensive and
      // rarely needed (entity colors rarely change over time).
      const color = toColor(opts.color);
      (node.mesh as THREE.Mesh).material = this.getNodeMaterial(color);
    }
    // Keep the LOD fallback co-located with the primary mesh under
    // diff-update (e.g. time-scrub repositions both). Color is also
    // patched so a re-themed node's fallback dot tracks the change.
    if (node.fallbackMesh) {
      node.fallbackMesh.position.set(opts.position[0], opts.position[1], opts.position[2]);
      if (opts.color !== undefined) {
        const color = toColor(opts.color);
        node.fallbackMesh.material = this.getNodeMaterial(color);
      }
    }
    // Keep the existing label; updating text would re-paint canvas
    // and re-upload texture — not free, and rarely needed under scrub.
    node.options = opts;
    node.mesh.userData.payload = opts.data;
    if (node.fallbackMesh) node.fallbackMesh.userData.payload = opts.data;
  }

  /** Tear down all edges (kept for clear() + diff-update flows). */
  private clearEdges(): void {
    for (const e of this.edges) {
      if (e.line) {
        this.group.remove(e.line);
        e.line.geometry.dispose();
      }
      if (e.arrow) {
        this.group.remove(e.arrow);
        e.arrow.geometry.dispose();
      }
    }
    this.edges = [];
    // Batched: keep the buffers (they are reused by the next addEdge run); just draw nothing until then.
    if (this.batch) this.batch.segments.geometry.setDrawRange(0, 0);
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

  /**
   * Effective vertical extent of a node — used by upstream UI to
   * anchor labels / panels above the node without overlap. For
   * geometric Mesh nodes this is the visual radius (size). For card
   * Sprites it's half-height in world units (cards are wide-but-short,
   * and the panel anchor wants the visual top, not the sprite width).
   */
  getNodeRadius(id: string): number {
    const n = this.nodes.get(id);
    if (!n) return 0;
    if (n.isCard) {
      return n.baseScale.y * 0.5;
    }
    // Mesh: baseScale is (1,1,1) so this is just options.size.
    return (n.options.size ?? 6) * Math.max(n.baseScale.x, n.baseScale.y, n.baseScale.z);
  }

  clear(): void {
    for (const id of Array.from(this.nodes.keys())) this.removeNode(id);
    this.clearEdges();
    this.hoveredId = null;
    this.selectedId = null;
    this.multiSelectedIds.clear();
  }

  /**
   * Configure level-of-detail for card-shape nodes. When `distance` is
   * set, every card whose camera distance exceeds `distance` swaps to
   * its small sphere fallback on the next `applyLOD(camera)` call;
   * cards within range stay rendered as cards.
   *
   * Trade-off: at extreme zoom-out, dozens of overlapping cards become
   * a wall of unreadable text. Swapping them to glowing dots beyond a
   * distance threshold preserves the "things exist here" cue without
   * the visual noise. Hovering or zooming back in restores the card.
   *
   * Pass null to disable LOD (cards always visible). Sphere-shape and
   * other geometric nodes are unaffected — they have no fallback and
   * are intended to read at any distance.
   */
  setLODCardDistance(distance: number | null): void {
    this.lodCardDistance = distance;
    if (distance === null) {
      // Disabling LOD — restore every card and hide every fallback.
      for (const n of this.nodes.values()) {
        if (!n.fallbackMesh) continue;
        n.mesh.visible = true;
        n.fallbackMesh.visible = false;
      }
    }
  }

  /**
   * Apply LOD swaps based on the camera's current position. Call once
   * per frame from your render hook (cheap — just N distanceToSquared
   * calls + visibility flips). No-op when LOD is unconfigured or when
   * no card-shape nodes exist.
   */
  applyLOD(camera: THREE.Camera): void {
    this.lastLODCamera = camera;
    if (this.lodCardDistance === null) return;
    for (const n of this.nodes.values()) {
      if (!n.fallbackMesh) continue;
      this.applyLODForNode(n, camera);
    }
  }

  /** Per-node LOD: flip card vs fallback based on camera distance. */
  private applyLODForNode(n: Node3D, camera: THREE.Camera): void {
    // Isolation wins over LOD: a hidden node stays hidden every frame.
    if (this.isolatedIds && !this.isolatedIds.has(n.options.id)) {
      n.mesh.visible = false;
      if (n.fallbackMesh) n.fallbackMesh.visible = false;
      return;
    }
    if (!n.fallbackMesh || this.lodCardDistance === null) return;
    // distanceToSquared avoids the sqrt — we compare against the
    // squared threshold. With ~500 nodes per frame this saves a
    // measurable chunk of CPU for an otherwise idle render loop.
    const d2 = n.mesh.position.distanceToSquared(camera.position);
    const t2 = this.lodCardDistance * this.lodCardDistance;
    const showCard = d2 < t2;
    n.mesh.visible = showCard;
    n.fallbackMesh.visible = !showCard;
  }

  // ── Material caches keep one material per color, sharing GPU state ──
  /** Shared geometry, one per shape+size (never per node). Kept for the life of the graph: bounded by the number of
   *  distinct shape/size pairs, and other nodes may still be using it when one node is removed. */
  private getCachedGeometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geometryCache.get(key);
    if (!g) { g = make(); this.geometryCache.set(key, g); }
    return g;
  }

  private getShapeGeometry(shape: string, radius: number): THREE.BufferGeometry {
    return this.getCachedGeometry(`${shape}:${radius}`, () => makeShapeGeometry(shape as Node3DOptions["shape"] & string, radius));
  }

  /** Build a geometric node's hover/select label the first time it is wanted. A node with no `label`, or a card
   *  (which carries its own), never gets one. */
  private ensureLabel(n: Node3D): void {
    if (n.labelSprite || n.isCard || !n.options.label) return;
    const radius = n.options.size ?? 6;
    const sprite = makeTextSprite(n.options.label, {
      scale: 18,
      color: "#e0e8f0",
      background: "rgba(8, 12, 20, 0.78)",
    });
    sprite.center.set(0.5, -0.4);
    sprite.position.set(0, radius + 2, 0);
    sprite.visible = false;
    n.mesh.add(sprite);
    n.labelSprite = sprite;
  }

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
    case "card":
    default:
      return new THREE.SphereGeometry(size, 16, 12);
  }
}

/**
 * Build a billboarded mini-card sprite for an entity — the Area42
 * card aesthetic carried into the world at every node. Translucent
 * background, kind-color stripe down the left, label text truncated
 * to fit. Auto-faces the camera (Sprite billboard) so it's readable
 * from any angle.
 *
 * Size semantics: caller's `size` only loosely scales the card —
 * cards are dominated by the label text width, so small/large
 * entities don't look dramatically different. confidence-as-radius
 * doesn't apply visually (cards are uniform). That's intentional;
 * cards are about identity, geometric shapes are about magnitude.
 */
function makeNodeCardSprite(label: string, kindColor: number, size: number): THREE.Sprite {
  // World-unit dimensions. Roughly 90 wu wide × 22 wu tall — sized
  // so labels remain legible at default camera distance without
  // dominating the scene at 151 nodes. Slightly slimmer than the
  // first pass so the cards feel less heavy when packed close.
  const W_WU = 88 + Math.min(20, size * 0.5);
  const H_WU = 22;
  // 6× DPI multiplier — bumped from 4 after Frode noted the text
  // could be crisper. Small font + dense pixel grid = sharp glyphs
  // even when the camera flies close.
  const RES = 6;
  const cw = Math.round(W_WU * RES);
  const ch = Math.round(H_WU * RES);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(RES, RES);

  const colorStr = "#" + kindColor.toString(16).padStart(6, "0");

  // Background: translucent rounded rect, slight inset to avoid
  // sub-pixel border bleed at the edge.
  ctx.fillStyle = "rgba(14, 20, 33, 0.88)";
  cardRoundRect(ctx, 0.75, 0.75, W_WU - 1.5, H_WU - 1.5, 4);
  ctx.fill();

  // Kind-color border. Thin, since the stripe carries most of the
  // identity signal.
  ctx.strokeStyle = colorStr;
  ctx.lineWidth = 0.75;
  cardRoundRect(ctx, 0.75, 0.75, W_WU - 1.5, H_WU - 1.5, 4);
  ctx.stroke();

  // Kind-color stripe on the left — the strongest identity cue.
  ctx.fillStyle = colorStr;
  cardRoundRect(ctx, 1.75, 1.75, 3, H_WU - 3.5, 1);
  ctx.fill();

  // Label text — smaller, with crisper rendering at the 6× canvas
  // density. SF Mono / Menlo gives that "console line" feel that
  // matches the Area42 chrome.
  ctx.font = "600 10px -apple-system, system-ui, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#e0e8f0";
  ctx.textBaseline = "middle";
  let trimmed = label;
  const maxW = W_WU - 12;
  while (ctx.measureText(trimmed).width > maxW && trimmed.length > 4) {
    trimmed = trimmed.slice(0, -2) + "…";
  }
  ctx.fillText(trimmed, 8.5, H_WU / 2);

  const tex = new THREE.CanvasTexture(canvas);
  // Anisotropic sampling helps glyph crispness at oblique angles
  // (when the card is in the periphery and you're flying past).
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(W_WU, H_WU, 1);
  return sprite;
}

function cardRoundRect(
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
