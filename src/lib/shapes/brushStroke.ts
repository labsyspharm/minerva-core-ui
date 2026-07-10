/**
 * Circle polygon helper for brush hull construction.
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
