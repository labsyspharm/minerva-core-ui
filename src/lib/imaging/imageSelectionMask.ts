import type { MaskVisualization } from "@/lib/imaging/channelKind";
import { DEFAULT_MASK_VISUALIZATION } from "@/lib/imaging/channelKind";
import { binaryMaskToRgba } from "@/lib/imaging/maskVisualization";
import type { Shape } from "@/lib/shapes/shapeModel";
import {
  ellipseToPolygon,
  lineToPolygon,
  textToPolygon,
} from "@/lib/shapes/shapeModel";

/** Channel-list visibility key for the virtual selection / mask row. */
export const SELECTION_MASK_CHANNEL_KEY = "Selection";

/** Deck.gl mask layer id (`operation: 'mask'`) for {@link MaskExtension}. */
export const IMAGE_SELECTION_MASK_LAYER_ID = "image-selection-mask";

export type ImageSelectionMask = {
  width: number;
  height: number;
  /** 1 = inside selection, 0 = outside; row-major, top = min Y. */
  data: Uint8Array;
  /** World bounds `[minX, minY, maxX, maxY]` aligned with viewer image coordinates. */
  bounds: [number, number, number, number];
  /** Source annotation id when created from a waypoint shape. */
  sourceShapeId?: string;
  sourceShapeLabel?: string;
  maskVisualization?: MaskVisualization;
};

const MAX_RASTER_SIDE = 4096;

/** Closed polygon for rasterization, or null if the shape cannot define a region. */
export function polygonRingFromShape(shape: Shape): [number, number][] | null {
  switch (shape.type) {
    case "polygon":
      return shape.polygon.length >= 3 ? shape.polygon : null;
    case "line":
      return shape.polygon.length >= 3
        ? shape.polygon
        : lineToPolygon(
            shape.polygon[0] ?? [0, 0],
            shape.polygon[1] ?? shape.polygon[0] ?? [0, 0],
            shape.style.lineWidth,
          );
    case "polyline": {
      if (shape.polygon.length < 2) return null;
      const first = shape.polygon[0];
      return [...shape.polygon, first];
    }
    case "point": {
      const [x, y] = shape.position;
      const r = Math.max(2, shape.style.radius);
      return ellipseToPolygon([x - r, y - r], [x + r, y + r], 24);
    }
    case "text":
      return textToPolygon(shape.position, shape.text, shape.style.fontSize);
    default:
      return null;
  }
}

/**
 * Rasterize a closed polygon into a coarse binary mask over its bounding box.
 * Coordinates must match full-image pixel space (same as annotations).
 */
export function rasterizePolygonToImageMask(
  polygon: [number, number][],
  imageWidth: number,
  imageHeight: number,
  meta?: { sourceShapeId?: string; sourceShapeLabel?: string },
): ImageSelectionMask | null {
  if (polygon.length < 3 || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }

  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(imageWidth, maxX);
  maxY = Math.min(imageHeight, maxY);
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw <= 0 || bh <= 0) return null;

  const scale = Math.min(1, MAX_RASTER_SIDE / Math.max(bw, bh));
  const width = Math.max(1, Math.ceil(bw * scale));
  const height = Math.max(1, Math.ceil(bh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.beginPath();
  for (let i = 0; i < polygon.length; i++) {
    const px = (polygon[i][0] - minX) * scale;
    const py = (polygon[i][1] - minY) * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = rgba[p + 3] > 0 || rgba[p] > 0 ? 1 : 0;
  }

  let any = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i]) {
      any = true;
      break;
    }
  }
  if (!any) return null;

  return {
    width,
    height,
    data,
    bounds: [minX, minY, maxX, maxY],
    ...meta,
  };
}

/** Deck.gl mask layer (grayscale alpha from binary raster). */
export function selectionMaskBinaryImageData(
  mask: ImageSelectionMask,
): ImageData {
  const { width, height, data } = mask;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = data[i] ? 255 : 0;
    const o = i * 4;
    rgba[o] = v;
    rgba[o + 1] = v;
    rgba[o + 2] = v;
    rgba[o + 3] = v;
  }
  return new ImageData(rgba, width, height);
}

export function selectionMaskDisplayImageData(
  mask: ImageSelectionMask,
): ImageData {
  const viz = mask.maskVisualization ?? DEFAULT_MASK_VISUALIZATION;
  const seed = mask.sourceShapeId ?? mask.sourceShapeLabel ?? "selection";
  return binaryMaskToRgba(mask.data, mask.width, mask.height, viz, seed);
}
