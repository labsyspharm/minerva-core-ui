/**
 * Wrapper around polygon-clipping for union and difference of simple polygons.
 * Input/output: single ring as [number, number][] (closed: first point may equal last).
 * The package exports a default object { union, difference, ... }, not named exports.
 */
import polygonClipping from "polygon-clipping";

type MultiPolygon = [number, number][][][];
type PCPolygon = [number, number][][];

type Ring = [number, number][];
type Polygon = Ring[]; // exterior ring only for our use

function ensureClosed(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function toLibPolygon(ring: [number, number][]): Polygon {
  const closed = ensureClosed(ring);
  if (closed.length < 3) return [];
  return [closed];
}

function fromLibRings(rings: Polygon): [number, number][] | null {
  if (!rings || rings.length === 0) return null;
  const ring = rings[0];
  if (!ring || ring.length < 3) return null;
  return ring as [number, number][];
}

function polygonArea(ring: [number, number][]): number {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i][0] * ring[j][1];
    area -= ring[j][0] * ring[i][1];
  }
  return Math.abs(area) / 2;
}

/**
 * Union of two simple polygons. Returns a single ring (first or largest by area).
 */
export function polygonUnion(
  a: [number, number][],
  b: [number, number][],
): [number, number][] | null {
  if (a.length < 3 || b.length < 3) return null;
  const polyA = toLibPolygon(a);
  const polyB = toLibPolygon(b);
  if (polyA.length === 0 || polyB.length === 0) return null;
  const result = polygonClipping.union(
    polyA as PCPolygon,
    polyB as PCPolygon,
  ) as MultiPolygon;
  if (!result || result.length === 0) return null;
  if (result.length === 1) return fromLibRings(result[0] as Polygon);
  let best = result[0][0] as Ring;
  let bestArea = polygonArea(best);
  for (let i = 0; i < result.length; i++) {
    const poly = result[i];
    if (poly?.[0]) {
      const area = polygonArea(poly[0] as Ring);
      if (area > bestArea) {
        best = poly[0] as Ring;
        bestArea = area;
      }
    }
  }
  return best as [number, number][];
}

/**
 * Difference a - b (polygon a with polygon b cut out). Returns a single ring (first or largest).
 */
export function polygonDifference(
  a: [number, number][],
  b: [number, number][],
): [number, number][] | null {
  if (a.length < 3 || b.length < 3) return null;
  const polyA = toLibPolygon(a);
  const polyB = toLibPolygon(b);
  if (polyA.length === 0 || polyB.length === 0) return null;
  const result = polygonClipping.difference(
    polyA as PCPolygon,
    polyB as PCPolygon,
  ) as MultiPolygon;
  if (!result || result.length === 0) return null;
  if (result.length === 1 && result[0][0]) return fromLibRings(result[0] as Polygon);
  let best = result[0][0] as Ring;
  let bestArea = polygonArea(best);
  for (let i = 0; i < result.length; i++) {
    const poly = result[i];
    if (poly?.[0]) {
      const area = polygonArea(poly[0] as Ring);
      if (area > bestArea) {
        best = poly[0] as Ring;
        bestArea = area;
      }
    }
  }
  return best as [number, number][];
}
