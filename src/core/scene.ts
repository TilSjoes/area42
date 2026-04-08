/**
 * Area42 Scene Graph — v2 Container Architecture
 *
 * Every visual element is a Container. Containers hold Containers.
 * The screen is the root Container.
 *
 * v2.0 (Session 1): overflow, contentOffset, clipping, coordinate transforms
 * v2.1 (Session 2): layout (vertical/horizontal/grid), style inheritance
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
   * Children render at (contentOffset.x, contentOffset.y) within this container.
   */
  contentOffset: Vec2 = { x: 0, y: 0 };

  /**
   * v2: content size available for children (after padding/header).
   * If null, defaults to full size minus contentOffset.
   * Used for clip rect calculation when overflow is "hidden".
   */
  contentSize: Vec2 | null = null;

  // --- v2.1: Layout ---

  /** Layout algorithm for children. "none" = manual positioning (default). */
  childLayout: ChildLayoutType = "none";

  /** Gap between children when using layout */
  gap: number = 0;

  /** Padding inside the container for layout */
  padding: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

  /** If true, this child opts out of parent layout (positioned manually) */
  layoutManual: boolean = false;

  // --- v2.1: Style ---

  /** Partial style overrides — unset fields inherit from parent */
  style?: PartialStyle;

  /** Cache: resolved style (invalidated on parent change) */
  private _resolvedStyle: Style | null = null;
  private _styleGeneration = 0;
  private static _globalStyleGen = 0;

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

  /** Remove all children */
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

    // v2.1: Apply layout to children before they update
    if (this.childLayout !== "none" && this.children.length > 0) {
      const cs = this.getContentDimensions();
      applyLayout(this.childLayout, this.children, cs.w, cs.h, this.gap, this.padding);
    }

    for (const child of this.children) {
      child.update(dt);
    }
  }

  // --- v2.1: Style resolution ---

  /** Get the fully resolved style for this container (inherits from parents) */
  resolvedStyle(): Style {
    if (this._resolvedStyle && this._styleGeneration === SceneNode._globalStyleGen) {
      return this._resolvedStyle;
    }
    this._resolvedStyle = getResolvedStyle(this);
    this._styleGeneration = SceneNode._globalStyleGen;
    return this._resolvedStyle;
  }

  /** Invalidate style cache (call when changing style) */
  invalidateStyle() {
    SceneNode._globalStyleGen++;
  }

  // --- v2: Coordinate Transforms ---

  /** Convert a point from this container's local space to world space */
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

  /** Convert a point from world space to this container's local space */
  worldToLocal(point: Vec2): Vec2 {
    const wp = this.localToWorld({ x: 0, y: 0 });
    return { x: point.x - wp.x, y: point.y - wp.y };
  }

  /** World position (accumulated from parent chain) — backward compatible */
  worldPosition(): Vec2 {
    return this.localToWorld({ x: 0, y: 0 });
  }

  // --- v2: Bounds ---

  /** Local bounds of this container */
  getLocalBounds(): Rect {
    return { x: 0, y: 0, w: this.size.x, h: this.size.y };
  }

  /** World bounds of this container */
  getWorldBounds(): Rect {
    const wp = this.worldPosition();
    return { x: wp.x, y: wp.y, w: this.size.x, h: this.size.y };
  }

  /**
   * v2.1: Get the content dimensions (width/height available for children).
   * Accounts for contentOffset and contentSize.
   */
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
   * v2: Get the content clip rect in local coordinates.
   * This is the area where children are allowed to render.
   * Returns null if overflow is "visible" (no clipping).
   */
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

  /** Hit test — backward compatible */
  contains(point: Vec2): boolean {
    const wp = this.worldPosition();
    return point.x >= wp.x && point.x <= wp.x + this.size.x &&
           point.y >= wp.y && point.y <= wp.y + this.size.y;
  }

  /**
   * v2: Check if a world-space point is inside this container's
   * clipped content area (respects parent clipping chain).
   */
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

  /**
   * v2: Render with automatic clipping and content offset.
   *
   * For each container:
   *   1. save(), translate to position
   *   2. render self (background, chrome, etc.)
   *   3. if overflow=hidden: clip to content area
   *   4. translate by contentOffset
   *   5. render children (they draw in content-local space)
   *   6. restore()
   */
  private renderNode(ctx: CanvasRenderingContext2D, node: SceneNode) {
    if (!node.visible) return;

    ctx.save();
    ctx.globalAlpha *= node.opacity;
    ctx.translate(node.position.x, node.position.y);

    // 1. Render self (panel chrome, graph background, etc.)
    node.render(ctx);

    // 2. Set up clipping + content offset for children
    if (node.children.length > 0) {
      ctx.save();

      if (node.overflow === "hidden") {
        const clip = node.getContentClipRect()!;
        ctx.beginPath();
        ctx.rect(clip.x, clip.y, clip.w, clip.h);
        ctx.clip();
      }

      // Translate to content area origin
      ctx.translate(node.contentOffset.x, node.contentOffset.y);

      // 3. Render children (clipped if parent clips)
      for (const child of node.children) {
        this.renderNode(ctx, child);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * v2: Hit testing respects clipping.
   *
   * Walk tree front-to-back (last child first).
   * Transform points through the hierarchy.
   * Skip subtrees that are clipped out.
   */
  findAt(point: Vec2): SceneNode | null {
    return this.findAtNode(this.root, point, point.x, point.y);
  }

  private findAtNode(node: SceneNode, worldPoint: Vec2, localX: number, localY: number): SceneNode | null {
    if (!node.visible || !node.interactive) return null;

    // Transform to this node's local space
    const nx = localX - node.position.x;
    const ny = localY - node.position.y;

    // If this node clips, check if point is inside content area
    if (node.overflow === "hidden" && node.children.length > 0) {
      const clip = node.getContentClipRect()!;
      const inContent = nx >= clip.x && nx <= clip.x + clip.w &&
                        ny >= clip.y && ny <= clip.y + clip.h;
      if (!inContent) {
        // Point outside clipped area — still check if it hits this node itself
        // (e.g., panel header is outside the content clip area)
        const inBounds = nx >= 0 && nx <= node.size.x && ny >= 0 && ny <= node.size.y;
        if (inBounds && node !== this.root) return node;
        return null;
      }
    }

    // Check children first (front = last in array)
    const childLocalX = nx - node.contentOffset.x;
    const childLocalY = ny - node.contentOffset.y;
    for (let i = node.children.length - 1; i >= 0; i--) {
      const found = this.findAtNode(node.children[i], worldPoint, childLocalX, childLocalY);
      if (found) return found;
    }

    // Check self
    const inBounds = nx >= 0 && nx <= node.size.x && ny >= 0 && ny <= node.size.y;
    if (inBounds && node !== this.root) return node;

    return null;
  }
}
