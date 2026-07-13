import {
  copyPixelBuffer,
  encodeGrayscaleJpeg,
  JPEG_EXPORT_QUALITY,
  typedArrayCtorName,
} from "./jpegExportEncode";
import type { JpegExportOutMsg } from "./workers/jpegExport.worker";
import JpegExportWorker from "./workers/jpegExport.worker.ts?worker";

const poolSize = () => globalThis.navigator?.hardwareConcurrency ?? 4;

export class JpegExportPool {
  private workers: Worker[] = [];
  private pending = new Map<
    number,
    { resolve: (jpeg: ArrayBuffer) => void; reject: (e: unknown) => void }
  >();
  private nextId = 1;
  private rr = 0;

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const w = new JpegExportWorker();
      w.onmessage = (ev: MessageEvent<JpegExportOutMsg>) => {
        const { jobId, jpeg, error } = ev.data;
        const p = this.pending.get(jobId);
        if (!p) return;
        this.pending.delete(jobId);
        if (error) p.reject(new Error(error));
        else if (jpeg) p.resolve(jpeg);
        else p.reject(new Error("jpegExport worker returned empty result"));
      };
      w.onmessageerror = (ev) => {
        console.warn("[minerva] jpegExport worker messageerror:", ev);
      };
      this.workers.push(w);
    }
  }

  get size() {
    return this.workers.length;
  }

  run(
    width: number,
    height: number,
    buffer: ArrayBuffer,
    arrayCtorName: string,
    lowerLimit: number,
    upperLimit: number,
    quality = JPEG_EXPORT_QUALITY,
  ): Promise<ArrayBuffer> {
    const jobId = this.nextId++;
    const w = this.workers[this.rr++ % this.workers.length];
    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject });
      w.postMessage(
        {
          jobId,
          width,
          height,
          buffer,
          arrayCtorName,
          lowerLimit,
          upperLimit,
          quality,
        },
        [buffer],
      );
    });
  }

  destroy() {
    for (const p of this.pending.values()) {
      p.reject(new Error("JpegExportPool destroyed"));
    }
    this.pending.clear();
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
  }
}

let singleton: JpegExportPool | null = null;

function workersSupported(): boolean {
  return (
    typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
  );
}

export function getJpegExportPool(): JpegExportPool | null {
  if (!workersSupported()) return null;
  if (!singleton) {
    singleton = new JpegExportPool(poolSize());
  }
  return singleton;
}

export type EncodeTilePixelsIn = {
  width: number;
  height: number;
  data: ArrayLike<number> & {
    buffer: ArrayBufferLike;
    byteOffset: number;
    byteLength: number;
  };
  lowerLimit: number;
  upperLimit: number;
  quality?: number;
};

/**
 * Prefer workers; fall back to main-thread canvas encode if workers are
 * unavailable or fail.
 */
export async function encodeTileJpeg(
  input: EncodeTilePixelsIn,
): Promise<ArrayBuffer> {
  const {
    width,
    height,
    data,
    lowerLimit,
    upperLimit,
    quality = JPEG_EXPORT_QUALITY,
  } = input;
  const pool = getJpegExportPool();
  if (pool) {
    try {
      const copy = copyPixelBuffer(data);
      return await pool.run(
        width,
        height,
        copy,
        typedArrayCtorName(data),
        lowerLimit,
        upperLimit,
        quality,
      );
    } catch (err) {
      console.warn(
        "[minerva] jpegExport worker failed, using main thread:",
        err,
      );
    }
  }
  return encodeGrayscaleJpeg(
    width,
    height,
    data,
    lowerLimit,
    upperLimit,
    quality,
  );
}

/** In-flight tile count for parallel export (matches encode pool size). */
export function jpegExportConcurrency(): number {
  const pool = getJpegExportPool();
  if (pool) return pool.size;
  return poolSize();
}
