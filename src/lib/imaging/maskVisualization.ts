import type { MaskVisualization } from "@/lib/imaging/channelKind";

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

/**
 * Box-dilate a binary mask by `radius` pixels using two separable passes
 * (O(W·H·R) instead of O(W·H·R²)). A radius of 1 produces a 3-pixel-thick
 * line; this is what we use to keep outlines legible when zoomed out without
 * obscuring detail when zoomed in.
 */
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

/**
 * Colorize a label raster (`0` = background). Supports uint8/16/32 per-pixel labels.
 */
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

  // Outlines: edge pixels opaque white (thickened so they survive being
  // minified by the GPU when the viewer is zoomed out), interior very faint
  // so labels still read as filled regions at extreme zoom-out.
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
