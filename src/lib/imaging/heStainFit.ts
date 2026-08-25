/**
 * QuPath Auto / Macenko H&E stain vectors from a fixed set of native tiles.
 * The viewer stores only the GLSL inverse; residual is used to unmix, not shown.
 */
import type {
  LoaderPlane,
  SupportedTypedArray,
} from "@/lib/imaging/loaderTypes";
import type { Loader } from "@/lib/imaging/viv";

export type GlslMat3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type HeStainFit = { glslInverse: GlslMat3 };

/** Linear sparkline bins on the 0–1000 contrast window (same as H&E sliders). */
export type HeHistogram = {
  fitKey: string;
  hematoxylin: number[];
  eosin: number[];
};

const HE_HIST_BINS = 50;
const HE_HIST_MAX = 1000;
const HE_HIST_STEP = 4;
const HE_HIST_TIMEOUT_MS = 10_000;

type Vec3 = [number, number, number];

const N_TILES = 16;
const MAX_READS = 32;
const OVERVIEW_TISSUE = 0.5;
const FULLRES_TISSUE = 0.4;
const TISSUE_MAX = 220;
const FPS_SEED = 1;
const READ_BATCH = 4;
const LN10 = Math.LN10;
const MIN_OD = 0.05;
const MAX_OD_NORM = 1;
const IGNORE = 0.01;
const MAX_PIXELS = 100_000;
const GRAY_COS = Math.cos(0.15);
const MIN_ANGLE_DEG = 12;
const MAX_ANGLE_DEG = 80;
const SQRT3_INV = 1 / Math.sqrt(3);

const DEFAULT_H = unit([0.65, 0.7, 0.29]) as Vec3;
const DEFAULT_E = unit([0.2159, 0.8012, 0.5581]) as Vec3;

const inflight = new Map<string, Promise<HeStainFit>>();
const histInflight = new Map<string, Promise<HeHistogram>>();

export function stainInverseKey(inverse: GlslMat3): string {
  return inverse.map((v) => v.toFixed(5)).join(",");
}

export function clearHeStainEstimateCache(): void {
  inflight.clear();
  histInflight.clear();
}

export function ensureHeStainFit(args: {
  loader: Loader;
  cacheKey: string;
  channelIndex: number;
}): Promise<HeStainFit> {
  const hit = inflight.get(args.cacheKey);
  if (hit) return hit;
  const p = estimateHeStainFit(args.loader, args.channelIndex);
  inflight.set(args.cacheKey, p);
  return p;
}

function unit(v: readonly number[]): Vec3 | null {
  const n = Math.hypot(v[0], v[1], v[2]);
  if (!(n > 1e-12)) return null;
  return [v[0] / n, v[1] / n, v[2] / n];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function stainAngleDeg(a: Vec3, b: Vec3): number {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return (Math.acos(d) * 180) / Math.PI;
}

function invert3(m: readonly Vec3[]): GlslMat3 | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const s = 1 / det;
  return [
    A * s,
    (c * h - b * i) * s,
    (b * f - c * e) * s,
    B * s,
    (a * i - c * g) * s,
    (c * d - a * f) * s,
    C * s,
    (b * g - a * h) * s,
    (a * e - b * d) * s,
  ];
}

function defaultFit(): HeStainFit {
  const residual = unit(cross(DEFAULT_H, DEFAULT_E)) as Vec3;
  return {
    glslInverse: invert3([DEFAULT_H, DEFAULT_E, residual]) as GlslMat3,
  };
}

export const DEFAULT_STAIN_INVERSE = defaultFit().glslInverse;

function opticalDensity(v: number): number {
  return -Math.log(Math.max(v, 1) / 255) / LN10;
}

function box3MeanTwoPass(
  r: Float32Array,
  g: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
): void {
  if (w < 3 || h < 3) return;
  const n = w * h;
  const tr = new Float32Array(n);
  const tg = new Float32Array(n);
  const tb = new Float32Array(n);
  box3Pass(r, g, b, tr, tg, tb, w, h);
  box3Pass(tr, tg, tb, r, g, b, w, h);
}

function box3Pass(
  sr: Float32Array,
  sg: Float32Array,
  sb: Float32Array,
  dr: Float32Array,
  dg: Float32Array,
  db: Float32Array,
  w: number,
  h: number,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        dr[i] = sr[i];
        dg[i] = sg[i];
        db[i] = sb[i];
        continue;
      }
      let rs = 0;
      let gs = 0;
      let bs = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const row = (y + dy) * w + x;
        for (let dx = -1; dx <= 1; dx++) {
          const j = row + dx;
          rs += sr[j];
          gs += sg[j];
          bs += sb[j];
        }
      }
      dr[i] = rs / 9;
      dg[i] = gs / 9;
      db[i] = bs / 9;
    }
  }
}

function keepHeOdPixel(ro: number, go: number, bo: number): boolean {
  const magSq = ro * ro + go * go + bo * bo;
  if (magSq > MAX_OD_NORM * MAX_OD_NORM || magSq <= 0) return false;
  if (ro < MIN_OD || go < MIN_OD || bo < MIN_OD) return false;
  if (ro > go || bo > go) return false;
  const mag = Math.sqrt(magSq);
  if (((ro + go + bo) * SQRT3_INV) / mag >= GRAY_COS) return false;
  return true;
}

function equalSubsamplePacked3(
  packed: Float32Array,
  count: number,
): Float32Array {
  if (count <= MAX_PIXELS) {
    return packed.length === count * 3 ? packed : packed.subarray(0, count * 3);
  }
  const spacing = Math.ceil(count / MAX_PIXELS);
  const outCount = Math.floor(count / spacing);
  const out = new Float32Array(outCount * 3);
  for (let i = 0; i < outCount; i++) {
    const s = i * spacing * 3;
    const d = i * 3;
    out[d] = packed[s];
    out[d + 1] = packed[s + 1];
    out[d + 2] = packed[s + 2];
  }
  return out;
}

function farthestPointSample(
  pts: ReadonlyArray<{ x: number; y: number }>,
  n: number,
): { x: number; y: number }[] {
  if (pts.length <= n) return pts.slice();
  let s = FPS_SEED >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const picked: { x: number; y: number }[] = [
    pts[Math.floor(rand() * pts.length)],
  ];
  const minD = pts.map(() => Infinity);
  while (picked.length < n) {
    const last = picked[picked.length - 1];
    let bestI = 0;
    let bestD = -1;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - last.x;
      const dy = pts[i].y - last.y;
      const d = dx * dx + dy * dy;
      if (d < minD[i]) minD[i] = d;
      if (minD[i] > bestD) {
        bestD = minD[i];
        bestI = i;
      }
    }
    picked.push(pts[bestI]);
  }
  return picked;
}

function mul3(S: number[], v: Vec3): Vec3 {
  return [
    S[0] * v[0] + S[1] * v[1] + S[2] * v[2],
    S[3] * v[0] + S[4] * v[1] + S[5] * v[2],
    S[6] * v[0] + S[7] * v[1] + S[8] * v[2],
  ];
}

function powerEigen(S: number[], v0: Vec3): { val: number; vec: Vec3 } {
  let v = unit(v0) ?? ([1, 0, 0] as Vec3);
  for (let i = 0; i < 48; i++) {
    v = unit(mul3(S, v)) ?? v;
  }
  const w = mul3(S, v);
  return { val: v[0] * w[0] + v[1] * w[1] + v[2] * w[2], vec: v };
}

function covariance3(packed: Float32Array, count: number): number[] {
  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    mr += packed[o];
    mg += packed[o + 1];
    mb += packed[o + 2];
  }
  const inv = 1 / count;
  mr *= inv;
  mg *= inv;
  mb *= inv;
  let crr = 0;
  let cgg = 0;
  let cbb = 0;
  let crg = 0;
  let crb = 0;
  let cgb = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const dr = packed[o] - mr;
    const dg = packed[o + 1] - mg;
    const db = packed[o + 2] - mb;
    crr += dr * dr;
    cgg += dg * dg;
    cbb += db * db;
    crg += dr * dg;
    crb += dr * db;
    cgb += dg * db;
  }
  return [
    crr * inv,
    crg * inv,
    crb * inv,
    crg * inv,
    cgg * inv,
    cgb * inv,
    crb * inv,
    cgb * inv,
    cbb * inv,
  ];
}

function fitAutoFromPackedOd(packed: Float32Array, count: number): HeStainFit {
  const fallback = defaultFit();
  if (count <= 1) return fallback;
  const S = covariance3(packed, count);
  const e1 = powerEigen(S, [1, 0.4, 0.2]);
  const S2 = S.slice();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      S2[i * 3 + j] -= e1.val * e1.vec[i] * e1.vec[j];
    }
  }
  const e2 = powerEigen(S2, [0.2, 1, 0.4]);
  const phi = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const r = packed[o];
    const g = packed[o + 1];
    const b = packed[o + 2];
    phi[i] = Math.atan2(
      r * e1.vec[0] + g * e1.vec[1] + b * e1.vec[2],
      r * e2.vec[0] + g * e2.vec[1] + b * e2.vec[2],
    );
  }
  const order = new Int32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => phi[a] - phi[b]);
  const i1 = order[Math.max(0, Math.round(IGNORE * count))];
  const i2 = order[Math.min(count - 1, Math.round((1 - IGNORE) * count))];
  const p1 = unit([packed[i1 * 3], packed[i1 * 3 + 1], packed[i1 * 3 + 2]]);
  const p2 = unit([packed[i2 * 3], packed[i2 * 3 + 1], packed[i2 * 3 + 2]]);
  if (!p1 || !p2) return fallback;
  const hematoxylin = p1[0] >= p2[0] ? p1 : p2;
  const eosin = p1[0] >= p2[0] ? p2 : p1;
  if (hematoxylin[0] < eosin[0]) return fallback;
  const residual = unit(cross(hematoxylin, eosin));
  if (!residual) return fallback;
  const inverse = invert3([hematoxylin, eosin, residual]);
  const angleDeg = stainAngleDeg(hematoxylin, eosin);
  if (!inverse || angleDeg < MIN_ANGLE_DEG || angleDeg > MAX_ANGLE_DEG) {
    return fallback;
  }
  return { glslInverse: inverse };
}

function planeSize(plane: LoaderPlane): { width: number; height: number } {
  const xi = plane.labels.indexOf("x");
  const yi = plane.labels.indexOf("y");
  return {
    width: xi >= 0 ? plane.shape[xi] : 0,
    height: yi >= 0 ? plane.shape[yi] : 0,
  };
}

function asRgb8(v: number): number {
  return v > 255 ? v / 257 : v;
}

function splitInterleavedRgb8(
  data: SupportedTypedArray,
  width: number,
  height: number,
): { r: Float32Array; g: Float32Array; b: Float32Array } | null {
  const n = width * height;
  if (n <= 0 || data.length < n * 3) return null;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i * 3;
    r[i] = asRgb8(data[s]);
    g[i] = asRgb8(data[s + 1]);
    b[i] = asRgb8(data[s + 2]);
  }
  return { r, g, b };
}

function tissueFrac(
  r: ArrayLike<number>,
  g: ArrayLike<number>,
  b: ArrayLike<number>,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let n = 0;
  let t = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * w;
    for (let x = x0; x < x1; x++) {
      n++;
      if (Math.min(r[row + x], g[row + x], b[row + x]) < TISSUE_MAX) t++;
    }
  }
  return n > 0 ? t / n : 0;
}

async function readRgb(
  plane: LoaderPlane,
  channelIndex: number,
  tile?: { x: number; y: number },
  signal?: AbortSignal,
): Promise<{
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  w: number;
  h: number;
} | null> {
  const raw = tile
    ? await plane.getTile({
        x: tile.x,
        y: tile.y,
        selection: { t: 0, z: 0, c: channelIndex },
        signal,
      })
    : await plane.getRaster({
        selection: { t: 0, z: 0, c: channelIndex },
        signal,
      });
  if (!raw?.data?.length || raw.width <= 0 || raw.height <= 0) return null;
  const rgb = splitInterleavedRgb8(raw.data, raw.width, raw.height);
  if (!rgb) return null;
  return { ...rgb, w: raw.width, h: raw.height };
}

async function estimateHeStainFit(
  loader: Loader,
  channelIndex: number,
): Promise<HeStainFit> {
  try {
    const planes = loader.data;
    if (!planes?.length) return defaultFit();
    const finest = planes[0];
    const coarsest = planes[planes.length - 1];
    const { width: fineW, height: fineH } = planeSize(finest);
    const { width: coarseW, height: coarseH } = planeSize(coarsest);
    const tileSize = Math.max(1, finest.tileSize || 1024);
    if (fineW <= 0 || fineH <= 0 || coarseW <= 0 || coarseH <= 0) {
      return defaultFit();
    }

    let overview: Awaited<ReturnType<typeof readRgb>> = null;
    try {
      overview = await readRgb(coarsest, channelIndex);
    } catch {
      return defaultFit();
    }
    if (!overview) return defaultFit();
    const fallback = defaultFit();

    const sx = overview.w / fineW;
    const sy = overview.h / fineH;
    const nx = Math.ceil(fineW / tileSize);
    const ny = Math.ceil(fineH / tileSize);
    const tissueTiles: { x: number; y: number }[] = [];
    for (let ty = 0; ty < ny; ty++) {
      for (let tx = 0; tx < nx; tx++) {
        const x0 = tx * tileSize;
        const y0 = ty * tileSize;
        const x1 = Math.min(fineW, x0 + tileSize);
        const y1 = Math.min(fineH, y0 + tileSize);
        const ox0 = Math.max(0, Math.floor(x0 * sx));
        const oy0 = Math.max(0, Math.floor(y0 * sy));
        const ox1 = Math.min(overview.w, Math.max(ox0 + 1, Math.ceil(x1 * sx)));
        const oy1 = Math.min(overview.h, Math.max(oy0 + 1, Math.ceil(y1 * sy)));
        if (
          tissueFrac(
            overview.r,
            overview.g,
            overview.b,
            overview.w,
            ox0,
            oy0,
            ox1,
            oy1,
          ) >= OVERVIEW_TISSUE
        ) {
          tissueTiles.push({ x: tx, y: ty });
        }
      }
    }
    if (tissueTiles.length === 0) return fallback;

    const ranked = farthestPointSample(
      tissueTiles,
      Math.min(tissueTiles.length, MAX_READS),
    );

    const od: number[] = [];
    let accepted = 0;
    for (let i = 0; i < ranked.length && accepted < N_TILES; i += READ_BATCH) {
      const batch = ranked.slice(i, i + READ_BATCH);
      const rgbs = await Promise.all(
        batch.map(async (tile) => {
          try {
            const rgb = await readRgb(finest, channelIndex, tile);
            if (!rgb) return null;
            if (
              tissueFrac(rgb.r, rgb.g, rgb.b, rgb.w, 0, 0, rgb.w, rgb.h) <
              FULLRES_TISSUE
            ) {
              return null;
            }
            return rgb;
          } catch {
            return null;
          }
        }),
      );
      for (const rgb of rgbs) {
        if (!rgb || accepted >= N_TILES) continue;
        accepted += 1;
        box3MeanTwoPass(rgb.r, rgb.g, rgb.b, rgb.w, rgb.h);
        const n = rgb.r.length;
        for (let p = 0; p < n; p++) {
          const ro = opticalDensity(rgb.r[p]);
          const go = opticalDensity(rgb.g[p]);
          const bo = opticalDensity(rgb.b[p]);
          if (keepHeOdPixel(ro, go, bo)) od.push(ro, go, bo);
        }
      }
    }

    if (accepted === 0 || od.length < 6) return fallback;
    const packed = equalSubsamplePacked3(new Float32Array(od), od.length / 3);
    return fitAutoFromPackedOd(packed, packed.length / 3);
  } catch {
    return defaultFit();
  }
}

function unmixHe(
  inverse: GlslMat3,
  ro: number,
  go: number,
  bo: number,
): [number, number] {
  return [
    inverse[0] * ro + inverse[3] * go + inverse[6] * bo,
    inverse[1] * ro + inverse[4] * go + inverse[7] * bo,
  ];
}

function binLinear(values: number[]): number[] {
  const out = new Array<number>(HE_HIST_BINS).fill(0);
  const scale = HE_HIST_BINS / HE_HIST_MAX;
  for (const v of values) {
    if (!(v > 0)) continue;
    const t = Math.min(HE_HIST_BINS - 1, Math.floor(v * scale));
    if (t >= 0) out[t] += 1;
  }
  return out;
}

async function computeHeHistograms(
  loader: Loader,
  channelIndex: number,
  inverse: GlslMat3,
  fitKey: string,
): Promise<HeHistogram> {
  const empty: HeHistogram = { fitKey, hematoxylin: [], eosin: [] };
  const planes = loader.data;
  if (!planes?.length) return empty;
  const coarsest = planes[planes.length - 1];
  let rgb: Awaited<ReturnType<typeof readRgb>> = null;
  try {
    const signal = AbortSignal.timeout(HE_HIST_TIMEOUT_MS);
    rgb = await readRgb(coarsest, channelIndex, { x: 0, y: 0 }, signal);
  } catch {
    try {
      rgb = await readRgb(coarsest, channelIndex);
    } catch {
      return empty;
    }
  }
  if (!rgb) return empty;
  const h: number[] = [];
  const e: number[] = [];
  const n = rgb.r.length;
  for (let i = 0; i < n; i++) {
    if (i % HE_HIST_STEP !== 0) continue;
    const [ch, ce] = unmixHe(
      inverse,
      opticalDensity(rgb.r[i]),
      opticalDensity(rgb.g[i]),
      opticalDensity(rgb.b[i]),
    );
    h.push(ch * HE_HIST_MAX);
    e.push(ce * HE_HIST_MAX);
  }
  return {
    fitKey,
    hematoxylin: binLinear(h),
    eosin: binLinear(e),
  };
}

export function ensureHeHistograms(args: {
  loader: Loader;
  cacheKey: string;
  channelIndex: number;
  inverse: GlslMat3;
}): Promise<HeHistogram> {
  const fitKey = stainInverseKey(args.inverse);
  const key = `${args.cacheKey}:${fitKey}`;
  const hit = histInflight.get(key);
  if (hit) return hit;
  const p = computeHeHistograms(
    args.loader,
    args.channelIndex,
    args.inverse,
    fitKey,
  );
  histInflight.set(key, p);
  return p;
}
