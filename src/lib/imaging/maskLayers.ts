import type { MaskVisualization } from "@/lib/imaging/channelKind";
import { DEFAULT_MASK_VISUALIZATION } from "@/lib/imaging/channelKind";
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
  sourceShapeId?: string;
  sourceShapeLabel?: string;
  maskVisualization?: MaskVisualization;
};

/** Stable RGB from a string seed (label id, shape id, channel name). */
export function colorFromSeed(seed: string): [number, number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = 50 + ((h >> 16) & 0x9f);
  const g = 50 + ((h >> 8) & 0x9f);
  const b = 50 + (h & 0x9f);
  return [r, g, b];
}

function isEdgeAt(
  data: Uint8Array | Uint16Array | Uint32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  label: number,
): boolean {
  if (label === 0) return false;
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
    const ni = ny * width + nx;
    if (data[ni] !== label) return true;
  }
  return false;
}

function dilateBinaryMask(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return src;
  const horiz = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const lo = x - radius < 0 ? 0 : x - radius;
      const hi = x + radius >= width ? width - 1 : x + radius;
      let hit = 0;
      for (let xx = lo; xx <= hi; xx++) {
        if (src[row + xx]) {
          hit = 1;
          break;
        }
      }
      horiz[row + x] = hit;
    }
  }
  const out = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const lo = y - radius < 0 ? 0 : y - radius;
      const hi = y + radius >= height ? height - 1 : y + radius;
      let hit = 0;
      for (let yy = lo; yy <= hi; yy++) {
        if (horiz[yy * width + x]) {
          hit = 1;
          break;
        }
      }
      out[y * width + x] = hit;
    }
  }
  return out;
}

/** Colorize a label raster (`0` = background). */
export function labelRasterToRgba(
  data: Uint8Array | Uint16Array | Uint32Array,
  width: number,
  height: number,
  visualization: MaskVisualization,
): ImageData {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const n = width * height;

  if (visualization === "randomColors") {
    const colorByLabel = new Map<number, [number, number, number]>();
    for (let i = 0; i < n; i++) {
      const label = data[i];
      if (label === 0) continue;
      let rgb = colorByLabel.get(label);
      if (!rgb) {
        rgb = colorFromSeed(String(label));
        colorByLabel.set(label, rgb);
      }
      const o = i * 4;
      rgba[o] = rgb[0];
      rgba[o + 1] = rgb[1];
      rgba[o + 2] = rgb[2];
      rgba[o + 3] = 200;
    }
    return new ImageData(rgba, width, height);
  }

  const edgeMask = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const label = data[i];
      if (label === 0) continue;
      if (isEdgeAt(data, width, height, x, y, label)) {
        edgeMask[i] = 1;
      }
    }
  }
  const thickEdges = dilateBinaryMask(edgeMask, width, height, 1);
  for (let i = 0; i < n; i++) {
    const label = data[i];
    if (label === 0) continue;
    const o = i * 4;
    if (thickEdges[i]) {
      rgba[o] = 255;
      rgba[o + 1] = 255;
      rgba[o + 2] = 255;
      rgba[o + 3] = 235;
    } else {
      rgba[o] = 200;
      rgba[o + 1] = 220;
      rgba[o + 2] = 255;
      rgba[o + 3] = 36;
    }
  }
  return new ImageData(rgba, width, height);
}

/** Binary mask (`data[i]` 0/1) for annotation selections. */
export function binaryMaskToRgba(
  data: Uint8Array,
  width: number,
  height: number,
  visualization: MaskVisualization,
  colorSeed: string,
): ImageData {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const [fr, fg, fb] = colorFromSeed(colorSeed);

  if (visualization === "randomColors") {
    for (let i = 0; i < width * height; i++) {
      if (!data[i]) continue;
      const o = i * 4;
      rgba[o] = fr;
      rgba[o + 1] = fg;
      rgba[o + 2] = fb;
      rgba[o + 3] = 170;
    }
    return new ImageData(rgba, width, height);
  }

  const n = width * height;
  const edgeMask = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!data[i]) continue;
      if (isEdgeAt(data, width, height, x, y, 1)) edgeMask[i] = 1;
    }
  }
  const thickEdges = dilateBinaryMask(edgeMask, width, height, 1);
  for (let i = 0; i < n; i++) {
    if (!data[i]) continue;
    const o = i * 4;
    if (thickEdges[i]) {
      rgba[o] = 255;
      rgba[o + 1] = 255;
      rgba[o + 2] = 255;
      rgba[o + 3] = 230;
    } else {
      rgba[o] = fr;
      rgba[o + 1] = fg;
      rgba[o + 2] = fb;
      rgba[o + 3] = 40;
    }
  }
  return new ImageData(rgba, width, height);
}

const MAX_RASTER_SIDE = 4096;

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
