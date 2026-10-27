import type { View3d } from "@/lib/stores/documentSchema";

export type Vec3 = [number, number, number];

/** Volume density for thick multichannel fluorescence (kiln's IMS default). */
export const DEFAULT_DENSITY = 0.1;

/** Waypoint flight duration and easing, as in the 2D viewer (ImageViewer). */
export const WAYPOINT_FLY_MS = 1400;

export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Render modes a waypoint can use, with their toolbar labels. */
export const RENDER_MODE_LABELS: Record<View3d["renderMode"], string> = {
  dvr: "Volume",
  mip: "MIP",
  iso: "Surface",
};

/** True when the view's clip box cuts into the volume. */
export function isClipped(view: Pick<View3d, "clipMin" | "clipMax">): boolean {
  return (
    view.clipMin.some((v) => v > 1e-3) || view.clipMax.some((v) => v < 1 - 1e-3)
  );
}

/** Signed angle from `a` to `b` (radians) along the shorter way round. */
function shortestTurn(a: number, b: number): number {
  const tau = Math.PI * 2;
  let d = (b - a) % tau;
  if (d > Math.PI) d -= tau;
  if (d < -Math.PI) d += tau;
  return d;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Geometric interpolation for strictly positive scales (distance, density). */
const lerpLog = (a: number, b: number, t: number) =>
  a > 0 && b > 0 ? Math.exp(lerp(Math.log(a), Math.log(b), t)) : lerp(a, b, t);
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/**
 * Point `t` (0…1, already eased) on the flight from `a` to `b`: rotations turn
 * the short way, zoom and density change geometrically, the target and clip
 * box move linearly. The render mode switches halfway.
 */
export function interpolateView3d(a: View3d, b: View3d, t: number): View3d {
  const [ax, ay, ad, atx, aty, atz] = a.camera;
  const [bx, by, bd, btx, bty, btz] = b.camera;
  const target = lerp3([atx, aty, atz], [btx, bty, btz], t);
  return {
    camera: [
      ax + shortestTurn(ax, bx) * t,
      ay + shortestTurn(ay, by) * t,
      lerpLog(ad, bd, t),
      target[0],
      target[1],
      target[2],
    ],
    clipMin: lerp3(a.clipMin, b.clipMin, t),
    clipMax: lerp3(a.clipMax, b.clipMax, t),
    density: lerpLog(a.density, b.density, t),
    depthCue: lerp(a.depthCue, b.depthCue, t),
    renderMode: t < 0.5 ? a.renderMode : b.renderMode,
  };
}
