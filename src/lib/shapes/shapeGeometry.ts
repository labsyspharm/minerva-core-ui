/** Degenerate closed polygon encoding a segment (arrow / line body in world space). */
export function arrowLineDegeneratePolygon(
  start: [number, number],
  end: [number, number],
): [number, number][] {
  const [sx, sy] = start;
  const [ex, ey] = end;
  return [
    [sx, sy],
    [ex, ey],
    [ex, ey],
    [sx, sy],
    [sx, sy],
  ];
}
