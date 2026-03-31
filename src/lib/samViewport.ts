import type { OrthographicViewState } from "@deck.gl/core";

/**
 * Rectangle in image space (pixel coordinates of the underlying image).
 */
export interface ViewRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ImageShape {
  x: number;
  y: number;
}

/**
 * Compute the currently visible image-space rectangle given an
 * OrthographicViewState, the viewport size in screen pixels, and
 * the full image dimensions.
 *
 * Assumes that world coordinates correspond directly to image pixels,
 * which is how the ImageViewer initializes its view state.
 */
export function computeImageViewRect(
  viewState: OrthographicViewState,
  viewport: ViewportSize,
  image: ImageShape,
): ViewRect {
  const { zoom, target } = viewState;
  const { width, height } = viewport;

  // Fallback: if we do not have a meaningful viewport yet, show the whole image.
  if (!width || !height) {
    return {
      minX: 0,
      minY: 0,
      maxX: image.x,
      maxY: image.y,
    };
  }

  // deck.gl OrthographicView uses a zoom value on a log2 scale.
  // World units (image pixels) are scaled by 2^zoom to screen pixels.
  const scale = 2 ** (typeof zoom === "number" ? zoom : 0);

  const targetX = Array.isArray(target) ? target[0] : image.x / 2;
  const targetY = Array.isArray(target) ? target[1] : image.y / 2;

  // Map screen corners (0,0) and (width,height) back into world/image space.
  const minX = (0 - width / 2) / scale + targetX;
  const maxX = (width - width / 2) / scale + targetX;

  const minY = (0 - height / 2) / scale + targetY;
  const maxY = (height - height / 2) / scale + targetY;

  // Clamp to the actual image bounds.
  const clampedMinX = Math.max(0, Math.min(image.x, minX));
  const clampedMaxX = Math.max(0, Math.min(image.x, maxX));
  const clampedMinY = Math.max(0, Math.min(image.y, minY));
  const clampedMaxY = Math.max(0, Math.min(image.y, maxY));

  return {
    minX: clampedMinX,
    maxX: clampedMaxX,
    minY: clampedMinY,
    maxY: clampedMaxY,
  };
}

export interface SamTransform {
  samSize: number;
  scale: number;
  padX: number;
  padY: number;
  viewRect: ViewRect;
  imageToSam(point: [number, number]): [number, number];
  samToImage(point: [number, number]): [number, number];
}

/**
 * Create an affine transform between a rectangular region in image space
 * and a square SAM input space of size samSize×samSize.
 *
 * The transform preserves aspect ratio by uniformly scaling the longer
 * side of the viewRect to samSize, padding the shorter side so that the
 * content is centered.
 */
export function computeSamTransform(
  viewRect: ViewRect,
  samSize: number = 1024,
): SamTransform {
  const viewWidth = Math.max(0, viewRect.maxX - viewRect.minX);
  const viewHeight = Math.max(0, viewRect.maxY - viewRect.minY);

  if (viewWidth === 0 || viewHeight === 0) {
    // Degenerate case; return identity-like transform.
    const identityScale = 1;
    return {
      samSize,
      scale: identityScale,
      padX: 0,
      padY: 0,
      viewRect,
      imageToSam: ([x, y]) => [x, y],
      samToImage: ([x, y]) => [x, y],
    };
  }

  const longerSide = Math.max(viewWidth, viewHeight);
  const scale = samSize / longerSide;

  let padX = 0;
  let padY = 0;

  if (viewWidth >= viewHeight) {
    const scaledHeight = viewHeight * scale;
    padY = (samSize - scaledHeight) / 2;
  } else {
    const scaledWidth = viewWidth * scale;
    padX = (samSize - scaledWidth) / 2;
  }

  const imageToSam = ([xImg, yImg]: [number, number]): [number, number] => {
    const xSam = (xImg - viewRect.minX) * scale + padX;
    const ySam = (yImg - viewRect.minY) * scale + padY;
    return [xSam, ySam];
  };

  const samToImage = ([xSam, ySam]: [number, number]): [number, number] => {
    const xImg = (xSam - padX) / scale + viewRect.minX;
    const yImg = (ySam - padY) / scale + viewRect.minY;
    return [xImg, yImg];
  };

  return {
    samSize,
    scale,
    padX,
    padY,
    viewRect,
    imageToSam,
    samToImage,
  };
}

/**
 * Axis-aligned rectangle in SAM pixel space (same 1024×1024 canvas as the encoder)
 * where real image pixels live — excludes letterbox padding.
 */
export function getSamContentBoundsSamSpace(t: SamTransform): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const vw = Math.max(0, t.viewRect.maxX - t.viewRect.minX);
  const vh = Math.max(0, t.viewRect.maxY - t.viewRect.minY);
  return {
    minX: t.padX,
    minY: t.padY,
    maxX: t.padX + vw * t.scale,
    maxY: t.padY + vh * t.scale,
  };
}

/**
 * Create a 1024×1024 (by default) canvas that contains a scaled-and-padded
 * copy of the current viewer canvas. This is useful for feeding the visible
 * viewport into SAM while keeping a fixed input resolution.
 */
export function createSamCanvasFromViewportCanvas(
  sourceCanvas: HTMLCanvasElement,
  samSize: number = 1024,
): HTMLCanvasElement {
  const samCanvas = document.createElement("canvas");
  samCanvas.width = samSize;
  samCanvas.height = samSize;

  const ctx = samCanvas.getContext("2d");
  if (!ctx) {
    return samCanvas;
  }

  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;
  if (!srcWidth || !srcHeight) {
    return samCanvas;
  }

  const scale = samSize / Math.max(srcWidth, srcHeight);
  const drawWidth = srcWidth * scale;
  const drawHeight = srcHeight * scale;
  let offsetX = 0;
  let offsetY = 0;

  if (srcWidth >= srcHeight) {
    offsetY = (samSize - drawHeight) / 2;
  } else {
    offsetX = (samSize - drawWidth) / 2;
  }

  ctx.clearRect(0, 0, samSize, samSize);
  ctx.drawImage(
    sourceCanvas,
    0,
    0,
    srcWidth,
    srcHeight,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight,
  );

  return samCanvas;
}

export interface SamPromptPoint {
  x: number;
  y: number;
  label: number;
}

/**
 * Map prompt points defined in image space into SAM space using a SamTransform.
 */
export function mapImagePromptsToSam(
  points: SamPromptPoint[],
  transform: SamTransform,
): SamPromptPoint[] {
  return points.map((p) => {
    const [xSam, ySam] = transform.imageToSam([p.x, p.y]);
    return { x: xSam, y: ySam, label: p.label };
  });
}

export interface SamMaskDimensions {
  width: number;
  height: number;
}

export interface ImageBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Given a bounding box in SAM mask coordinates (e.g. in the 256×256 mask grid),
 * convert it into image-space coordinates using the inverse of the transform.
 */
export function mapSamMaskBoxToImageBox(
  samBox: ImageBoundingBox,
  samMaskDims: SamMaskDimensions,
  transform: SamTransform,
): ImageBoundingBox {
  const { width, height } = samMaskDims;
  if (!width || !height) {
    return {
      minX: transform.viewRect.minX,
      minY: transform.viewRect.minY,
      maxX: transform.viewRect.maxX,
      maxY: transform.viewRect.maxY,
    };
  }

  const scaleToSam = transform.samSize / Math.max(width, height);

  const toSamSpace = (xMask: number, yMask: number): [number, number] => {
    const xNorm = xMask / width;
    const yNorm = yMask / height;
    const xSam = xNorm * transform.samSize;
    const ySam = yNorm * transform.samSize;
    return [xSam, ySam];
  };

  const [minXSam, minYSam] = toSamSpace(samBox.minX, samBox.minY);
  const [maxXSam, maxYSam] = toSamSpace(samBox.maxX, samBox.maxY);

  const [minXImg, minYImg] = transform.samToImage([
    minXSam / scaleToSam,
    minYSam / scaleToSam,
  ]);
  const [maxXImg, maxYImg] = transform.samToImage([
    maxXSam / scaleToSam,
    maxYSam / scaleToSam,
  ]);

  return {
    minX: Math.min(minXImg, maxXImg),
    minY: Math.min(minYImg, maxYImg),
    maxX: Math.max(minXImg, maxXImg),
    maxY: Math.max(minYImg, maxYImg),
  };
}
