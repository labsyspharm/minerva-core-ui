/**
 * Mask vs intensity by foreground neighbour equality.
 * Port of https://github.com/Yu-AnChen/mask-tool/blob/main/mask_tool/mask_detect.py
 *
 * A label mask is piecewise-constant: neighbouring *foreground* pixels match.
 * Intensity varies per pixel. Background (zeros) is ignored.
 *
 *   ~0.9–1.0  → mask
 *   ~0.0–0.05 → intensity
 *
 * Format-agnostic: accepts any bounded `getWindow` reader.
 */

const EQ_THRESHOLD = 0.5;
const MIN_PAIRS = 100_000;
const MAX_TILES = 6;
const PROBE_TILES = 48;
const TILE_MIN_FG = 0.01;
const DEFAULT_TILE = 2048;

export type MaskDetectLabel = "rgb" | "mask" | "image";

export type MaskDetectResult = {
  label: MaskDetectLabel;
  score: number | null;
};

/** One tiled 2-D channel, or a C×H×W stack. */
export type DetectablePlane = {
  width: number;
  height: number;
  channels?: number;
  integer?: boolean;
  uint8?: boolean;
  tileWidth?: number;
  tileHeight?: number;
  signal?: AbortSignal;
  getWindow: (
    x: number,
    y: number,
    w: number,
    h: number,
    channel?: number,
  ) => ArrayLike<number> | Promise<ArrayLike<number>>;
};

const PHI = 1.618033988749895;

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function isIntegerData(data: ArrayLike<number>): boolean {
  return (
    data instanceof Uint8Array ||
    data instanceof Uint8ClampedArray ||
    data instanceof Uint16Array ||
    data instanceof Uint32Array ||
    data instanceof Int8Array ||
    data instanceof Int16Array ||
    data instanceof Int32Array
  );
}

/** Right + down neighbour pairs that are both nonzero. */
function equalFgPairs(
  data: ArrayLike<number>,
  width: number,
  height: number,
  signal?: AbortSignal,
): [equal: number, total: number] {
  let eq = 0;
  let tot = 0;
  for (let y = 0; y < height; y++) {
    if ((y & 63) === 0) signal?.throwIfAborted();
    const row = y * width;
    for (let x = 0; x < width - 1; x++) {
      const a = data[row + x];
      const b = data[row + x + 1];
      if (a !== 0 && b !== 0) {
        tot += 1;
        if (a === b) eq += 1;
      }
    }
  }
  for (let y = 0; y < height - 1; y++) {
    if ((y & 63) === 0) signal?.throwIfAborted();
    const row = y * width;
    const next = row + width;
    for (let x = 0; x < width; x++) {
      const a = data[row + x];
      const b = data[next + x];
      if (a !== 0 && b !== 0) {
        tot += 1;
        if (a === b) eq += 1;
      }
    }
  }
  return [eq, tot];
}

/** Golden-ratio coprime stride over `range(n)` — no RNG. */
function ldsOrder(n: number): number[] {
  if (n <= 2) return [...Array(n).keys()];
  let k = Math.max(1, Math.round(n / PHI));
  while (k < n && gcd(k, n) !== 1) k += 1;
  if (gcd(k, n) !== 1) return [...Array(n).keys()];
  return Array.from({ length: n }, (_, i) => (i * k) % n);
}

function fgFraction(data: ArrayLike<number>, size: number): number {
  if (size <= 0) return 0;
  let nz = 0;
  for (let i = 0; i < size; i++) if (data[i] !== 0) nz += 1;
  return nz / size;
}

async function readWindow(
  plane: DetectablePlane,
  x: number,
  y: number,
  w: number,
  h: number,
  channel: number,
): Promise<{ data: ArrayLike<number>; width: number; height: number }> {
  plane.signal?.throwIfAborted();
  const rw = Math.max(0, Math.min(w, plane.width - x));
  const rh = Math.max(0, Math.min(h, plane.height - y));
  if (rw <= 0 || rh <= 0) return { data: [], width: 0, height: 0 };
  const data = await plane.getWindow(x, y, rw, rh, channel);
  return { data, width: rw, height: rh };
}

function tileShape(plane: DetectablePlane): [number, number] {
  const th = Math.max(1, plane.tileHeight ?? DEFAULT_TILE);
  const tw = Math.max(1, plane.tileWidth ?? DEFAULT_TILE);
  return [th, tw];
}

async function sparseEquality(
  plane: DetectablePlane,
  channel: number,
): Promise<number | null> {
  const H = plane.height;
  const W = plane.width;
  const [th, tw] = tileShape(plane);
  const nTy = Math.max(1, Math.ceil(H / th));
  const nTx = Math.max(1, Math.ceil(W / tw));

  let eq = 0;
  let tot = 0;
  let used = 0;
  let read = 0;
  for (const idx of ldsOrder(nTy * nTx)) {
    plane.signal?.throwIfAborted();
    if (used >= MAX_TILES || tot >= MIN_PAIRS || read >= PROBE_TILES) break;
    const ty = Math.floor(idx / nTx);
    const tx = idx % nTx;
    const win = await readWindow(plane, tx * tw, ty * th, tw, th, channel);
    read += 1;
    const size = win.width * win.height;
    if (size === 0 || fgFraction(win.data, size) < TILE_MIN_FG) continue;
    const [e, t] = equalFgPairs(win.data, win.width, win.height, plane.signal);
    eq += e;
    tot += t;
    used += 1;
  }
  return tot >= MIN_PAIRS / 10 ? eq / tot : null;
}

async function classifyPlane(
  plane: DetectablePlane,
  channel: number,
): Promise<MaskDetectResult> {
  const score = await sparseEquality(plane, channel);
  if (score == null) {
    let integer = plane.integer;
    if (integer == null) {
      const probe = await readWindow(plane, 0, 0, 1, 1, channel);
      integer = isIntegerData(probe.data);
    }
    return { label: integer ? "mask" : "image", score: null };
  }
  return { label: score > EQ_THRESHOLD ? "mask" : "image", score };
}

export async function classify(
  plane: DetectablePlane,
  channel = 0,
): Promise<MaskDetectResult> {
  const channels = plane.channels ?? 1;
  if (channels === 3 && plane.uint8) return { label: "rgb", score: null };
  const ch = channels > 1 ? channel : 0;
  return classifyPlane(plane, ch);
}
