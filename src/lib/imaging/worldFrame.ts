import { Matrix4 } from "@math.gl/core";
import { effectiveOrientation } from "@/lib/imaging/imageOrientation";
import { type Loader, loaderPixelSizeXY } from "@/lib/imaging/viv";
import type { ImageOrientation } from "@/lib/stores/documentSchema";
import type { ViewRect } from "@/lib/viewer/samViewport";

export type WorldFrame = {
  pixelWidth: number;
  pixelHeight: number;
  umPerPixelX: number;
  umPerPixelY: number;
  worldWidth: number;
  worldHeight: number;
};

export const WORLD_MICRON = "µm";

const IDENTITY_UM = 1;

const METRE_PREFIX: Record<string, number> = {
  Y: 1e24,
  Z: 1e21,
  E: 1e18,
  P: 1e15,
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  da: 1e1,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  µ: 1e-6,
  μ: 1e-6,
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
  a: 1e-18,
  z: 1e-21,
  y: 1e-24,
};

type PhysicalSizeFields = {
  PhysicalSizeX?: number | null;
  PhysicalSizeY?: number | null;
  PhysicalSizeXUnit?: string | null;
  PhysicalSizeYUnit?: string | null;
};

type PhysicalScale = {
  umPerPixelX: number;
  umPerPixelY: number;
};

function metresPerUnit(unit: string): number | null {
  const u = unit.trim();
  const word = u.toLowerCase();
  if (
    word === "micron" ||
    word === "microns" ||
    word === "micrometer" ||
    word === "micrometers"
  ) {
    return 1e-6;
  }
  if (u === "m") return 1;
  if (!u.endsWith("m")) return null;
  const prefix = u.slice(0, -1);
  return prefix in METRE_PREFIX ? METRE_PREFIX[prefix] : null;
}

function umPerPixelFromAxis(
  size: number | null | undefined,
  unit: string | null | undefined,
): number | null {
  if (size == null) return null;
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unitStr = unit == null || unit === "" ? WORLD_MICRON : String(unit);
  const metres = metresPerUnit(unitStr);
  if (metres == null) return null;
  return n * metres * 1e6;
}

function parsePhysicalScale(
  pixels: PhysicalSizeFields | null | undefined,
): PhysicalScale {
  const x = umPerPixelFromAxis(
    pixels?.PhysicalSizeX,
    pixels?.PhysicalSizeXUnit,
  );
  const y = umPerPixelFromAxis(
    pixels?.PhysicalSizeY,
    pixels?.PhysicalSizeYUnit,
  );
  if (x == null && y == null) {
    return { umPerPixelX: IDENTITY_UM, umPerPixelY: IDENTITY_UM };
  }
  const umPerPixelX = x ?? y ?? IDENTITY_UM;
  const umPerPixelY = y ?? x ?? IDENTITY_UM;
  return { umPerPixelX, umPerPixelY };
}

function frameFromPixels(
  pixelWidth: number,
  pixelHeight: number,
  scale: PhysicalScale,
): WorldFrame {
  return {
    pixelWidth,
    pixelHeight,
    umPerPixelX: scale.umPerPixelX,
    umPerPixelY: scale.umPerPixelY,
    worldWidth: pixelWidth * scale.umPerPixelX,
    worldHeight: pixelHeight * scale.umPerPixelY,
  };
}

export function worldFrameFromLoader(loader: Loader): WorldFrame {
  const dims = loaderPixelSizeXY(loader);
  return frameFromPixels(
    dims?.sizeX ?? 0,
    dims?.sizeY ?? 0,
    parsePhysicalScale(loader.metadata?.Pixels),
  );
}

function planeAxis(
  plane: Loader["data"][number] | undefined,
  axis: "x" | "y",
): number | null {
  if (!plane?.labels || !plane.shape) return null;
  const i = plane.labels.indexOf(axis);
  if (i < 0) return null;
  const n = Number(plane.shape[i]);
  if (!Number.isFinite(n) || n <= 1) return null;
  return Math.round(n);
}

/** Largest pyramid level. */
function fullResPixelSize(
  loader: Loader,
): { sizeX: number; sizeY: number } | null {
  let best: { sizeX: number; sizeY: number } | null = null;
  let bestArea = 0;
  for (const plane of loader.data ?? []) {
    const sizeX = planeAxis(plane, "x");
    const sizeY = planeAxis(plane, "y");
    if (sizeX == null || sizeY == null) continue;
    const area = sizeX * sizeY;
    if (area > bestArea) {
      best = { sizeX, sizeY };
      bestArea = area;
    }
  }
  return best;
}

function comparablePixelSize(
  loader: Loader,
): { sizeX: number; sizeY: number } | null {
  return fullResPixelSize(loader) ?? loaderPixelSizeXY(loader);
}

/**
 * A file with no physical scale copies it from another open image of the
 * same pixel size. A file that already has a PhysicalSize keeps its own.
 */
export function inheritUnitlessPhysicalSize(loaders: readonly Loader[]): void {
  for (const loader of loaders) {
    const pixels = loader.metadata?.Pixels;
    const dims = comparablePixelSize(loader);
    if (!dims || !pixels || isCalibratedScale(loader)) continue;
    const donor = loaders.find((peer) => {
      if (peer === loader || !isCalibratedScale(peer)) return false;
      const peerDims = comparablePixelSize(peer);
      return peerDims?.sizeX === dims.sizeX && peerDims?.sizeY === dims.sizeY;
    });
    if (!donor) continue;
    const scale = parsePhysicalScale(donor.metadata?.Pixels);
    pixels.PhysicalSizeX = scale.umPerPixelX;
    pixels.PhysicalSizeY = scale.umPerPixelY;
    pixels.PhysicalSizeXUnit = WORLD_MICRON;
    pixels.PhysicalSizeYUnit = WORLD_MICRON;
  }
}

export function worldFrameFromPixelCounts(
  width: number,
  height: number,
): WorldFrame {
  return frameFromPixels(width, height, {
    umPerPixelX: IDENTITY_UM,
    umPerPixelY: IDENTITY_UM,
  });
}

export function effectiveWorldFrame(
  published: WorldFrame | null | undefined,
  docWidth: number,
  docHeight: number,
): WorldFrame {
  if (published && published.pixelWidth > 0 && published.pixelHeight > 0) {
    return published;
  }
  return worldFrameFromPixelCounts(docWidth, docHeight);
}

/**
 * Deck model matrix.
 * `T(µm) · T(center) · S(display) · T(−center) · scale(µm/px) · T(center) · R · S(flip) · T(−center)`.
 * µm/px is the loader's OME PhysicalSize, unless the image stores an override.
 * Display scale and translation are the user resize and move, in world µm.
 */
export function layerModelMatrix(
  loader: Loader,
  orientation?: Partial<ImageOrientation> | null,
): Matrix4 {
  const frame = worldFrameFromLoader(loader);
  const o = effectiveOrientation(orientation);
  const { pixelWidth, pixelHeight } = frame;
  const umPerPixelX = o.umPerPixel ?? frame.umPerPixelX;
  const umPerPixelY = o.umPerPixel ?? frame.umPerPixelY;
  const cx = pixelWidth / 2;
  const cy = pixelHeight / 2;
  const ux = cx * umPerPixelX;
  const uy = cy * umPerPixelY;
  // Y-down image space: +rotateZ is clockwise on screen (matches CW button).
  return new Matrix4()
    .translate([o.translateX, o.translateY, 0])
    .translate([ux, uy, 0])
    .scale([o.displayScale, o.displayScale, 1])
    .translate([-ux, -uy, 0])
    .scale([umPerPixelX, umPerPixelY, 1])
    .translate([cx, cy, 0])
    .rotateZ((o.rotationDegrees * Math.PI) / 180)
    .scale([o.flipHorizontal ? -1 : 1, o.flipVertical ? -1 : 1, 1])
    .translate([-cx, -cy, 0]);
}

function isIdentityScale(scale: PhysicalScale): boolean {
  return scale.umPerPixelX === 1 && scale.umPerPixelY === 1;
}

function isCalibratedScale(loader: Loader): boolean {
  return !isIdentityScale(parsePhysicalScale(loader.metadata?.Pixels));
}

export function pixelViewRectFromWorld(
  rect: ViewRect,
  scale: PhysicalScale,
): ViewRect {
  if (isIdentityScale(scale)) return rect;
  return {
    minX: rect.minX / scale.umPerPixelX,
    maxX: rect.maxX / scale.umPerPixelX,
    minY: rect.minY / scale.umPerPixelY,
    maxY: rect.maxY / scale.umPerPixelY,
  };
}

type ViewStateXY = {
  zoom: number;
  target: [number, number, number];
};

export function viewStateToWorld(
  vs: ViewStateXY,
  scale: PhysicalScale,
): ViewStateXY {
  if (isIdentityScale(scale)) return vs;
  const sx = scale.umPerPixelX;
  const sy = scale.umPerPixelY;
  return {
    zoom: vs.zoom - Math.log2(sx),
    target: [vs.target[0] * sx, vs.target[1] * sy, vs.target[2]],
  };
}

export function viewStateToPixels(
  vs: ViewStateXY,
  scale: PhysicalScale,
): ViewStateXY {
  if (isIdentityScale(scale)) return vs;
  const sx = scale.umPerPixelX;
  const sy = scale.umPerPixelY;
  return {
    zoom: vs.zoom + Math.log2(sx),
    target: [vs.target[0] / sx, vs.target[1] / sy, vs.target[2]],
  };
}
