/**
 * Area42 Scene Graph — v2 Container Architecture
 *
 * Every visual element is a Container. Containers hold Containers.
 * The screen is the root Container.
 *
 * v2.0 (Session 1): overflow, contentOffset, clipping, coordinate transforms
 * v2.1 (Session 2): layout (vertical/horizontal/grid), style inheritance
 * v2.2 (Session 6): pointer event interface, HitResult, unified event dispatch
 */

import { applyLayout, type LayoutType as ChildLayoutType, type Insets } from "./layout.js";
import { type PartialStyle, type Style, getResolvedStyle } from "./style.js";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Transform {
  position: Vec2;
  scale: Vec2;
  rotation: number;
  opacity: number;
}

export type Overflow = "visible" | "hidden";

/** v2.2: Result of a hit test — includes the hit node and the point in its local space */
export interface HitResult {
  node: SceneNode;
  localPoint: Vec2;
}

export interface SceneNodeOptions {
  id?: string;
  position?: Vec2;
  size?: Vec2;
  opacity?: number;
  visible?: boolean;
  interactive?: boolean;
  overflow?: Overflow;
  childLayout?: ChildLayoutType;
  gap?: number;
  padding?: Insets;
  style?: PartialStyle;
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

  /** v2: overflow clipping — "hidden" clips children to this container's bounds */
  overflow: Overflow;

  /**
   * v2: offset applied to children's coordinate system.
   * Used by Panel to push children below the header bar.
   */
  contentOffset: Vec2 = { x: 0, y: 0 };

  /**
   * v2: content size available for children (after padding/header).
   * If null, defaults to full size minus contentOffset.
   */
  contentSize: Vec2 | null = null;

  // --- v2.1: Layout ---
  childLayout: ChildLayoutType = "none";
  gap: number = 0;
  padding: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  layoutManual: boolean = false;

  // --- v2.1: Style ---
  style?: PartialStyle;
  private _resolvedStyle: Style | null = null;
  private _styleGeneration = 0;
  private static _globalStyleGen = 0;

  // Animation state
  targetPosition: Vec2 | null = null;
  targetOpacity: number | null = null;
  animSpeed = 0.08;

  // --- v2.2: Pointer event cursor hint ---
  /** Cursor to show when this node is hovered (default: null = inherit) */
  cursor: string | null = null;

  constructor(options: SceneNodeOptions = {}) {
    this.id = options.id || `node-${nextId++}`;
    this.position = options.position || { x: 0, y: 0 };
    this.size = options.size || { x: 100, y: 50 };
    this.opacity = options.opacity ?? 1;
    this.visible = options.visible ?? true;
    this.interactive = options.interactive ?? true;
    this.overflow = options.overflow ?? "visible";
    this.childLayout = options.childLayout ?? "none";
    this.gap = options.gap ?? 0;
    this.padding = options.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    this.style = options.style;
  }

  add(child: SceneNode) {
    child.parent = this;
    this.children.push(child);
    SceneNode._globalStyleGen++;
    return this;
  }

  remove(child: SceneNode) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parent = null;
      SceneNode._globalStyleGen++;
    }
    return this;
  }

  clear() {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children = [];
    SceneNode._globalStyleGen++;
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

  /** Walk up the tree to find the nearest ancestor of a given type */
  closest<T extends SceneNode>(type: new (...args: any[]) => T): T | null {
    let node: SceneNode | null = this.parent;
    while (node) {
      if (node instanceof type) return node;
      node = node.parent;
    }
    return null;
  }

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

    if (this.childLayout !== "none" && this.children.length > 0) {
      const cs = this.getContentDimensions();
      applyLayout(this.childLayout, this.children, cs.w, cs.h, this.gap, this.padding);
    }

    for (const child of this.children) {
      child.update(dt);
    }
  }

  // --- v2.2: Pointer Event Handlers (override in subclasses) ---

  /**
   * Called when this node receives a pointer down event.
   * @param localPoint - Point in this node's local coordinate space
   * @param e - Original mouse event
   * @returns true if the event was consumed (stops propagation)
   */
  onPointerDown?(localPoint: Vec2, e: MouseEvent): boolean;

  /**
   * Called on the active node during drag (after onPointerDown returned true).
   * @param worldPoint - Point in world/canvas space (for drag tracking)
   * @param e - Original mouse event
   */
  onPointerMove?(worldPoint: Vec2, e: MouseEvent): void;

  /**
   * Called on the active node when the mouse button is released.
   * @param worldPoint - Point in world/canvas space
   * @param e - Original mouse event
   */
  onPointerUp?(worldPoint: Vec2, e: MouseEvent): void;

  /** Called when the pointer enters this node's bounds */
  onPointerEnter?(): void;

  /** Called when the pointer leaves this node's bounds */
  onPointerLeave?(): void;

  /**
   * Called when the scroll wheel is used over this node.
   * @returns true if consumed
   */
  onWheel?(delta: number, localPoint: Vec2): boolean;

  /**
   * Called on double-click.
   * @returns true if consumed
   */
  onDoubleClick?(localPoint: Vec2): boolean;

  /**
   * Called on right-click. Return context menu items or null.
   */
  onContextMenu?(localPoint: Vec2): Array<{ label: string; action: () => void }> | null;

  // --- Style resolution ---

  resolvedStyle(): Style {
    if (this._resolvedStyle && this._styleGeneration === SceneNode._globalStyleGen) {
      return this._resolvedStyle;
    }
    this._resolvedStyle = getResolvedStyle(this);
    this._styleGeneration = SceneNode._globalStyleGen;
    return this._resolvedStyle;
  }

  invalidateStyle() {
    SceneNode._globalStyleGen++;
  }

  // --- Coordinate Transforms ---

  localToWorld(point: Vec2): Vec2 {
    let x = point.x + this.position.x;
    let y = point.y + this.position.y;
    let p = this.parent;
    while (p) {
      x += p.contentOffset.x + p.position.x;
      y += p.contentOffset.y + p.position.y;
      p = p.parent;
    }
    return { x, y };
  }

  worldToLocal(point: Vec2): Vec2 {
    const wp = this.localToWorld({ x: 0, y: 0 });
    return { x: point.x - wp.x, y: point.y - wp.y };
  }

  worldPosition(): Vec2 {
    return this.localToWorld({ x: 0, y: 0 });
  }

  // --- Bounds ---

  getLocalBounds(): Rect {
    return { x: 0, y: 0, w: this.size.x, h: this.size.y };
  }

  getWorldBounds(): Rect {
    const wp = this.worldPosition();
    return { x: wp.x, y: wp.y, w: this.size.x, h: this.size.y };
  }

  getContentDimensions(): { w: number; h: number } {
    if (this.contentSize) {
      return { w: this.contentSize.x, h: this.contentSize.y };
    }
    return {
      w: this.size.x - this.contentOffset.x,
      h: this.size.y - this.contentOffset.y,
    };
  }

  /**
   * Measure children and resize this node to fit them.
   * For vertical/horizontal layouts: sums child sizes + gaps + padding.
   * For grid: computes rows needed.
   * Only adjusts the layout axis (height for vertical, width for horizontal).
   * Call after children are added but before first render.
   */
  fitContent(): void {
    const managed = this.children.filter(c => c.visible && !c.layoutManual);
    if (managed.length === 0) return;

    const pad = this.padding;

    if (this.childLayout === "vertical") {
      let totalH = pad.top + pad.bottom;
      for (const child of managed) {
        totalH += child.size.y;
      }
      totalH += Math.max(0, managed.length - 1) * this.gap;
      this.size.y = this.contentOffset.y + totalH;
    } else if (this.childLayout === "horizontal") {
      let totalW = pad.left + pad.right;
      for (const child of managed) {
        totalW += child.size.x;
      }
      totalW += Math.max(0, managed.length - 1) * this.gap;
      this.size.x = this.contentOffset.x + totalW;
    } else if (this.childLayout === "grid") {
      if (managed.length === 0) return;
      const childW = managed[0].size.x;
      const innerW = this.size.x - pad.left - pad.right - this.contentOffset.x;
      const cols = Math.max(1, Math.floor((innerW + this.gap) / (childW + this.gap)));
      const rows = Math.ceil(managed.length / cols);
      const rowH = managed[0].size.y;
      const totalH = pad.top + pad.bottom + rows * rowH + Math.max(0, rows - 1) * this.gap;
      this.size.y = this.contentOffset.y + totalH;
    }
  }

  getContentClipRect(): Rect | null {
    if (this.overflow !== "hidden") return null;
    const cs = this.contentSize;
    return {
      x: this.contentOffset.x,
      y: this.contentOffset.y,
      w: cs ? cs.x : this.size.x - this.contentOffset.x,
      h: cs ? cs.y : this.size.y - this.contentOffset.y,
    };
  }

  contains(point: Vec2): boolean {
    const wp = this.worldPosition();
    return point.x >= wp.x && point.x <= wp.x + this.size.x &&
           point.y >= wp.y && point.y <= wp.y + this.size.y;
  }

  isPointInClipChain(worldPoint: Vec2): boolean {
    let node: SceneNode | null = this;
    while (node) {
      if (node.overflow === "hidden") {
        const wp = node.worldPosition();
        const clip = node.getContentClipRect()!;
        const cx = wp.x + clip.x;
        const cy = wp.y + clip.y;
        if (worldPoint.x < cx || worldPoint.x > cx + clip.w ||
            worldPoint.y < cy || worldPoint.y > cy + clip.h) {
          return false;
        }
      }
      node = node.parent;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Override in subclasses
  }
}

/** v2: Container is the new name for SceneNode */
export { SceneNode as Container };

// --- Scene ---

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

    if (node.children.length > 0) {
      ctx.save();

      if (node.overflow === "hidden") {
        const clip = node.getContentClipRect()!;
        ctx.beginPath();
        ctx.rect(clip.x, clip.y, clip.w, clip.h);
        ctx.clip();
      }

      ctx.translate(node.contentOffset.x, node.contentOffset.y);

      for (const child of node.children) {
        this.renderNode(ctx, child);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * v2.2: Hit testing returns HitResult with local point.
   * Walk tree front-to-back (last child first), respects clipping.
   */
  findAt(point: Vec2): HitResult | null {
    return this.findAtNode(this.root, point.x, point.y);
  }

  private findAtNode(node: SceneNode, localX: number, localY: number): HitResult | null {
    if (!node.visible || !node.interactive) return null;

    const nx = localX - node.position.x;
    const ny = localY - node.position.y;

    // Clipping check
    if (node.overflow === "hidden" && node.children.length > 0) {
      const clip = node.getContentClipRect()!;
      const inContent = nx >= clip.x && nx <= clip.x + clip.w &&
                        ny >= clip.y && ny <= clip.y + clip.h;
      if (!inContent) {
        const inBounds = nx >= 0 && nx <= node.size.x && ny >= 0 && ny <= node.size.y;
        if (inBounds && node !== this.root) {
          return { node, localPoint: { x: nx, y: ny } };
        }
        return null;
      }
    }

    // Children first (front = last in array)
    const childLocalX = nx - node.contentOffset.x;
    const childLocalY = ny - node.contentOffset.y;
    for (let i = node.children.length - 1; i >= 0; i--) {
      const found = this.findAtNode(node.children[i], childLocalX, childLocalY);
      if (found) return found;
    }

    // Self
    const inBounds = nx >= 0 && nx <= node.size.x && ny >= 0 && ny <= node.size.y;
    if (inBounds && node !== this.root) {
      return { node, localPoint: { x: nx, y: ny } };
    }

    return null;
  }
}
