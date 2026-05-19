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
 * - Labels and tooltips defer — Three.js text needs sprite/SDF/HTML
 *   strategy choice. Hover-picking is in.
 */

import * as THREE from "three";

export interface Node3DOptions {
  id: string;
  label?: string;
  position: [number, number, number];
  color?: number | string;
  /** Sphere radius. Default 6. */
  size?: number;
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

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Graph3D";
  }

  addNode(options: Node3DOptions): void {
    const color = toColor(options.color ?? 0x4dabf7);
    const radius = options.size ?? 6;
    const material = this.getNodeMaterial(color);
    // Geometry is per-node so we can vary radius. Cheap for <1k nodes;
    // when we hit InstancedMesh we'll merge them.
    const geom = new THREE.SphereGeometry(radius, 16, 12);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(options.position[0], options.position[1], options.position[2]);
    mesh.userData.nodeId = options.id;
    mesh.userData.payload = options.data;
    this.group.add(mesh);
    this.nodes.set(options.id, { id: options.id, options, mesh });
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
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hits = this.raycaster.intersectObjects(
      Array.from(this.nodes.values()).map((n) => n.mesh),
      false,
    );
    if (hits.length === 0) return null;
    const id = hits[0].object.userData.nodeId as string | undefined;
    if (!id) return null;
    return this.nodes.get(id)?.options ?? null;
  }

  /** Compute a bounding box around all node positions — useful for fitToBox. */
  computeBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const n of this.nodes.values()) {
      box.expandByPoint(n.mesh.position);
    }
    return box;
  }

  clear(): void {
    for (const n of this.nodes.values()) {
      this.group.remove(n.mesh);
      n.mesh.geometry.dispose();
    }
    for (const e of this.edges) {
      this.group.remove(e.line);
      e.line.geometry.dispose();
      if (e.arrow) {
        this.group.remove(e.arrow);
        e.arrow.geometry.dispose();
      }
    }
    this.nodes.clear();
    this.edges = [];
  }

  // ── Material caches keep one material per color, sharing GPU state ──
  private getNodeMaterial(color: number): THREE.MeshStandardMaterial {
    let m = this.nodeMaterialCache.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.1,
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
