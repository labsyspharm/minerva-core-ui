import { makeCircle } from "./brushStroke";
import { polygonUnion } from "./polygonClipping";

/**
 * Build the union-of-circles hull for a brush stroke.
 * Used by both the live preview and final annotation so they match.
 */
export function buildBrushHull(
  strokePoints: [number, number][],
  brushRadiusPx: number,
  viewportZoom: number | null | undefined,
): [number, number][] | null {
  if (strokePoints.length === 0 || brushRadiusPx <= 0) return null;

  const scale = 2 ** (viewportZoom ?? 0);
  const radiusWorld = brushRadiusPx / Math.max(scale, 0.01);

  let hull: [number, number][] | null = null;
  for (const [x, y] of strokePoints) {
    const circle = makeCircle(x, y, radiusWorld);
    if (!hull) {
      hull = circle;
    } else {
      const union = polygonUnion(hull, circle);
      if (union && union.length >= 3) {
        hull = union;
      }
    }
  }

  return hull && hull.length >= 3 ? hull : null;
}

