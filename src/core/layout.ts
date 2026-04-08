/**
 * Area42 v2 Layout Engine
 *
 * Automatic child positioning: vertical, horizontal, grid.
 * Children with `layoutManual = true` are skipped (positioned explicitly).
 * Layout runs before rendering, updating child positions in-place.
 */

export type LayoutType = "none" | "vertical" | "horizontal" | "grid";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function insets(all: number): Insets;
export function insets(vertical: number, horizontal: number): Insets;
export function insets(top: number, right: number, bottom: number, left: number): Insets;
export function insets(a: number, b?: number, c?: number, d?: number): Insets {
  if (b === undefined) return { top: a, right: a, bottom: a, left: a };
  if (c === undefined) return { top: a, right: b, bottom: a, left: b };
  return { top: a, right: b, bottom: c, left: d! };
}

export interface LayoutChild {
  position: { x: number; y: number };
  size: { x: number; y: number };
  visible: boolean;
  /** If true, this child is not affected by layout (manually positioned) */
  layoutManual?: boolean;
}

/**
 * Apply layout to children within a container.
 *
 * @param layout - Layout algorithm
 * @param children - Array of children to position
 * @param containerWidth - Available width for layout
 * @param containerHeight - Available height for layout
 * @param gap - Space between children
 * @param padding - Inner padding
 */
export function applyLayout(
  layout: LayoutType,
  children: LayoutChild[],
  containerWidth: number,
  containerHeight: number,
  gap: number = 0,
  padding: Insets = { top: 0, right: 0, bottom: 0, left: 0 },
): void {
  if (layout === "none") return;

  const managed = children.filter(c => c.visible && !c.layoutManual);
  if (managed.length === 0) return;

  const innerW = containerWidth - padding.left - padding.right;
  const innerH = containerHeight - padding.top - padding.bottom;

  switch (layout) {
    case "vertical":
      layoutVertical(managed, padding.left, padding.top, innerW, innerH, gap);
      break;
    case "horizontal":
      layoutHorizontal(managed, padding.left, padding.top, innerW, innerH, gap);
      break;
    case "grid":
      layoutGrid(managed, padding.left, padding.top, innerW, innerH, gap);
      break;
  }
}

/** Stack children top-to-bottom */
function layoutVertical(
  children: LayoutChild[],
  startX: number,
  startY: number,
  width: number,
  _height: number,
  gap: number,
): void {
  let y = startY;
  for (const child of children) {
    child.position.x = startX;
    child.position.y = y;
    // Stretch width to fill container
    child.size.x = width;
    y += child.size.y + gap;
  }
}

/** Lay children left-to-right */
function layoutHorizontal(
  children: LayoutChild[],
  startX: number,
  startY: number,
  _width: number,
  height: number,
  gap: number,
): void {
  let x = startX;
  for (const child of children) {
    child.position.x = x;
    child.position.y = startY;
    // Stretch height to fill container
    child.size.y = height;
    x += child.size.x + gap;
  }
}

/** Flow children into a grid based on container width */
function layoutGrid(
  children: LayoutChild[],
  startX: number,
  startY: number,
  width: number,
  _height: number,
  gap: number,
): void {
  if (children.length === 0) return;

  // Determine column count from first child's width
  const childW = children[0].size.x;
  const cols = Math.max(1, Math.floor((width + gap) / (childW + gap)));
  const cellW = (width - (cols - 1) * gap) / cols;

  let col = 0;
  let rowY = startY;
  let rowH = 0;

  for (const child of children) {
    child.position.x = startX + col * (cellW + gap);
    child.position.y = rowY;
    child.size.x = cellW;
    rowH = Math.max(rowH, child.size.y);

    col++;
    if (col >= cols) {
      col = 0;
      rowY += rowH + gap;
      rowH = 0;
    }
  }
}
