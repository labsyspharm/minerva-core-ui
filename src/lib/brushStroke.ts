/**
 * Convert a brush stroke (path of points) into a closed polygon outline
 * with the given radius in world coordinates.
 */
const SEGMENTS_PER_CIRCLE = 32;

export function makeCircle(
  cx: number,
  cy: number,
  radiusWorld: number,
  segments: number = SEGMENTS_PER_CIRCLE,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    points.push([
      cx + radiusWorld * Math.cos(angle),
      cy + radiusWorld * Math.sin(angle),
    ]);
  }
  return points;
}

/**
 * Convert brush stroke points to a closed polygon outline.
 * radiusPx is desired size in screen pixels. View zoom is log2 scale (zoom in = higher value).
 * World radius = radiusPx / 2^zoom so that screen size = radiusWorld * 2^zoom = radiusPx (constant on screen).
 * - 0 points: returns [] (no polygon).
 * - 1 point: returns a circle of radiusWorld.
 * - 2+ points: returns the outline of the thick stroke (left boundary, then right in reverse, closed).
 */
export function brushStrokeToPolygon(
  points: [number, number][],
  radiusPx: number,
  viewportZoom: number,
): [number, number][] {
  if (points.length === 0) return [];
  const scale = 2 ** (viewportZoom ?? 0);
  const radiusWorld = radiusPx / Math.max(scale, 0.01);

  if (points.length === 1) {
    const [x, y] = points[0];
    return makeCircle(x, y, radiusWorld);
  }

  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const CAP_SEGMENTS = 16;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const next = points[i + 1];

    let nx: number, ny: number;
    if (i === 0 && next) {
      const dx = next[0] - p[0];
      const dy = next[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else if (i === points.length - 1 && prev) {
      const dx = p[0] - prev[0];
      const dy = p[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else if (prev && next) {
      const dx1 = p[0] - prev[0];
      const dy1 = p[1] - prev[1];
      const dx2 = next[0] - p[0];
      const dy2 = next[1] - p[1];
      const len1 = Math.hypot(dx1, dy1) || 1;
      const len2 = Math.hypot(dx2, dy2) || 1;
      const n1x = -dy1 / len1;
      const n1y = dx1 / len1;
      const n2x = -dy2 / len2;
      const n2y = dx2 / len2;
      nx = (n1x + n2x) / 2;
      ny = (n1y + n2y) / 2;
      const nlen = Math.hypot(nx, ny) || 1;
      nx /= nlen;
      ny /= nlen;
    } else {
      continue;
    }

    left.push([p[0] + radiusWorld * nx, p[1] + radiusWorld * ny]);
    right.push([p[0] - radiusWorld * nx, p[1] - radiusWorld * ny]);
  }

  // Rounded caps: semicircle at start (right[0] -> left[0]) and end (left[n-1] -> right[n-1])
  const p0 = points[0];
  const p1 = points[1];
  if (!p0 || !p1) return [];
  const cx0 = p0[0];
  const cy0 = p0[1];
  const dx0 = p1[0] - cx0;
  const dy0 = p1[1] - cy0;
  const len0 = Math.hypot(dx0, dy0) || 1;
  const thetaStart = Math.atan2(dx0 / len0, -dy0 / len0); // angle from center to right[0]
  const startCap: [number, number][] = [];
  for (let k = 1; k < CAP_SEGMENTS; k++) {
    const angle = thetaStart + (Math.PI * k) / CAP_SEGMENTS;
    startCap.push([
      cx0 + radiusWorld * Math.cos(angle),
      cy0 + radiusWorld * Math.sin(angle),
    ]);
  }

  const n = points.length - 1;
  const pn = points[n];
  const pnPrev = points[n - 1];
  if (!pn || !pnPrev) return [];
  const cx1 = pn[0];
  const cy1 = pn[1];
  const dx1 = pn[0] - pnPrev[0];
  const dy1 = pn[1] - pnPrev[1];
  const len1 = Math.hypot(dx1, dy1) || 1;
  const thetaEnd = Math.atan2(dx1 / len1, -dy1 / len1); // angle from center to right[n-1]
  const endCap: [number, number][] = [];
  for (let k = 1; k < CAP_SEGMENTS; k++) {
    const angle = thetaEnd + Math.PI - (Math.PI * k) / CAP_SEGMENTS;
    endCap.push([
      cx1 + radiusWorld * Math.cos(angle),
      cy1 + radiusWorld * Math.sin(angle),
    ]);
  }

  // Closed polygon: right[0], start cap arc, left[0]..left[n-1], end cap arc, right[n-1]..right[1], close
  const r0 = right[0];
  if (!r0) return [];
  const result: [number, number][] = [
    r0,
    ...startCap,
    ...left,
    ...endCap,
    ...right.slice(1).reverse(),
  ];
  result.push(result[0]);
  return result;
}

/**
 * Convex hull of a set of points (Graham scan).
 * Returns a closed polygon [..., first] or empty if fewer than 3 points.
 */
export function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return [];

  const pts = [...points];
  const start = pts.reduce((min, p) => {
    if (p[1] < min[1] || (p[1] === min[1] && p[0] < min[0])) return p;
    return min;
  }, pts[0]);
  const angle = (p: [number, number]) =>
    Math.atan2(p[1] - start[1], p[0] - start[0]);
  const dist = (p: [number, number]) =>
    (p[0] - start[0]) ** 2 + (p[1] - start[1]) ** 2;
  pts.sort((a, b) => {
    const da = angle(a);
    const db = angle(b);
    if (Math.abs(da - db) < 1e-10) return dist(a) - dist(b);
    return da - db;
  });

  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number],
  ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const hull: [number, number][] = [];
  for (const p of pts) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }
  hull.push(hull[0]);
  return hull;
}
