/**
 * Area42 v2 Style System
 *
 * Cascading styles that inherit from parent to child.
 * Each Container has an optional `style` partial — unset fields
 * inherit from the parent. The root default is the NeonTheme.
 */

/** Full set of styleable properties */
export interface Style {
  // Colors
  bg: string;
  fg: string;
  accent: string;
  accent2: string;
  border: string;
  textDim: string;
  danger: string;
  warning: string;
  success: string;

  // Typography
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: number;
  textTransform: "none" | "uppercase";

  // Effects
  glowColor: string;
  glowIntensity: number;
  glassBg: string;
  glassOpacity: number;

  // Spacing (used by layout, not directly by style inheritance)
  borderRadius: number;
}

/** Partial style — only override what you need */
export type PartialStyle = Partial<Style>;

/** Default root style — matches NeonTheme */
export const DEFAULT_STYLE: Style = {
  // Colors
  bg: "#0a0e17",
  fg: "#c8d6e5",
  accent: "#00d4aa",
  accent2: "#4dabf7",
  border: "rgba(30, 45, 74, 0.6)",
  textDim: "#6b7b8d",
  danger: "#ff6b6b",
  warning: "#ffd43b",
  success: "#51cf66",

  // Typography
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 11,
  fontWeight: "normal",
  letterSpacing: 0,
  textTransform: "none",

  // Effects
  glowColor: "#00d4aa",
  glowIntensity: 0.3,
  glassBg: "rgba(10, 14, 23, 0.75)",
  glassOpacity: 0.75,

  // Spacing
  borderRadius: 8,
};

/**
 * Resolve a style by merging a chain of partial styles.
 * Later entries override earlier ones. Starts from DEFAULT_STYLE.
 *
 * @param chain - Array of partial styles from root to leaf (parent first)
 * @returns Fully resolved Style
 */
export function resolveStyle(chain: PartialStyle[]): Style {
  const result = { ...DEFAULT_STYLE };
  for (const partial of chain) {
    for (const key of Object.keys(partial) as (keyof Style)[]) {
      const val = partial[key];
      if (val !== undefined) {
        (result as any)[key] = val;
      }
    }
  }
  return result;
}

/**
 * Collect the style chain from a node up to root.
 * Returns array from root to leaf (for resolveStyle).
 */
export function collectStyleChain(node: { style?: PartialStyle; parent: any | null }): PartialStyle[] {
  const chain: PartialStyle[] = [];
  let current: any = node;
  while (current) {
    if (current.style) {
      chain.unshift(current.style);
    }
    current = current.parent;
  }
  return chain;
}

/**
 * Convenience: resolve the effective style for a node.
 */
export function getResolvedStyle(node: { style?: PartialStyle; parent: any | null }): Style {
  return resolveStyle(collectStyleChain(node));
}
