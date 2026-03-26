/**
 * Area42 Tree Layout
 *
 * Hierarchical tree visualization (org chart, file tree, dependency tree).
 * Different from force graph — uses recursive positioning with support
 * for top-down and left-right orientations, collapse/expand.
 */

import { SceneNode, Vec2 } from "../core/scene.js";
import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

export interface TreeNodeData {
  id: string;
  label: string;
  color?: string;
  children?: TreeNodeData[];
  data?: any;
  collapsed?: boolean;
}

interface LayoutNode {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
  collapsed: boolean;
  data?: any;
  subtreeWidth: number;
}

export interface TreeOptions {
  direction?: "top-down" | "left-right";
  nodeSpacing?: number;
  levelSpacing?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  cornerRadius?: number;
}

/**
 * Renders a hierarchical tree with rounded rect nodes, curved edges,
 * and collapse/expand support.
 */
export class Tree extends SceneNode {
  private direction: "top-down" | "left-right";
  private nodeSpacing: number;
  private levelSpacing: number;
  private nodeWidth: number;
  private nodeHeight: number;
  private cornerRadius: number;
  private root: TreeNodeData | null = null;
  private layoutRoot: LayoutNode | null = null;
  private offsetX = 0;
  private offsetY = 0;

  constructor(options: TreeOptions = {}) {
    super();
    this.direction = options.direction ?? "top-down";
    this.nodeSpacing = options.nodeSpacing ?? 20;
    this.levelSpacing = options.levelSpacing ?? 80;
    this.nodeWidth = options.nodeWidth ?? 120;
    this.nodeHeight = options.nodeHeight ?? 36;
    this.cornerRadius = options.cornerRadius ?? 8;
  }

  /** Set the tree data and recalculate layout */
  setData(root: TreeNodeData): void {
    this.root = root;
    this.layoutRoot = this.buildLayout(root);
    this.calculateLayout();
  }

  /** Toggle collapse/expand on a node */
  toggle(nodeId: string): void {
    if (!this.root) return;
    const node = this.findInData(this.root, nodeId);
    if (node && node.children && node.children.length > 0) {
      node.collapsed = !node.collapsed;
      this.layoutRoot = this.buildLayout(this.root);
      this.calculateLayout();
    }
  }

  /** Find a tree node at a given position (world coords relative to tree) */
  findNodeAt(x: number, y: number): TreeNodeData | null {
    if (!this.layoutRoot) return null;
    return this.hitTest(this.layoutRoot, x - this.offsetX, y - this.offsetY);
  }

  /** Set pan offset */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.layoutRoot) return;
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    this.renderEdges(ctx, this.layoutRoot);
    this.renderNodes(ctx, this.layoutRoot);
    ctx.restore();
  }

  // --- Private helpers ---

  private findInData(node: TreeNodeData, id: string): TreeNodeData | null {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this.findInData(child, id);
        if (found) return found;
      }
    }
    return null;
  }

  private buildLayout(data: TreeNodeData): LayoutNode {
    const visibleChildren = (!data.collapsed && data.children)
      ? data.children.map(c => this.buildLayout(c))
      : [];
    return {
      id: data.id,
      label: data.label,
      color: data.color ?? NeonTheme.accent,
      x: 0, y: 0,
      width: this.nodeWidth,
      height: this.nodeHeight,
      children: visibleChildren,
      collapsed: data.collapsed ?? false,
      data: data.data,
      subtreeWidth: 0,
    };
  }

  private calculateLayout(): void {
    if (!this.layoutRoot) return;
    this.calcSubtreeWidth(this.layoutRoot);
    if (this.direction === "top-down") {
      this.positionTopDown(this.layoutRoot, 0, 0);
    } else {
      this.positionLeftRight(this.layoutRoot, 0, 0);
    }
  }

  private calcSubtreeWidth(node: LayoutNode): number {
    if (node.children.length === 0) {
      const dim = this.direction === "top-down" ? this.nodeWidth : this.nodeHeight;
      node.subtreeWidth = dim;
      return dim;
    }
    let totalWidth = 0;
    for (const child of node.children) {
      totalWidth += this.calcSubtreeWidth(child);
    }
    totalWidth += (node.children.length - 1) * this.nodeSpacing;
    const dim = this.direction === "top-down" ? this.nodeWidth : this.nodeHeight;
    node.subtreeWidth = Math.max(dim, totalWidth);
    return node.subtreeWidth;
  }

  private positionTopDown(node: LayoutNode, cx: number, level: number): void {
    node.x = cx - this.nodeWidth / 2;
    node.y = level * (this.nodeHeight + this.levelSpacing);
    if (node.children.length === 0) return;
    let startX = cx - node.subtreeWidth / 2;
    for (const child of node.children) {
      const childCx = startX + child.subtreeWidth / 2;
      this.positionTopDown(child, childCx, level + 1);
      startX += child.subtreeWidth + this.nodeSpacing;
    }
  }

  private positionLeftRight(node: LayoutNode, cy: number, level: number): void {
    node.x = level * (this.nodeWidth + this.levelSpacing);
    node.y = cy - this.nodeHeight / 2;
    if (node.children.length === 0) return;
    let startY = cy - node.subtreeWidth / 2;
    for (const child of node.children) {
      const childCy = startY + child.subtreeWidth / 2;
      this.positionLeftRight(child, childCy, level + 1);
      startY += child.subtreeWidth + this.nodeSpacing;
    }
  }

  private renderEdges(ctx: CanvasRenderingContext2D, node: LayoutNode): void {
    for (const child of node.children) {
      if (this.direction === "left-right") {
        const fX = node.x + this.nodeWidth;
        const fY = node.y + this.nodeHeight / 2;
        const tX = child.x;
        const tY = child.y + this.nodeHeight / 2;
        const midX = (fX + tX) / 2;
        ctx.beginPath();
        ctx.moveTo(fX, fY);
        ctx.bezierCurveTo(midX, fY, midX, tY, tX, tY);
        ctx.strokeStyle = withAlpha(child.color, "55");
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const fromX = node.x + this.nodeWidth / 2;
        const fromY = node.y + this.nodeHeight;
        const toX = child.x + this.nodeWidth / 2;
        const toY = child.y;
        const midY = (fromY + toY) / 2;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
        ctx.strokeStyle = withAlpha(child.color, "55");
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      this.renderEdges(ctx, child);
    }
  }

  private renderNodes(ctx: CanvasRenderingContext2D, node: LayoutNode): void {
    const { x, y, width, height, label, color, collapsed } = node;
    const r = this.cornerRadius;

    ctx.save();

    // Node background
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = NeonTheme.glass(0.8);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, "88");
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top gradient line
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, 2);
    ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x + width, y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, withAlpha(color, "88"));
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, 2);
    ctx.restore();

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.08;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Label text
    ctx.fillStyle = NeonTheme.text;
    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxTextW = width - 20;
    let displayLabel = label;
    if (ctx.measureText(displayLabel).width > maxTextW) {
      while (displayLabel.length > 3 && ctx.measureText(displayLabel + "...").width > maxTextW) {
        displayLabel = displayLabel.slice(0, -1);
      }
      displayLabel += "...";
    }
    ctx.fillText(displayLabel, x + width / 2, y + height / 2);

    // Collapse/expand indicator
    if (this.root) {
      const dataNode = this.findInData(this.root, node.id);
      if (dataNode && dataNode.children && dataNode.children.length > 0) {
        const indicator = collapsed ? "+" : "\u2013";
        ctx.fillStyle = withAlpha(color, "aa");
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "right";
        ctx.fillText(indicator, x + width - 6, y + height / 2);
      }
    }

    ctx.restore();

    for (const child of node.children) {
      this.renderNodes(ctx, child);
    }
  }

  private hitTest(node: LayoutNode, x: number, y: number): TreeNodeData | null {
    // Check children first (front-to-back), but only if not collapsed
    if (!node.collapsed) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const found = this.hitTest(node.children[i], x, y);
        if (found) return found;
      }
    }
    // Collapsed nodes get a slightly larger hit area to stay clickable
    const pad = node.collapsed ? 4 : 0;
    if (x >= node.x - pad && x <= node.x + node.width + pad &&
        y >= node.y - pad && y <= node.y + node.height + pad) {
      if (this.root) return this.findInData(this.root, node.id);
    }
    return null;
  }
}
