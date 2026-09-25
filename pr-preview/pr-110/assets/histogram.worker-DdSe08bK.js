const HISTOGRAM_BIN_COUNT = 100;
const MAX_HISTOGRAM_TILE_PIXELS = 4e6;
function intensityToHistogramBin(v, bits) {
  const n = HISTOGRAM_BIN_COUNT;
  if (bits <= 8) {
    return Math.min(n - 1, Math.floor(v * n / 2 ** bits));
  }
  return Math.min(n - 1, Math.floor(n * Math.log2(v) / bits));
}
function histogramBinFromPixels(bits, width, data) {
  const len = data.length;
  if (len === 0 || len > MAX_HISTOGRAM_TILE_PIXELS) return [];
  const counts = new Array(HISTOGRAM_BIN_COUNT).fill(0);
  const step = 4;
  const w = Math.max(1, width);
  for (let i = 0; i < len; i++) {
    if (i % step !== 0 && Math.floor(i / w) % step !== 0) continue;
    const v = data[i];
    if (!(v > 0)) continue;
    counts[intensityToHistogramBin(v, bits)]++;
  }
  return counts;
}

const CTORS = {
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Float32Array,
  Float64Array
};
const w = globalThis;
w.onmessage = (e) => {
  const { jobId, bits, width, buffer, arrayCtorName } = e.data;
  try {
    const Ctor = CTORS[arrayCtorName];
    if (!Ctor) {
      throw new Error(`histogram.worker: unsupported array ${arrayCtorName}`);
    }
    const view = new Ctor(buffer);
    const y = histogramBinFromPixels(bits, width, view);
    w.postMessage({ jobId, y });
  } catch (err) {
    w.postMessage({
      jobId,
      y: [],
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
