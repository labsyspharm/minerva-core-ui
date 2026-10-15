import type { Image, ImageOrientation } from "@/lib/stores/documentSchema";

/** Wrap degrees into (−180, 180]. */
export function wrapDisplayDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (Math.abs(d) < 1e-9) return 0;
  if (d <= -180 + 1e-9) return 180;
  return d;
}

/** Resize limits, as a multiple of the file's physical size. */
export function clampDisplayScale(scale: number): number {
  return Math.min(100, Math.max(0.02, scale));
}

type PlacementInput = Partial<ImageOrientation> | null | undefined;

function finiteScale(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 1;
}

function finiteOffset(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function finiteUm(n: number | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Normalize placement. */
export function effectiveOrientation(o: PlacementInput): ImageOrientation {
  const umPerPixel = finiteUm(o?.umPerPixel);
  return {
    rotationDegrees: wrapDisplayDeg(o?.rotationDegrees ?? 0),
    flipHorizontal: o?.flipHorizontal ?? false,
    flipVertical: o?.flipVertical ?? false,
    translateX: finiteOffset(o?.translateX),
    translateY: finiteOffset(o?.translateY),
    displayScale: finiteScale(o?.displayScale),
    ...(umPerPixel != null ? { umPerPixel } : {}),
  };
}

/** Replace placement fields. */
export function withOrientation(
  o: PlacementInput,
  patch: Partial<ImageOrientation>,
): ImageOrientation {
  return effectiveOrientation({ ...o, ...patch });
}

/**
 * Mirror across the screen axis, like PowerPoint. The stored flip is applied
 * before rotation, so a screen flip also negates the angle: F·R(θ) = R(−θ)·F.
 */
export function flipOnScreen(
  o: PlacementInput,
  axis: "horizontal" | "vertical",
): ImageOrientation {
  const c = effectiveOrientation(o);
  return withOrientation(c, {
    rotationDegrees: -c.rotationDegrees,
    ...(axis === "horizontal"
      ? { flipHorizontal: !c.flipHorizontal }
      : { flipVertical: !c.flipVertical }),
  });
}

/** No rotation, flip, move or resize. */
export function isIdentityOrientation(o: PlacementInput): boolean {
  const c = effectiveOrientation(o);
  return (
    c.rotationDegrees === 0 &&
    !c.flipHorizontal &&
    !c.flipVertical &&
    c.translateX === 0 &&
    c.translateY === 0 &&
    c.displayScale === 1 &&
    c.umPerPixel == null
  );
}

export function orientationForImage(
  images: Image[] | undefined,
  sourceImageId: string | undefined,
  preview:
    | { imageId: string; orientation: ImageOrientation }
    | null
    | undefined,
): ImageOrientation | undefined {
  if (!sourceImageId) return undefined;
  if (preview?.imageId === sourceImageId) return preview.orientation;
  const image = images?.find((im) => im.id === sourceImageId);
  return image ? effectiveOrientation(image) : undefined;
}
