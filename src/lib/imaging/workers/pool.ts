import { getDecoder } from "geotiff";
import DecoderWorker from "./decoder.worker?worker";

export declare class PoolClass {
  constructor(
    size?: number | undefined,
    createWorker?: (() => Worker) | undefined,
  );
  decode(fileDirectory: unknown, buffer: ArrayBuffer): Promise<ArrayBuffer>;
  destroy(): Promise<void>;
}

/**
 * Same job protocol as geotiff.js Pool (`submitJob` / `jobId`); inlined so we do not
 * subclass geotiff's Pool (avoids preferWorker skipping workers for raw/uncompressed).
 *
 * @see https://github.com/geotiffjs/geotiff.js/blob/master/src/pool.js
 */
class WorkerWrapper {
  worker: Worker;
  private jobIdCounter = 0;
  private jobs = new Map<
    number,
    {
      resolve: (v: { decoded: ArrayBuffer }) => void;
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
      decoded?: ArrayBuffer;
    };
    const job = this.jobs.get(jobId);
    this.jobs.delete(jobId);
    if (!job) return;

    if (error) job.reject(new Error(error));
    else job.resolve(result as { decoded: ArrayBuffer });
  }

  submitJob(message: object, transferables?: Transferable[]) {
    const jobId = this.jobIdCounter++;
    const promise = new Promise<{ decoded: ArrayBuffer }>((resolve, reject) => {
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
    this.rejectAllPending(new Error("Decoder pool destroyed"));
    this.worker.terminate();
  }
}

// https://developer.mozilla.org/en-US/docs/Web/API/NavigatorConcurrentHardware/hardwareConcurrency
const defaultPoolSize = globalThis?.navigator?.hardwareConcurrency ?? 4;

/**
 * Decoder pool for geotiff.js: same surface as `geotiff`’s default Pool (`decode` /
 * `destroy`) but always sends work to {@link DecoderWorker} when `size > 0`.
 */
class Pool {
  private workerWrappers: Promise<WorkerWrapper[]> | null = null;

  constructor(
    size = defaultPoolSize,
    createWorker: () => Worker = () => new DecoderWorker(),
  ) {
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

  async decode(fileDirectory: unknown, buffer: ArrayBuffer) {
    // Snapshot promise: destroy() may set workerWrappers null before await runs.
    const workerWrappersPromise = this.workerWrappers;
    if (workerWrappersPromise) {
      const wrappers = await workerWrappersPromise;
      const workerWrapper = wrappers.reduce((a, b) =>
        a.getJobCount() < b.getJobCount() ? a : b,
      );
      const { decoded } = await workerWrapper.submitJob(
        { fileDirectory, buffer },
        [buffer],
      );
      return decoded;
    }

    const decoder = await getDecoder(fileDirectory as { Compression: number });
    return await decoder.decode(fileDirectory, buffer);
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

export { Pool };
