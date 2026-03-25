/**
 * Area42 Force-Directed Graph Engine
 *
 * Replaces D3.js with a lightweight, Canvas-native force simulation.
 * Supports animated particles flowing along edges, node shapes with glow,
 * and interactive drill-down (expand/collapse).
 */

import { SceneNode, Vec2 } from "../core/scene.js";
import { ParticleSystem } from "../effects/particles.js";
import { NeonTheme } from "../themes/neon.js";

/** Options for creating a graph node */
export interface GraphNodeOptions {
  id: string;
  label: string;
  position?: Vec2;
  color?: string;
  glow?: string;
  size?: number;
  shape?: "circle" | "hexagon" | "diamond" | "rect";
  data?: any;
}

/** Detail data for edge inspection panel */
export interface EdgeDetail {
  title: string;
  subtitle?: string;
  color?: string;
  fields: Array<{ label: string; value: string | number; color?: string }>;
}

/** Options for creating a graph edge */
export interface GraphEdgeOptions {
  from: string;
  to: string;
  label?: string;
  color?: string;
  width?: number;
  particles?: boolean;
  dashed?: boolean;
  data?: Record<string, any>;
  detail?: EdgeDetail;
}

/** Options for spawning a particle along an edge */
export interface ParticleOptions {
  color?: string;
  speed?: number;
  size?: number;
}

/** Internal graph node with physics state */
export class GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  color: string;
  glow: string;
  radius: number;
  shape: "circle" | "hexagon" | "diamond" | "rect";
  data: any;
  /** Pulse animation (0 = no pulse, decays over time) */
  pulseIntensity = 0;
  pulseColor = "#ffffff";
  /** Whether this node is pinned (no physics) */
  pinned = false;
  /** Gravity well: true when node has expanded children */
  isWell = false;
  /** Gravity well radius of attraction */
  wellRadius = 120;
  /** Gravity well strength (how strongly children are pulled) */
  wellStrength = 0.05;
  /** Children added via expand() */
  childIds: string[] = [];
  /** Parent node ID if this was added via expand() */
  parentId: string | null = null;
  /** Whether this node is selected (multi-select) */
  selected = false;

  constructor(options: GraphNodeOptions) {
    this.id = options.id;
    this.label = options.label;
    this.x = options.position?.x ?? (Math.random() * 400 - 200);
    this.y = options.position?.y ?? (Math.random() * 400 - 200);
    this.color = options.color ?? NeonTheme.accent;
    this.glow = options.glow ?? this.color;
    this.radius = options.size ?? 20;
    this.shape = options.shape ?? "circle";
    this.data = options.data;
  }
}

/** Internal graph edge */
export class GraphEdge {
  from: string;
  to: string;
  label: string;
  color: string;
  width: number;
  particles: boolean;
  dashed: boolean;
  data: Record<string, any>;
  detail: EdgeDetail | undefined;
  /** Whether this edge is selected (highlighted) */
  selected = false;
  /** Timer for auto-particle emission */
  particleTimer = 0;

  constructor(options: GraphEdgeOptions) {
    this.from = options.from;
    this.to = options.to;
    this.label = options.label ?? "";
    this.color = options.color ?? NeonTheme.border;
    this.width = options.width ?? 1;
    this.particles = options.particles ?? false;
    this.dashed = options.dashed ?? false;
    this.data = options.data ?? {};
    this.detail = options.detail;
  }
}

/** Layout algorithm type */
export type LayoutType = "force" | "radial" | "tree";

/**
 * Force-directed graph with animated particles and glow effects.
 *
 * Extends SceneNode so it integrates with the Area42 scene graph.
 * The force simulation runs each frame with:
 * - Charge repulsion (inverse square, strength -200)
 * - Spring attraction (natural length 100)
 * - Center gravity
 * - Damping (velocity *= 0.92)
 * - Collision detection (minimum distance = sum of radii)
 */
export class Graph extends SceneNode {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private particleSys: ParticleSystem = new ParticleSystem();
  private centerX = 0;
  private centerY = 0;
  private layoutType: LayoutType = "force";
  private expandCallback: ((nodeId: string, node: GraphNode) => Promise<GraphNodeOptions[]> | GraphNodeOptions[] | null) | null = null;
  private simulationActive = true;

  /** Currently hovered edge (for highlight effect) */
  hoveredEdge: GraphEdge | null = null;

  // Pan and zoom state
  offsetX = 0;
  offsetY = 0;
  zoom = 1.0;
  private readonly ZOOM_MIN = 0.3;
  private readonly ZOOM_MAX = 3.0;

  // Force parameters
  private repulsionStrength = -400;
  private springLength = 150;
  private springStrength = 0.003;
  private centerGravity = 0.001;
  private damping = 0.85;
  private alpha = 1.0;         // simulation "temperature" — decays to settle
  private alphaDecay = 0.998;  // how fast it cools (closer to 1 = slower)
  private alphaMin = 0.01;     // stop simulating below this

  constructor(options: { id?: string; position?: Vec2; size?: Vec2 } = {}) {
    super({
      id: options.id ?? "graph",
      position: options.position ?? { x: 0, y: 0 },
      size: options.size ?? { x: 800, y: 600 },
    });
  }

  /**
   * Add a node to the graph.
   * @returns The created GraphNode
   */
  addNode(options: GraphNodeOptions): GraphNode {
    const node = new GraphNode(options);
    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Add an edge between two nodes.
   * @returns The created GraphEdge
   */
  addEdge(options: GraphEdgeOptions): GraphEdge {
    const edge = new GraphEdge(options);
    this.edges.push(edge);
    return edge;
  }

  /**
   * Remove a node and all its connected edges.
   */
  removeNode(id: string): void {
    this.nodes.delete(id);
    this.edges = this.edges.filter((e) => e.from !== id && e.to !== id);
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Trigger a visual pulse effect on a node.
   * @param nodeId - Node to pulse
   * @param color - Pulse color (defaults to white)
   */
  pulse(nodeId: string, color?: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.pulseIntensity = 1;
      node.pulseColor = color ?? "#ffffff";
      // Also emit burst particles
      const wp = this.worldPosition();
      this.particleSys.emit(this.centerX + node.x, this.centerY + node.y, {
        count: 12,
        color: color ?? node.glow,
        speed: 40,
        size: 2,
        decay: 0.03,
      });
      this.reheat(0.15);
    }
  }

  /**
   * Spawn an animated particle that travels along an edge.
   */
  particle(fromId: string, toId: string, options?: ParticleOptions): void {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    if (!fromNode || !toNode) return;

    const ox = this.centerX;
    const oy = this.centerY;

    this.particleSys.emitAlongEdge(
      { x: ox + fromNode.x, y: oy + fromNode.y },
      { x: ox + toNode.x, y: oy + toNode.y },
      options?.color ?? NeonTheme.accent,
      options?.speed ?? 0.5,
    );
  }

  /**
   * Expand a node by adding child nodes around it.
   * @param nodeId - Parent node to expand
   * @param children - Child node options (positions will be auto-calculated)
   */
  expand(nodeId: string, children: GraphNodeOptions[]): void {
    const parent = this.nodes.get(nodeId);
    if (!parent) return;

    parent.isWell = true;  // Activate gravity well for children

    const angleStep = (Math.PI * 2) / children.length;
    const expandRadius = 60;

    for (let i = 0; i < children.length; i++) {
      const angle = angleStep * i;
      const child = new GraphNode({
        ...children[i],
        position: {
          x: parent.x + Math.cos(angle) * expandRadius,
          y: parent.y + Math.sin(angle) * expandRadius,
        },
      });
      child.parentId = nodeId;
      // Give initial outward velocity so children spread naturally
      child.vx = Math.cos(angle) * 30;
      child.vy = Math.sin(angle) * 30;
      this.nodes.set(child.id, child);
      parent.childIds.push(child.id);

      // Add edge from parent to child
      this.edges.push(
        new GraphEdge({
          from: nodeId,
          to: child.id,
          color: parent.color + "66",
          width: 0.8,
          particles: false,
        }),
      );
    }
  }

  /**
   * Collapse a node by removing all its children.
   */
  collapse(nodeId: string): void {
    const parent = this.nodes.get(nodeId);
    if (!parent) return;

    // Check if parent was manually placed (has saved position)
    // If not, unpin so physics can move it
    // For now, keep it pinned since user likely placed it

    parent.isWell = false;  // Deactivate gravity well

    const toRemove = [...parent.childIds];
    for (const childId of toRemove) {
      // Recursively collapse children first
      this.collapse(childId);
      this.removeNode(childId);
    }
    parent.childIds = [];
  }

  /**
   * Switch layout algorithm.
   */
  layout(type: LayoutType): void {
    this.layoutType = type;
    if (type === "radial") {
      this.applyRadialLayout();
    } else if (type === "tree") {
      this.applyTreeLayout();
    }
    // "force" is the default continuous simulation
  }

  /** Access the particle system (for external rendering) */
  getParticleSystem(): ParticleSystem {
    return this.particleSys;
  }

  /** Get all nodes */
  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /** Get all edges */
  getEdges(): GraphEdge[] {
    return this.edges;
  }

  /**
   * Update physics simulation and particles.
   * Called each frame by the scene graph.
   */
  override update(dt: number): void {
    super.update(dt);

    this.centerX = this.size.x / 2;
    this.centerY = this.size.y / 2;

    const dtSec = Math.min(dt / 1000, 0.05); // cap to prevent explosion

    if (this.simulationActive && this.layoutType === "force") {
      this.stepForceSimulation(dtSec);
    }

    // Update pulse decay
    for (const node of this.nodes.values()) {
      if (node.pulseIntensity > 0) {
        node.pulseIntensity *= 0.95;
        if (node.pulseIntensity < 0.01) node.pulseIntensity = 0;
      }
    }

    // Auto-emit particles on edges that have particles enabled
    for (const edge of this.edges) {
      if (edge.particles) {
        edge.particleTimer += dtSec;
        if (edge.particleTimer > 0.8) {
          edge.particleTimer = 0;
          this.particle(edge.from, edge.to, { color: edge.color, speed: 0.4 });
        }
      }
    }

    this.particleSys.update(dtSec);
  }

  /**
   * Render the graph: edges, nodes, labels, particles.
   */
  override render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.zoom, this.zoom);

    const ox = this.centerX;
    const oy = this.centerY;

    // --- Check if any node is selected (for relationship highlighting) ---
    const anySelected = Array.from(this.nodes.values()).some((n) => n.selected);

    // --- Render edges ---
    for (const edge of this.edges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      const isHovered = edge === this.hoveredEdge;
      const isEdgeSelected = edge.selected;

      ctx.save();
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = edge.width;

      // Hovered or selected edge gets extra glow and width
      if (isEdgeSelected) {
        ctx.lineWidth = edge.width * 2.5;
        ctx.shadowColor = edge.color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 1.0;
      } else if (isHovered) {
        ctx.lineWidth = edge.width * 2.0;
        ctx.shadowColor = edge.color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.9;
      } else if (anySelected) {
        // Selection-aware edge opacity
        if (fromNode.selected && toNode.selected) {
          ctx.globalAlpha = 1.0;
          ctx.lineWidth = edge.width * 1.8;
          ctx.shadowColor = edge.color;
          ctx.shadowBlur = 8;
        } else if (fromNode.selected || toNode.selected) {
          ctx.globalAlpha = 0.4;
        } else {
          ctx.globalAlpha = 0.1;
        }
      } else {
        ctx.globalAlpha = 0.6;
      }

      if (edge.dashed) {
        ctx.setLineDash([6, 4]);
      }

      // Slight curve for visual interest
      const mx = (fromNode.x + toNode.x) / 2;
      const my = (fromNode.y + toNode.y) / 2;
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const cx = mx - dy * 0.05;
      const cy = my + dx * 0.05;

      ctx.beginPath();
      ctx.moveTo(ox + fromNode.x, oy + fromNode.y);
      ctx.quadraticCurveTo(ox + cx, oy + cy, ox + toNode.x, oy + toNode.y);
      ctx.stroke();

      // Edge glow
      ctx.shadowColor = edge.color;
      ctx.shadowBlur = 4;
      ctx.globalAlpha = 0.15;
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.restore();

      // Edge label
      if (edge.label) {
        ctx.save();
        ctx.fillStyle = NeonTheme.textDim;
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(edge.label, ox + cx, oy + cy - 6);
        ctx.restore();
      }
    }

    // --- Render nodes ---
    for (const node of this.nodes.values()) {
      const nx = ox + node.x;
      const ny = oy + node.y;

      ctx.save();

      // Pulse ring
      if (node.pulseIntensity > 0) {
        const pr = node.radius + 15 * node.pulseIntensity;
        ctx.beginPath();
        ctx.arc(nx, ny, pr, 0, Math.PI * 2);
        ctx.strokeStyle = node.pulseColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = node.pulseIntensity * 0.6;
        ctx.shadowColor = node.pulseColor;
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // Node glow
      ctx.shadowColor = node.glow;
      ctx.shadowBlur = 15;
      ctx.fillStyle = node.color + "33";
      this.drawShape(ctx, nx, ny, node.radius, node.shape);
      ctx.fill();

      // Node body
      ctx.shadowBlur = 8;
      ctx.fillStyle = node.color;
      ctx.globalAlpha = 0.85;
      this.drawShape(ctx, nx, ny, node.radius * 0.7, node.shape);
      ctx.fill();

      // Node border
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 1.5;
      this.drawShape(ctx, nx, ny, node.radius, node.shape);
      ctx.stroke();

      // Selection glow ring
      if (node.selected) {
        ctx.beginPath();
        ctx.arc(nx, ny, node.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 20;
        ctx.stroke();
        // Inner bright ring
        ctx.beginPath();
        ctx.arc(nx, ny, node.radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.9;
        ctx.shadowBlur = 12;
        ctx.stroke();
      }

      // Dim unselected nodes when any selection is active
      if (anySelected && !node.selected) {
        ctx.globalAlpha = 0.35;
      }

      ctx.restore();

      // Gravity well visualization
      if (node.isWell) {
        ctx.save();
        const gradient = ctx.createRadialGradient(nx, ny, 0, nx, ny, node.wellRadius);
        gradient.addColorStop(0, node.color + "08");
        gradient.addColorStop(0.5, node.color + "04");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(nx, ny, node.wellRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Label
      ctx.save();
      ctx.fillStyle = NeonTheme.text;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.label, nx, ny + node.radius + 4);
      ctx.restore();
    }

    ctx.restore(); // undo zoom/pan transform

    // --- Render particles (inside graph transform, same as nodes/edges) ---
    this.particleSys.render(ctx);
  }

  /**
   * Draw a shape path (circle, hexagon, diamond, rect).
   */
  private drawShape(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    shape: "circle" | "hexagon" | "diamond" | "rect",
  ): void {
    ctx.beginPath();
    switch (shape) {
      case "circle":
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case "hexagon":
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case "diamond":
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        break;
      case "rect":
        ctx.rect(cx - r, cy - r * 0.7, r * 2, r * 1.4);
        break;
    }
  }

  /** Clear selection on all nodes */
  clearSelection(): void {
    for (const node of this.nodes.values()) {
      node.selected = false;
    }
  }

  /** Toggle selection on a single node */
  toggleSelection(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) node.selected = !node.selected;
  }

  /** Get all selected nodes */
  getSelectedNodes(): GraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.selected);
  }

  /**
   * Run one step of the force-directed simulation.
   */
  private stepForceSimulation(dt: number): void {
    const nodeArr = Array.from(this.nodes.values());
    const n = nodeArr.length;
    if (n === 0) return;

    // Repulsion between all pairs (charge model, inverse square)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodeArr[i];
        const b = nodeArr[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;

        const force = this.repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
        if (!b.pinned) { b.vx += fx; b.vy += fy; }

        // Collision: push apart if overlapping
        const minDist = a.radius + b.radius + 5;
        if (dist < minDist) {
          const overlap = (minDist - dist) * 0.5;
          const pushX = (dx / dist) * overlap;
          const pushY = (dy / dist) * overlap;
          if (!a.pinned) { a.x -= pushX; a.y -= pushY; }
          if (!b.pinned) { b.x += pushX; b.y += pushY; }
        }
      }
    }

    // Spring attraction along edges
    for (const edge of this.edges) {
      const a = this.nodes.get(edge.from);
      const b = this.nodes.get(edge.to);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.1) continue;

      const force = (dist - this.springLength) * this.springStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!a.pinned) { a.vx += fx; a.vy += fy; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
    }

    // Center gravity
    for (const node of nodeArr) {
      if (node.pinned) continue;
      node.vx -= node.x * this.centerGravity;
      node.vy -= node.y * this.centerGravity;
    }

    // Gravity wells: parents attract their children
    for (const node of nodeArr) {
      if (!node.isWell || node.childIds.length === 0) continue;

      for (const childId of node.childIds) {
        const child = this.nodes.get(childId);
        if (!child || child.pinned) continue;

        const dx = node.x - child.x;
        const dy = node.y - child.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.1) continue;

        if (dist < node.wellRadius) {
          // Spring-like: stronger pull when further from ideal orbit distance
          const idealDist = node.wellRadius * 0.5;
          const force = (dist - idealDist) * node.wellStrength;
          child.vx -= (dx / dist) * force;
          child.vy -= (dy / dist) * force;
        } else {
          // Outside well radius: gentle pull back
          const force = node.wellStrength * 0.5;
          child.vx += (dx / dist) * force;
          child.vy += (dy / dist) * force;
        }
      }
    }

    // Apply alpha cooling — simulation settles over time
    this.alpha *= this.alphaDecay;
    if (this.alpha < this.alphaMin) this.alpha = this.alphaMin;

    // Integrate velocity, apply damping + alpha
    for (const node of nodeArr) {
      if (node.pinned) continue;
      node.vx *= this.damping;
      node.vy *= this.damping;
      node.x += node.vx * this.alpha;
      node.y += node.vy * this.alpha;
    }
  }

  /** Toggle simulation pause/resume */
  toggleSimulation(): void {
    this.simulationActive = !this.simulationActive;
    if (this.simulationActive) this.reheat(0.5);
  }

  /** Check if simulation is active */
  isSimulationActive(): boolean {
    return this.simulationActive;
  }

  /** Apply zoom centered on a screen point */
  applyZoom(delta: number, canvasX: number, canvasY: number): void {
    const oldZoom = this.zoom;
    const factor = delta > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, this.zoom * factor));

    // Zoom toward cursor: adjust offsets so point under cursor stays fixed
    const wp = this.worldPosition();
    const cx = canvasX - wp.x;
    const cy = canvasY - wp.y;
    this.offsetX = cx - (cx - this.offsetX) * (this.zoom / oldZoom);
    this.offsetY = cy - (cy - this.offsetY) * (this.zoom / oldZoom);
  }

  /** Fit all nodes into view */
  fitToView(): void {
    const nodes = Array.from(this.nodes.values());
    if (nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }

    const graphW = maxX - minX + 80;
    const graphH = maxY - minY + 80;
    const scaleX = this.size.x / graphW;
    const scaleY = this.size.y / graphH;
    this.zoom = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, Math.min(scaleX, scaleY)));

    const graphCenterX = (minX + maxX) / 2;
    const graphCenterY = (minY + maxY) / 2;
    this.offsetX = this.size.x / 2 - graphCenterX * this.zoom;
    this.offsetY = this.size.y / 2 - graphCenterY * this.zoom;
  }

  /** Select all nodes */
  selectAll(): void {
    for (const node of this.nodes.values()) {
      node.selected = true;
    }
  }

  /** Reset all positions, clear localStorage, reheat */
  resetPositions(): void {
    this.clearPositions();
    for (const node of this.nodes.values()) {
      node.pinned = false;
      node.x = Math.random() * 400 - 200;
      node.y = Math.random() * 400 - 200;
      node.vx = 0;
      node.vy = 0;
    }
    this.offsetX = 0;
    this.offsetY = 0;
    this.zoom = 1.0;
    this.reheat(1.0);
  }

  /**
   * Register an async callback for dynamic drill-down.
   * When a node is expanded, this callback fetches children from any source.
   * Return GraphNodeOptions[] for children, or null to cancel expand.
   *
   * @example
   * graph.onExpand(async (nodeId, node) => {
   *   const resp = await fetch(\`/api/node/\${nodeId}/children\`);
   *   return resp.json();
   * });
   */
  onExpand(callback: (nodeId: string, node: GraphNode) => Promise<GraphNodeOptions[]> | GraphNodeOptions[] | null) {
    this.expandCallback = callback;
  }

  /**
   * Expand a node — uses async callback if registered, otherwise uses provided children.
   * Call with children for static expand, or without for dynamic (callback-driven).
   */
  async expandAsync(nodeId: string, children?: GraphNodeOptions[]): Promise<void> {
    const parent = this.nodes.get(nodeId);
    if (!parent) return;

    // If already expanded, collapse instead (toggle)
    if (parent.childIds.length > 0) {
      this.collapse(nodeId);
      return;
    }

    // Get children: from argument, callback, or nothing
    let childData = children;
    if (!childData && this.expandCallback) {
      const result = this.expandCallback(nodeId, parent);
      if (result instanceof Promise) {
        childData = await result ?? undefined;
      } else {
        childData = result ?? undefined;
      }
    }

    if (!childData || childData.length === 0) return;

    // Use the existing expand method
    this.expand(nodeId, childData);
  }

  /** Reheat the simulation (e.g., after adding nodes or pulsing) */
  reheat(alpha = 0.3) {
    this.alpha = Math.max(this.alpha, alpha);
  }

  /** Save all node positions to localStorage */
  savePositions(key = "area42-graph-positions") {
    const positions: Record<string, { x: number; y: number; pinned: boolean }> = {};
    for (const [id, node] of this.nodes) {
      positions[id] = { x: node.x, y: node.y, pinned: node.pinned };
    }
    try {
      localStorage.setItem(key, JSON.stringify(positions));
    } catch {}
  }

  /** Load node positions from localStorage */
  loadPositions(key = "area42-graph-positions"): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const positions = JSON.parse(raw) as Record<string, { x: number; y: number; pinned: boolean }>;
      let loaded = 0;
      for (const [id, pos] of Object.entries(positions)) {
        const node = this.nodes.get(id);
        if (node) {
          node.x = pos.x;
          node.y = pos.y;
          if (pos.pinned) node.pinned = true;
          loaded++;
        }
      }
      if (loaded > 0) {
        // Disable simulation since we have saved positions
        this.alpha = this.alphaMin;
      }
      return loaded > 0;
    } catch {
      return false;
    }
  }

  /** Clear saved positions */
  clearPositions(key = "area42-graph-positions") {
    try { localStorage.removeItem(key); } catch {}
  }

  /**
   * Find graph edge at canvas coordinates (accounts for pan/zoom).
   * Uses point-to-bezier-curve distance with sampling.
   * @param threshold - Max pixel distance to count as a hit (default 8)
   */
  findEdgeAt(canvasX: number, canvasY: number, threshold = 8): GraphEdge | null {
    const wp = this.worldPosition();
    const localX = (canvasX - wp.x - this.offsetX) / this.zoom - this.centerX;
    const localY = (canvasY - wp.y - this.offsetY) / this.zoom - this.centerY;

    let closestEdge: GraphEdge | null = null;
    let closestDist = threshold;

    for (const edge of this.edges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      // Compute the same control point as the render method
      const mx = (fromNode.x + toNode.x) / 2;
      const my = (fromNode.y + toNode.y) / 2;
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const cx = mx - dy * 0.05;
      const cy = my + dx * 0.05;

      // Sample 20 points along the quadratic bezier
      const SAMPLES = 20;
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const it = 1 - t;
        // Quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * CP + t^2 * P1
        const bx = it * it * fromNode.x + 2 * it * t * cx + t * t * toNode.x;
        const by = it * it * fromNode.y + 2 * it * t * cy + t * t * toNode.y;

        const sdx = localX - bx;
        const sdy = localY - by;
        const dist = Math.sqrt(sdx * sdx + sdy * sdy);

        if (dist < closestDist) {
          closestDist = dist;
          closestEdge = edge;
        }
      }
    }

    return closestEdge;
  }

  /** Find graph node at canvas coordinates (accounts for pan/zoom) */
  findNodeAt(canvasX: number, canvasY: number): GraphNode | null {
    const wp = this.worldPosition();
    // Convert canvas coords to graph-local coords accounting for pan/zoom
    const localX = (canvasX - wp.x - this.offsetX) / this.zoom - this.centerX;
    const localY = (canvasY - wp.y - this.offsetY) / this.zoom - this.centerY;
    // Check in reverse order (front to back)
    const nodes = Array.from(this.nodes.values()).reverse();
    for (const node of nodes) {
      const dx = localX - node.x;
      const dy = localY - node.y;
      const r = (node.radius ?? 20) + 5; // slight padding for easier clicking
      if (dx * dx + dy * dy < r * r) return node;
    }
    return null;
  }

  /** Start dragging a node — pins it and reheats simulation */
  startNodeDrag(node: GraphNode) {
    node.pinned = true;
    this.reheat(0.3);
  }

  /** Grid snap size for nodes (0 = disabled) */
  gridSnap = 20;

  /** Move a dragged node to canvas coordinates, with optional grid snap */
  dragNode(node: GraphNode, canvasX: number, canvasY: number) {
    const wp = this.worldPosition();
    let x = (canvasX - wp.x - this.offsetX) / this.zoom - this.centerX;
    let y = (canvasY - wp.y - this.offsetY) / this.zoom - this.centerY;

    // Magnetic grid snap
    if (this.gridSnap > 0) {
      const snapX = Math.round(x / this.gridSnap) * this.gridSnap;
      const snapY = Math.round(y / this.gridSnap) * this.gridSnap;
      // Only snap if close enough (within half grid size)
      if (Math.abs(x - snapX) < this.gridSnap * 0.4) x = snapX;
      if (Math.abs(y - snapY) < this.gridSnap * 0.4) y = snapY;
    }

    node.x = x;
    node.y = y;
  }

  /** End dragging — node stays pinned where placed, auto-save */
  endNodeDrag(node: GraphNode) {
    node.pinned = true;  // Stay where the user put you
    node.vx = 0;
    node.vy = 0;
    this.reheat(0.1);  // Gentle reheat so unpinned nodes settle around
    this.savePositions();
  }

  /**
   * Arrange nodes in a radial layout around the center.
   */
  private applyRadialLayout(): void {
    const nodeArr = Array.from(this.nodes.values());
    const n = nodeArr.length;
    const radius = Math.min(this.size.x, this.size.y) * 0.3;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n;
      nodeArr[i].x = Math.cos(angle) * radius;
      nodeArr[i].y = Math.sin(angle) * radius;
      nodeArr[i].vx = 0;
      nodeArr[i].vy = 0;
    }
  }

  /**
   * Arrange nodes in a simple top-down tree layout.
   * Root nodes (no incoming edges) are placed at the top.
   */
  private applyTreeLayout(): void {
    const nodeArr = Array.from(this.nodes.values());
    const incoming = new Set<string>();
    for (const e of this.edges) incoming.add(e.to);

    const roots = nodeArr.filter((n) => !incoming.has(n.id));
    if (roots.length === 0 && nodeArr.length > 0) {
      roots.push(nodeArr[0]);
    }

    const visited = new Set<string>();
    const layers: GraphNode[][] = [];
    let current = roots;

    while (current.length > 0) {
      layers.push(current);
      for (const n of current) visited.add(n.id);
      const next: GraphNode[] = [];
      for (const n of current) {
        for (const e of this.edges) {
          if (e.from === n.id && !visited.has(e.to)) {
            const child = this.nodes.get(e.to);
            if (child) next.push(child);
          }
        }
      }
      current = next;
    }

    const layerHeight = 80;
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const layerWidth = layer.length * 80;
      for (let ni = 0; ni < layer.length; ni++) {
        layer[ni].x = -layerWidth / 2 + ni * 80 + 40;
        layer[ni].y = -((layers.length - 1) * layerHeight) / 2 + li * layerHeight;
        layer[ni].vx = 0;
        layer[ni].vy = 0;
      }
    }
  }
}
