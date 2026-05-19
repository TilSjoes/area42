/**
 * Layout helpers for placing data points in 3D space.
 *
 * SELDON's data has natural axes (time, confidence, phase). This module
 * gives consumers a quick way to map those to spatial positions without
 * everyone reinventing the math. Consumers can ignore it and call
 * Graph3D.addNode with their own coordinates if they have richer
 * placement (e.g. UMAP on signal embeddings).
 */

/**
 * Map a value in [domainMin, domainMax] to [outMin, outMax]. Clamps to
 * the range. Stable for domainMin === domainMax (returns midpoint).
 */
export function scaleLinear(
  v: number,
  domainMin: number,
  domainMax: number,
  outMin: number,
  outMax: number,
): number {
  if (domainMax === domainMin) return (outMin + outMax) / 2;
  const t = (v - domainMin) / (domainMax - domainMin);
  const clamped = Math.max(0, Math.min(1, t));
  return outMin + clamped * (outMax - outMin);
}

/**
 * Convert an ISO date-time string to milliseconds since epoch. Returns
 * NaN for unparseable strings — caller decides what to do.
 */
export function parseTime(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return new Date(iso).getTime();
}

/**
 * Build a categorical-to-numeric mapping from an array of distinct
 * values. The first occurrence of each value gets index 0, second gets
 * 1, etc. Stable across calls, useful for slicing space by enum.
 */
export function categoricalIndex<T>(values: Iterable<T>): Map<T, number> {
  const map = new Map<T, number>();
  let i = 0;
  for (const v of values) {
    if (!map.has(v)) map.set(v, i++);
  }
  return map;
}
