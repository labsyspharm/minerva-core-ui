const MAX_HISTOGRAM_TILE_PIXELS = 4e6;
function histogramBinFromPixels(bits, width, data) {
  const len = data.length;
  if (len === 0 || len > MAX_HISTOGRAM_TILE_PIXELS) return [];
  const n_bins = 100;
  const seen = /* @__PURE__ */ new Set();
  const thresholds = [];
  for (let x = 0; x < n_bins; x++) {
    const t = Math.floor(2 ** (bits * x / n_bins));
    if (seen.has(t)) continue;
    seen.add(t);
    thresholds.push(t);
  }
  thresholds.sort((a, b) => a - b);
  const counts = new Array(thresholds.length).fill(0);
  const step = 4;
  const w = Math.max(1, width);
  const nTh = thresholds.length;
  for (let i = 0; i < len; i++) {
    if (i % step !== 0 && Math.floor(i / w) % step !== 0) continue;
    const v = data[i];
    if (!(v > 0)) continue;
    let lo = 0;
    let hi = nTh;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (v <= thresholds[mid]) hi = mid;
      else lo = mid + 1;
    }
    if (lo < nTh) counts[lo]++;
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
