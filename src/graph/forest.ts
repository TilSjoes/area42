/**
 * Area42 Forest — 2.5D Perspective Multi-Tree View
 *
 * Renders multiple interconnected trees in a corridor perspective.
 * The front tree is full-size and interactive; back trees recede
 * with scaling, opacity fade, and Y-offset toward a vanishing point.
 * Cross-tree links render as bezier curves across depth layers.
 */

import { SceneNode } from "../core/scene.js";
import { Tree } from "./tree.js";
import type { TreeNodeData } from "./tree.js";
import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

// ============================================================================
// Interfaces
// ============================================================================

export interface ForestTree {
  id: string;
  label: string;
  color?: string;
  root: TreeNodeData;
}

export interface ForestLink {
  fromTree: string;
  fromNode: string;
  toTree: string;
  toNode: string;
  label?: string;
  color?: string;
  style?: "solid" | "dashed" | "dotted";
}

export interface PerspectiveOptions {
  vanishingPointY?: number;
  depthScale?: number;
  depthSpacing?: number;
  depthFade?: number;
  horizontalSpread?: number;
}

export interface ForestOptions {
  direction?: "perspective" | "side-by-side" | "stacked";
  perspective?: PerspectiveOptions;
  treeSpacing?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

// ============================================================================
// Animation state per tree slot
// ============================================================================

interface TreeSlot {
  tree: ForestTree;
  treeComponent: Tree;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  targetX: number;
  targetY: number;
  targetScale: number;
  targetOpacity: number;
}

// ============================================================================
// Forest
// ============================================================================

export class Forest extends SceneNode {
  trees: ForestTree[] = [];
  links: ForestLink[] = [];
  focusIndex = 0;

  private direction: "perspective" | "side-by-side" | "stacked";
  private perspective: Required<PerspectiveOptions>;
  private treeSpacing: number;
  private canvasWidth: number;
  private canvasHeight: number;

  private slots: TreeSlot[] = [];
  private animating = false;

  // Touch tracking
  private touchStartX = 0;

  constructor(options: ForestOptions = {}) {
    super();
    this.direction = options.direction ?? "perspective";
    this.perspective = {
      vanishingPointY: options.perspective?.vanishingPointY ?? 0.25,
      depthScale: options.perspective?.depthScale ?? 0.72,
      depthSpacing: options.perspective?.depthSpacing ?? 90,
      depthFade: options.perspective?.depthFade ?? 0.18,
      horizontalSpread: options.perspective?.horizontalSpread ?? 30,
    };
    this.treeSpacing = options.treeSpacing ?? 40;
    this.canvasWidth = options.canvasWidth ?? 1200;
    this.canvasHeight = options.canvasHeight ?? 700;
  }

  setCanvasSize(w: number, h: number): void {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.recalcSlots(false);
  }

  // --------------------------------------------------------------------------
  // Data management
  // --------------------------------------------------------------------------

  addTree(tree: ForestTree): void {
    this.trees.push(tree);
    const tc = new Tree({
      direction: "top-down",
      nodeWidth: 110,
      nodeHeight: 32,
      nodeSpacing: 14,
      levelSpacing: 60,
    });
    tc.setData(tree.root);
    this.slots.push({
      tree,
      treeComponent: tc,
      x: 0, y: 0, scale: 1, opacity: 1,
      targetX: 0, targetY: 0, targetScale: 1, targetOpacity: 1,
    });
    this.recalcSlots(false);
  }

  addLink(link: ForestLink): void {
    this.links.push(link);
  }

  // --------------------------------------------------------------------------
  // Navigation
  // --------------------------------------------------------------------------

  focusTree(treeId: string): void {
    const idx = this.trees.findIndex(t => t.id === treeId);
    if (idx >= 0 && idx !== this.focusIndex) {
      this.focusIndex = idx;
      this.recalcSlots(true);
    }
  }

  nextTree(): void {
    if (this.trees.length < 2) return;
    this.focusIndex = (this.focusIndex + 1) % this.trees.length;
    this.recalcSlots(true);
  }

  prevTree(): void {
    if (this.trees.length < 2) return;
    this.focusIndex = (this.focusIndex - 1 + this.trees.length) % this.trees.length;
    this.recalcSlots(true);
  }

  // --------------------------------------------------------------------------
  // Hit testing
  // --------------------------------------------------------------------------

  findAt(x: number, y: number): { tree: ForestTree; node: TreeNodeData } | null {
    if (this.slots.length === 0) return null;

    // Check from front to back
    const ordered = this.getSlotsBackToFront();
    for (let i = ordered.length - 1; i >= 0; i--) {
      const slot = ordered[i];
      const localX = (x - slot.x) / slot.scale;
      const localY = (y - slot.y) / slot.scale;
      const found = slot.treeComponent.findNodeAt(localX, localY);
      if (found) {
        return { tree: slot.tree, node: found };
      }
    }
    return null;
  }

  /** Find which tree was clicked (for focus switching) */
  findTreeAt(x: number, y: number): ForestTree | null {
    const ordered = this.getSlotsBackToFront();
    for (let i = ordered.length - 1; i >= 0; i--) {
      const slot = ordered[i];
      const lx = (x - slot.x) / slot.scale;
      const ly = (y - slot.y) / slot.scale;
      if (slot.treeComponent.findNodeAt(lx, ly)) {
        return slot.tree;
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Touch support
  // --------------------------------------------------------------------------

  handleTouchStart(x: number): void {
    this.touchStartX = x;
  }

  handleTouchEnd(x: number): void {
    const dx = x - this.touchStartX;
    if (Math.abs(dx) > 60) {
      if (dx > 0) this.prevTree();
      else this.nextTree();
    }
  }

  // --------------------------------------------------------------------------
  // Update (animation)
  // --------------------------------------------------------------------------

  update(dt: number): void {
    super.update(dt);
    const speed = 0.06;
    let stillAnimating = false;
    for (const slot of this.slots) {
      slot.x += (slot.targetX - slot.x) * speed;
      slot.y += (slot.targetY - slot.y) * speed;
      slot.scale += (slot.targetScale - slot.scale) * speed;
      slot.opacity += (slot.targetOpacity - slot.opacity) * speed;
      if (
        Math.abs(slot.x - slot.targetX) > 0.5 ||
        Math.abs(slot.y - slot.targetY) > 0.5 ||
        Math.abs(slot.scale - slot.targetScale) > 0.001 ||
        Math.abs(slot.opacity - slot.targetOpacity) > 0.005
      ) {
        stillAnimating = true;
      }
    }
    this.animating = stillAnimating;
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    if (this.slots.length === 0) return;

    if (this.direction === "perspective") {
      this.renderPerspective(ctx);
    } else if (this.direction === "side-by-side") {
      this.renderFlat(ctx);
    } else {
      this.renderFlat(ctx);
    }
  }

  private renderPerspective(ctx: CanvasRenderingContext2D): void {
    const ordered = this.getSlotsBackToFront();

    // Floor grid
    this.renderFloorGrid(ctx);

    // Back-to-front tree rendering
    for (let i = 0; i < ordered.length; i++) {
      const slot = ordered[i];
      const depth = this.getDepthForSlot(this.slots.indexOf(slot));
      const isFront = depth === 0;

      ctx.save();
      ctx.translate(slot.x, slot.y);
      ctx.scale(slot.scale, slot.scale);
      ctx.globalAlpha = slot.opacity;

      // Depth haze for back trees
      if (!isFront) {
        this.renderDepthHaze(ctx, slot, depth);
      }

      // Tree label
      this.renderTreeLabel(ctx, slot, isFront);

      // The tree itself
      slot.treeComponent.render(ctx);

      // Ground shadow for front tree
      if (isFront) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = slot.tree.color ?? NeonTheme.accent;
        ctx.beginPath();
        ctx.ellipse(55, 260, 200, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    // Cross-tree links (screen space)
    this.renderLinks(ctx);

    // Vanishing point fog
    this.renderDepthFog(ctx);
  }

  private renderFlat(ctx: CanvasRenderingContext2D): void {
    for (const slot of this.slots) {
      ctx.save();
      ctx.translate(slot.x, slot.y);
      ctx.scale(slot.scale, slot.scale);
      ctx.globalAlpha = slot.opacity;
      this.renderTreeLabel(ctx, slot, true);
      slot.treeComponent.render(ctx);
      ctx.restore();
    }
    this.renderLinks(ctx);
  }

  // --------------------------------------------------------------------------
  // Visual helpers
  // --------------------------------------------------------------------------

  private renderFloorGrid(ctx: CanvasRenderingContext2D): void {
    const { vanishingPointY } = this.perspective;
    const vpX = this.canvasWidth / 2;
    const vpY = this.canvasHeight * vanishingPointY;
    const bottomY = this.canvasHeight;

    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.strokeStyle = NeonTheme.accent;
    ctx.lineWidth = 0.5;

    // Horizontal depth lines
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const y = vpY + (bottomY - vpY) * t;
      const spread = t * this.canvasWidth * 0.85;
      ctx.beginPath();
      ctx.moveTo(vpX - spread / 2, y);
      ctx.lineTo(vpX + spread / 2, y);
      ctx.stroke();
    }

    // Converging vertical lines
    for (let i = -4; i <= 4; i++) {
      const bottomX = vpX + i * 140;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(bottomX, bottomY);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderDepthFog(ctx: CanvasRenderingContext2D): void {
    const { vanishingPointY } = this.perspective;
    const vpY = this.canvasHeight * vanishingPointY;

    ctx.save();
    const fog = ctx.createLinearGradient(0, vpY - 50, 0, vpY + 80);
    fog.addColorStop(0, "rgba(10, 14, 23, 0.65)");
    fog.addColorStop(0.4, "rgba(10, 14, 23, 0.2)");
    fog.addColorStop(1, "transparent");
    ctx.fillStyle = fog;
    ctx.fillRect(0, vpY - 50, this.canvasWidth, 130);
    ctx.restore();
  }

  private renderDepthHaze(ctx: CanvasRenderingContext2D, slot: TreeSlot, depth: number): void {
    // Subtle blue atmospheric haze around back trees
    const color = slot.tree.color ?? NeonTheme.accent2;
    ctx.save();
    ctx.globalAlpha = 0.02 * depth;
    ctx.fillStyle = color;
    ctx.fillRect(-40, -20, 300, 350);
    ctx.restore();
  }

  private renderTreeLabel(ctx: CanvasRenderingContext2D, slot: TreeSlot, isFront: boolean): void {
    const color = slot.tree.color ?? NeonTheme.accent;
    const label = slot.tree.label;

    ctx.save();
    ctx.font = isFront
      ? "bold 14px system-ui, -apple-system, sans-serif"
      : "bold 10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    if (isFront) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }

    ctx.fillStyle = isFront ? color : withAlpha(color, "88");
    ctx.fillText(label, 55, -12);

    // Underline accent
    const tw = ctx.measureText(label).width;
    ctx.beginPath();
    ctx.moveTo(55 - tw / 2 - 4, -8);
    ctx.lineTo(55 + tw / 2 + 4, -8);
    ctx.strokeStyle = withAlpha(color, isFront ? "44" : "22");
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  private renderLinks(ctx: CanvasRenderingContext2D): void {
    for (const link of this.links) {
      const fromSlot = this.slots.find(s => s.tree.id === link.fromTree);
      const toSlot = this.slots.find(s => s.tree.id === link.toTree);
      if (!fromSlot || !toSlot) continue;

      const fromPos = this.findNodeScreenPos(fromSlot, link.fromNode);
      const toPos = this.findNodeScreenPos(toSlot, link.toNode);
      if (!fromPos || !toPos) continue;

      const color = link.color ?? NeonTheme.accent2;
      const midAlpha = Math.min(fromSlot.opacity, toSlot.opacity);

      ctx.save();
      ctx.globalAlpha = midAlpha * 0.65;

      // Dash pattern
      if (link.style === "dashed") {
        ctx.setLineDash([8, 4]);
      } else if (link.style === "dotted") {
        ctx.setLineDash([3, 4]);
      }

      // Bezier curve stretching across depth
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const cx1 = fromPos.x + dx * 0.25;
      const cy1 = fromPos.y - Math.abs(dy) * 0.15;
      const cx2 = fromPos.x + dx * 0.75;
      const cy2 = toPos.y - Math.abs(dy) * 0.15;

      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, toPos.x, toPos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrow at end
      const angle = Math.atan2(toPos.y - cy2, toPos.x - cx2);
      ctx.save();
      ctx.translate(toPos.x, toPos.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-7, -3.5);
      ctx.lineTo(-7, 3.5);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      // Glow pass
      ctx.globalAlpha = midAlpha * 0.12;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, toPos.x, toPos.y);
      ctx.stroke();

      // Label at midpoint
      if (link.label) {
        const mx = fromPos.x + dx * 0.5;
        const my = fromPos.y + dy * 0.5 - Math.abs(dy) * 0.08;
        ctx.globalAlpha = midAlpha * 0.85;
        ctx.font = "9px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        // Background pill
        const tw = ctx.measureText(link.label).width + 12;
        ctx.fillStyle = NeonTheme.glass(0.88);
        this.roundRect(ctx, mx - tw / 2, my - 15, tw, 15, 4);
        ctx.fill();
        ctx.strokeStyle = withAlpha(color, "33");
        ctx.lineWidth = 0.5;
        this.roundRect(ctx, mx - tw / 2, my - 15, tw, 15, 4);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillText(link.label, mx, my - 3);
      }

      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // --------------------------------------------------------------------------
  // Node position resolution
  // --------------------------------------------------------------------------

  private findNodeScreenPos(
    slot: TreeSlot,
    nodeId: string
  ): { x: number; y: number } | null {
    const pos = this.getNodeLayoutPos(slot.tree.root, nodeId, 0, 0);
    if (!pos) return null;
    return {
      x: slot.x + pos.x * slot.scale,
      y: slot.y + pos.y * slot.scale,
    };
  }

  private getNodeLayoutPos(
    data: TreeNodeData,
    targetId: string,
    cx: number,
    level: number
  ): { x: number; y: number } | null {
    const nodeW = 110;
    const nodeH = 32;
    const nodeSpacing = 14;
    const levelSpacing = 60;

    const stw = this.calcSubtreeWidth(data, nodeW, nodeSpacing);

    const nodeX = cx - nodeW / 2;
    const nodeY = level * (nodeH + levelSpacing);

    if (data.id === targetId) {
      return { x: nodeX + nodeW / 2, y: nodeY + nodeH / 2 };
    }

    if (data.collapsed || !data.children) return null;

    let startX = cx - stw / 2;
    for (const child of data.children) {
      const childSTW = this.calcSubtreeWidth(child, nodeW, nodeSpacing);
      const childCx = startX + childSTW / 2;
      const found = this.getNodeLayoutPos(child, targetId, childCx, level + 1);
      if (found) return found;
      startX += childSTW + nodeSpacing;
    }
    return null;
  }

  private calcSubtreeWidth(data: TreeNodeData, nodeW: number, spacing: number): number {
    if (data.collapsed || !data.children || data.children.length === 0) return nodeW;
    let total = 0;
    for (const child of data.children) {
      total += this.calcSubtreeWidth(child, nodeW, spacing);
    }
    total += (data.children.length - 1) * spacing;
    return Math.max(nodeW, total);
  }

  // --------------------------------------------------------------------------
  // Slot layout calculation
  // --------------------------------------------------------------------------

  private getDepthForSlot(slotIndex: number): number {
    const n = this.slots.length;
    if (n === 0) return 0;
    let d = slotIndex - this.focusIndex;
    if (d < 0) d += n;
    return d;
  }

  private getSlotsBackToFront(): TreeSlot[] {
    const n = this.slots.length;
    if (n === 0) return [];
    const indexed = this.slots.map((s, i) => ({ slot: s, depth: this.getDepthForSlot(i) }));
    indexed.sort((a, b) => b.depth - a.depth);
    return indexed.map(i => i.slot);
  }

  private recalcSlots(animate: boolean): void {
    const n = this.slots.length;
    if (n === 0) return;

    const { vanishingPointY, depthScale, depthFade, horizontalSpread } = this.perspective;
    const vpX = this.canvasWidth / 2;
    const vpY = this.canvasHeight * vanishingPointY;

    if (this.direction === "perspective") {
      for (let i = 0; i < n; i++) {
        const d = this.getDepthForSlot(i);
        const s = Math.pow(depthScale, d);
        const o = Math.max(0.15, 1 - d * depthFade);

        // Y: front tree at lower portion, back trees rise toward VP
        const frontY = this.canvasHeight * 0.42;
        const targetY = frontY + (vpY - frontY) * (1 - Math.pow(depthScale, d * 0.8));
        // X: center with alternating lateral offset
        const lateralOffset = d > 0 ? ((d % 2 === 0 ? -1 : 1) * horizontalSpread * d * 0.6) : 0;
        const targetX = vpX - (55 * s) + lateralOffset;

        const slot = this.slots[i];
        slot.targetX = targetX;
        slot.targetY = targetY;
        slot.targetScale = s;
        slot.targetOpacity = o;

        if (!animate) {
          slot.x = targetX;
          slot.y = targetY;
          slot.scale = s;
          slot.opacity = o;
        }
      }
    } else if (this.direction === "side-by-side") {
      const totalW = this.canvasWidth - 80;
      const slotW = totalW / n;
      for (let i = 0; i < n; i++) {
        const slot = this.slots[i];
        const sc = Math.min(1, slotW / 350);
        slot.targetX = 40 + i * slotW + slotW * 0.1;
        slot.targetY = 80;
        slot.targetScale = sc;
        slot.targetOpacity = 1;
        if (!animate) {
          slot.x = slot.targetX;
          slot.y = slot.targetY;
          slot.scale = sc;
          slot.opacity = slot.targetOpacity;
        }
      }
    } else {
      // Stacked
      for (let i = 0; i < n; i++) {
        const slot = this.slots[i];
        const rowH = (this.canvasHeight - 60) / n;
        slot.targetX = this.canvasWidth * 0.15;
        slot.targetY = 30 + i * rowH;
        slot.targetScale = Math.min(1, rowH / 300);
        slot.targetOpacity = 1;
        if (!animate) {
          slot.x = slot.targetX;
          slot.y = slot.targetY;
          slot.scale = slot.targetScale;
          slot.opacity = slot.targetOpacity;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Public: toggle collapse on front tree
  // --------------------------------------------------------------------------

  toggleNode(nodeId: string): void {
    const frontSlot = this.slots.find(
      (_, i) => this.getDepthForSlot(i) === 0
    );
    if (!frontSlot) return;
    frontSlot.treeComponent.toggle(nodeId);
  }

  /** Get the current focus tree */
  get focusedTree(): ForestTree | null {
    return this.trees[this.focusIndex] ?? null;
  }
}
