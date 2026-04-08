/**
 * Area42 Scene Graph
 *
 * Hierarchical node tree. Each node has transform, children, and render method.
 * Supports: panels, graph nodes, edges, particles, text, charts.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Transform {
  position: Vec2;
  scale: Vec2;
  rotation: number;
  opacity: number;
}

export interface SceneNodeOptions {
  id?: string;
  position?: Vec2;
  size?: Vec2;
  opacity?: number;
  visible?: boolean;
  interactive?: boolean;
}

let nextId = 0;

export class SceneNode {
  id: string;
  position: Vec2;
  size: Vec2;
  opacity: number;
  visible: boolean;
  interactive: boolean;
  children: SceneNode[] = [];
  parent: SceneNode | null = null;

  // Animation state
  targetPosition: Vec2 | null = null;
  targetOpacity: number | null = null;
  animSpeed = 0.08;

  constructor(options: SceneNodeOptions = {}) {
    this.id = options.id || `node-${nextId++}`;
    this.position = options.position || { x: 0, y: 0 };
    this.size = options.size || { x: 100, y: 50 };
    this.opacity = options.opacity ?? 1;
    this.visible = options.visible ?? true;
    this.interactive = options.interactive ?? true;
  }

  add(child: SceneNode) {
    child.parent = this;
    this.children.push(child);
    return this;
  }

  remove(child: SceneNode) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parent = null;
    }
    return this;
  }

  find(id: string): SceneNode | null {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.find(id);
      if (found) return found;
    }
    return null;
  }

  /** Animate toward target position/opacity */
  update(dt: number) {
    if (this.targetPosition) {
      this.position.x += (this.targetPosition.x - this.position.x) * this.animSpeed;
      this.position.y += (this.targetPosition.y - this.position.y) * this.animSpeed;
      if (Math.abs(this.position.x - this.targetPosition.x) < 0.5 &&
          Math.abs(this.position.y - this.targetPosition.y) < 0.5) {
        this.position = { ...this.targetPosition };
        this.targetPosition = null;
      }
    }
    if (this.targetOpacity !== null) {
      this.opacity += (this.targetOpacity - this.opacity) * this.animSpeed;
      if (Math.abs(this.opacity - this.targetOpacity) < 0.01) {
        this.opacity = this.targetOpacity;
        this.targetOpacity = null;
      }
    }
    for (const child of this.children) {
      child.update(dt);
    }
  }

  /** World position (accumulated from parent chain) */
  worldPosition(): Vec2 {
    let x = this.position.x;
    let y = this.position.y;
    let p = this.parent;
    while (p) {
      x += p.position.x;
      y += p.position.y;
      p = p.parent;
    }
    return { x, y };
  }

  /** Hit test */
  contains(point: Vec2): boolean {
    const wp = this.worldPosition();
    return point.x >= wp.x && point.x <= wp.x + this.size.x &&
           point.y >= wp.y && point.y <= wp.y + this.size.y;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Override in subclasses
  }
}

export class Scene {
  root: SceneNode = new SceneNode({ id: "root" });

  update(dt: number) {
    this.root.update(dt);
  }

  render(ctx: CanvasRenderingContext2D) {
    this.renderNode(ctx, this.root);
  }

  private renderNode(ctx: CanvasRenderingContext2D, node: SceneNode) {
    if (!node.visible) return;
    ctx.save();
    ctx.globalAlpha *= node.opacity;
    ctx.translate(node.position.x, node.position.y);
    node.render(ctx);
    for (const child of node.children) {
      this.renderNode(ctx, child);
    }
    ctx.restore();
  }

  findAt(point: Vec2): SceneNode | null {
    return this.findAtNode(this.root, point);
  }

  private findAtNode(node: SceneNode, point: Vec2): SceneNode | null {
    if (!node.visible || !node.interactive) return null;
    // Check children first (front to back)
    for (let i = node.children.length - 1; i >= 0; i--) {
      const found = this.findAtNode(node.children[i], point);
      if (found) return found;
    }
    if (node.contains(point) && node !== this.root) return node;
    return null;
  }
}
