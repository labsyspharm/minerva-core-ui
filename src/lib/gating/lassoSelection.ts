import type { LassoSelection } from "@/lib/stores/gatingStore";
import type { SpatialIndex } from "./spatialIndex";

/**
 * Combine multiple lasso polygons into a single row-index set (union / complement).
 */
export function getCellsInLassos(
  spatialIndex: SpatialIndex,
  lassos: LassoSelection[],
): Set<number> {
  if (lassos.length === 0) return new Set();

  let result: Set<number> | null = null;

  for (const lasso of lassos) {
    const ring = lasso.polygon;
    if (ring.length < 3) continue;
    const indices = spatialIndex.queryPolygon(ring);
    const set = new Set(indices);

    if (lasso.mode === "complement") {
      if (result === null) {
        result = new Set();
        for (const i of indices) {
          /* complement of first lasso: keep cells outside polygon — approximated as empty until second op */
        }
        continue;
      }
      for (const i of result) {
        if (set.has(i)) result.delete(i);
      }
      continue;
    }

    if (result === null) {
      result = set;
    } else {
      for (const i of set) result.add(i);
    }
  }

  return result ?? new Set();
}
