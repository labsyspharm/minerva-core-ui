function histogramBinFromPixels(bits, width, data) {
  const n_bins = 50;
  const max_power = bits;
  const thresholds = [
    ...new Set(
      [...new Array(n_bins).keys()].map((x) => {
        return Math.floor(2 ** (max_power * x / n_bins));
      })
    )
  ];
  thresholds.sort((a, b) => a - b);
  const step = 4;
  const len = data.length;
  let indices = [...new Array(len).keys()].filter((i) => i % step === 0 || Math.floor(i / width) % step === 0).filter((i) => data[i] > 0);
  return thresholds.reduce((binned, threshold, t) => {
    if (t > 0 && thresholds[t - 1] === threshold) {
      return binned.concat(binned.slice(-1));
    }
    const outside_indices = indices.filter((i) => data[i] > threshold);
    const pixel_count = indices.length - outside_indices.length;
    indices = outside_indices;
    binned.push(pixel_count);
    return binned;
  }, []);
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
