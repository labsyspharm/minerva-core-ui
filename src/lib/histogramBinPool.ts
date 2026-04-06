import { histogramBinFromPixels } from "@/lib/histogramBin";

type OutMsg = {
  jobId: number;
  y: number[];
  error?: string;
};

const poolSize = () =>
  Math.min(4, Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 4));

export class HistogramBinPool {
  private workers: Worker[] = [];
  private pending = new Map<
    number,
    { resolve: (y: number[]) => void; reject: (e: unknown) => void }
  >();
  private nextId = 1;
  private rr = 0;

  constructor(size: number) {
    const url = new URL("./workers/histogram.worker.ts", import.meta.url);
    for (let i = 0; i < size; i++) {
      const w = new Worker(url, { type: "module" });
      w.onmessage = (ev: MessageEvent<OutMsg>) => {
        const { jobId, y, error } = ev.data;
        const p = this.pending.get(jobId);
        if (!p) return;
        this.pending.delete(jobId);
        if (error) p.reject(new Error(error));
        else p.resolve(y);
      };
      w.onmessageerror = (ev) => {
        console.warn("[minerva] histogram worker messageerror:", ev);
      };
      this.workers.push(w);
    }
  }

  run(
    bits: number,
    width: number,
    buffer: ArrayBuffer,
    arrayCtorName: string,
  ): Promise<number[]> {
    const jobId = this.nextId++;
    const w = this.workers[this.rr++ % this.workers.length];
    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject });
      w.postMessage({ jobId, bits, width, buffer, arrayCtorName }, [buffer]);
    });
  }
}

let singleton: HistogramBinPool | null = null;

export function getHistogramBinPool(): HistogramBinPool | null {
  if (typeof Worker === "undefined") return null;
  if (!singleton) {
    singleton = new HistogramBinPool(poolSize());
  }
  return singleton;
}

/**
 * Prefer workers; fall back to main-thread `histogramBinFromPixels` if workers are unavailable or fail.
 */
export async function histogramBinTile(
  bits: number,
  width: number,
  data: ArrayLike<number> & {
    buffer: ArrayBuffer;
    byteOffset: number;
    byteLength: number;
  },
): Promise<number[]> {
  const pool = getHistogramBinPool();
  if (pool) {
    try {
      const copy = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      );
      return await pool.run(bits, width, copy, data.constructor.name);
    } catch (err) {
      console.warn(
        "[minerva] histogram worker failed, using main thread:",
        err,
      );
    }
  }
  return histogramBinFromPixels(bits, width, data);
}
