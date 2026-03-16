/**
 * Image utilities for SAM2 integration.
 * Resize, convert canvas to tensor, slice mask, convert mask to polygon.
 */

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  size: { w: number; h: number },
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = size.w;
  out.height = size.h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");
  ctx.drawImage(canvas, 0, 0, size.w, size.h);
  return out;
}

/**
 * Convert canvas to Float32Array for SAM2 encoder.
 * Shape [1, 3, height, width], NCHW, values 0-1.
 */
export function canvasToFloat32Array(canvas: HTMLCanvasElement): {
  float32Array: Float32Array;
  shape: [number, number, number, number];
} {
  const { width, height } = canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const total = width * height * 3;
  const float32Array = new Float32Array(total);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    float32Array[i] = r;
    float32Array[width * height + i] = g;
    float32Array[width * height * 2 + i] = b;
  }
  return {
    float32Array,
    shape: [1, 3, height, width],
  };
}

/**
 * Duplicate grayscale to RGB for SAM (expects 3 channels).
 */
export function grayscaleToRgbCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Convert Float32Array (NCHW, 0-1) back to canvas for debugging.
 */
export function float32ArrayToCanvas(
  float32Array: Float32Array,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");
  const imageData = ctx.createImageData(width, height);
  const size = width * height;
  for (let i = 0; i < size; i++) {
    const r = Math.round(Math.min(255, Math.max(0, float32Array[i] * 255)));
    const g = Math.round(Math.min(255, Math.max(0, float32Array[size + i] * 255)));
    const b = Math.round(Math.min(255, Math.max(0, float32Array[size * 2 + i] * 255)));
    imageData.data[i * 4] = r;
    imageData.data[i * 4 + 1] = g;
    imageData.data[i * 4 + 2] = b;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Convert single-channel float mask (256x256, 0-1) to canvas for debugging.
 */
export function maskFloatToCanvas(mask: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");
  const imageData = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(255, Math.max(0, mask[i] * 255)));
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Build encoded image canvas for debugging. Returns canvas for caller to use.
 * Enable with: localStorage.setItem('sam2_debug', '1')
 */
export function saveEncodedImageForDebug(
  float32Array: Float32Array,
  shape: [number, number, number, number],
  _clickX: number,
  _clickY: number,
): HTMLCanvasElement {
  const [, , h, w] = shape;
  return float32ArrayToCanvas(float32Array, w, h);
}

export type MaskTensor = {
  dims: readonly number[];
  cpuData: Float32Array;
};

/**
 * Extract one mask from decoder output.
 */
export function sliceTensorMask(
  tensor: MaskTensor,
  maskIdx: number,
): Float32Array {
  const [batch, numMasks, h, w] = tensor.dims;
  const size = h * w;
  const start = maskIdx * size;
  return tensor.cpuData.slice(start, start + size);
}

/**
 * Convert 256x256 float mask to polygon in crop/image coordinates.
 * Tries boundary tracing first; falls back to convex hull of foreground pixels.
 */
export function maskToPolygon(
  mask256: Float32Array,
  cropOffsetX: number,
  cropOffsetY: number,
  cropWidth: number,
  cropHeight: number,
  threshold: number = 0.25,
): [number, number][] {
  const w = 256;
  const h = 256;
  const scaleX = cropWidth / w;
  const scaleY = cropHeight / h;

  let contour = traceContour(mask256, w, h, threshold);
  if (contour.length < 3) {
    contour = convexHullOfForeground(mask256, w, h, threshold);
  }
  if (contour.length < 3) return [];

  const closed =
    contour[0][0] !== contour[contour.length - 1][0] ||
    contour[0][1] !== contour[contour.length - 1][1]
      ? [...contour, contour[0]]
      : contour;
  const simplified = douglasPeucker(closed, 1);
  if (simplified.length < 3) return closed.map(([x, y]) => [cropOffsetX + x * scaleX, cropOffsetY + y * scaleY] as [number, number]);
  return simplified.map(([x, y]) => [
    cropOffsetX + x * scaleX,
    cropOffsetY + y * scaleY,
  ]) as [number, number][];
}

/**
 * Convex hull of all foreground pixels - fallback when boundary tracing fails.
 */
function convexHullOfForeground(
  mask: Float32Array,
  w: number,
  h: number,
  threshold: number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] > threshold) points.push([x, y]);
    }
  }
  if (points.length < 3) return [];
  return convexHull(points);
}

/**
 * Graham scan convex hull.
 */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const pivot = points.reduce((min, p) => (p[1] < min[1] || (p[1] === min[1] && p[0] < min[0]) ? p : min));
  const sorted = points
    .filter((p) => p !== pivot)
    .sort((a, b) => {
      const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
      const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
      if (angleA !== angleB) return angleA - angleB;
      return (a[0] - pivot[0]) ** 2 + (a[1] - pivot[1]) ** 2 - (b[0] - pivot[0]) ** 2 - (b[1] - pivot[1]) ** 2;
    });

  const hull: [number, number][] = [pivot, sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i];
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }
  return hull;
}

function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

const MOORE_NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [1, 0],           [1, 1],
  [0, 1], [-1, 1], [-1, 0],
];

function traceContour(
  mask: Float32Array,
  w: number,
  h: number,
  threshold: number,
): [number, number][] {
  const get = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return mask[y * w + x] > threshold;
  };
  const boundary: [number, number][] = [];
  const visited = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  for (let y = 0; y < h && boundary.length === 0; y++) {
    for (let x = 0; x < w && boundary.length === 0; x++) {
      if (!get(x, y)) continue;
      let hasBackground = false;
      for (const [dx, dy] of MOORE_NEIGHBORS) {
        if (!get(x + dx, y + dy)) {
          hasBackground = true;
          break;
        }
      }
      if (hasBackground) {
        boundary.push([x, y]);
        visited.add(key(x, y));
        break;
      }
    }
  }
  if (boundary.length === 0) return [];

  let cx = boundary[0][0];
  let cy = boundary[0][1];
  const startCx = cx;
  const startCy = cy;
  let dir = 0;
  const maxSteps = w * h;
  let steps = 0;
  while (steps++ < maxSteps) {
    let found = false;
    for (let i = 0; i < 8; i++) {
      const idx = (dir + i) % 8;
      const [dx, dy] = MOORE_NEIGHBORS[idx];
      const nx = cx + dx;
      const ny = cy + dy;
      if (get(nx, ny)) {
        if (!visited.has(key(nx, ny))) {
          boundary.push([nx, ny]);
          visited.add(key(nx, ny));
        }
        cx = nx;
        cy = ny;
        dir = (idx + 5) % 8;
        found = true;
        if (boundary.length > 2 && Math.abs(cx - startCx) <= 1 && Math.abs(cy - startCy) <= 1) {
          return boundary;
        }
        break;
      }
    }
    if (!found) break;
  }
  return boundary;
}

function douglasPeucker(
  points: [number, number][],
  epsilon: number,
): [number, number][] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist < epsilon) return [start, end];
  const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
  const right = douglasPeucker(points.slice(maxIdx), epsilon);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const mag = Math.sqrt(dx * dx + dy * dy) || 1e-10;
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / mag;
}
