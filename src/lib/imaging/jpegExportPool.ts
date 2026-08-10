import type { JpegExportTransfer } from "./cubeRootEncoding";
import {
  copyPixelBuffer,
  encodeGrayscaleJpeg,
  JPEG_EXPORT_QUALITY,
  typedArrayCtorName,
} from "./jpegExportEncode";
import JpegExportWorker from "./workers/jpegExport.worker?worker";

/** Cap WASM workers so MozJPEG memory stays bounded. */
const MAX_JPEG_EXPORT_WORKERS = 8;
const defaultPoolSize = Math.min(
  MAX_JPEG_EXPORT_WORKERS,
  globalThis?.navigator?.hardwareConcurrency ?? 4,
);

/**
 * Same job protocol as the decoder {@link Pool} (`submitJob` / `jobId`).
 */
class WorkerWrapper {
  worker: Worker;
  private jobIdCounter = 0;
  private jobs = new Map<
    number,
    {
      resolve: (v: { jpeg: ArrayBuffer }) => void;
      reject: (e: unknown) => void;
    }
  >();

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", (e) => this.onWorkerMessage(e));
  }

  getJobCount() {
    return this.jobs.size;
  }

  private onWorkerMessage(e: MessageEvent) {
    const { jobId, error, ...result } = e.data as {
      jobId: number;
      error?: string;
      jpeg?: ArrayBuffer;
    };
    const job = this.jobs.get(jobId);
    this.jobs.delete(jobId);
    if (!job) return;

    if (error) job.reject(new Error(error));
    else if (result.jpeg) job.resolve({ jpeg: result.jpeg });
    else job.reject(new Error("jpegExport worker returned empty result"));
  }

  submitJob(message: object, transferables?: Transferable[]) {
    const jobId = this.jobIdCounter++;
    const promise = new Promise<{ jpeg: ArrayBuffer }>((resolve, reject) => {
      this.jobs.set(jobId, { resolve, reject });
    });
    this.worker.postMessage({ ...message, jobId }, transferables);
    return promise;
  }

  private rejectAllPending(reason: Error) {
    for (const job of this.jobs.values()) {
      job.reject(reason);
    }
    this.jobs.clear();
  }

  terminate() {
    this.rejectAllPending(new Error("JpegExportPool destroyed"));
    this.worker.terminate();
  }
}

/**
 * JPEG export encode pool: same shape as the decoder {@link Pool}
 * (`encode` / `destroy`), least-loaded worker selection.
 */
export class JpegExportPool {
  private workerWrappers: Promise<WorkerWrapper[]> | null = null;
  readonly size: number;

  constructor(
    size = defaultPoolSize,
    createWorker: () => Worker = () => new JpegExportWorker(),
  ) {
    this.size = size;
    if (size) {
      this.workerWrappers = (async () => {
        const wrappers: WorkerWrapper[] = [];
        for (let i = 0; i < size; i++) {
          wrappers.push(new WorkerWrapper(createWorker()));
        }
        return wrappers;
      })();
    }
  }

  async encode(
    width: number,
    height: number,
    buffer: ArrayBuffer,
    arrayCtorName: string,
    lowerLimit: number,
    upperLimit: number,
    quality = JPEG_EXPORT_QUALITY,
    transfer: JpegExportTransfer = "contrast",
  ): Promise<ArrayBuffer> {
    const workerWrappersPromise = this.workerWrappers;
    if (!workerWrappersPromise) {
      throw new Error("JpegExportPool has no workers");
    }
    const wrappers = await workerWrappersPromise;
    const workerWrapper = wrappers.reduce((a, b) =>
      a.getJobCount() < b.getJobCount() ? a : b,
    );
    const { jpeg } = await workerWrapper.submitJob(
      {
        width,
        height,
        buffer,
        arrayCtorName,
        lowerLimit,
        upperLimit,
        quality,
        transfer,
      },
      [buffer],
    );
    return jpeg;
  }

  async destroy() {
    if (!this.workerWrappers) return;
    const wrappers = await this.workerWrappers;
    this.workerWrappers = null;
    for (const w of wrappers) {
      w.terminate();
    }
  }
}

let singleton: JpegExportPool | null = null;

function workersSupported(): boolean {
  return typeof Worker !== "undefined";
}

export function getJpegExportPool(): JpegExportPool | null {
  if (!workersSupported()) return null;
  if (!singleton) {
    singleton = new JpegExportPool();
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
  transfer?: JpegExportTransfer;
};

/**
 * Prefer workers; fall back to main-thread @jsquash/jpeg encode if workers
 * are unavailable or fail.
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
    transfer = "contrast",
  } = input;
  const pool = getJpegExportPool();
  if (pool) {
    try {
      const copy = copyPixelBuffer(data);
      return await pool.encode(
        width,
        height,
        copy,
        typedArrayCtorName(data),
        lowerLimit,
        upperLimit,
        quality,
        transfer,
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
    transfer,
  );
}

/** In-flight tile count for parallel export (matches encode pool size). */
export function jpegExportConcurrency(): number {
  const pool = getJpegExportPool();
  if (pool) return pool.size;
  return defaultPoolSize;
}
