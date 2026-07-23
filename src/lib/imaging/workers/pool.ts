import { GeoTIFFImage, getDecoder } from "geotiff";
import DecoderWorker from "./decoder.worker.ts?worker";

export declare class PoolClass {
  constructor(
    size?: number | undefined,
    createWorker?: (() => Worker) | undefined,
  );
  decode(
    fileDirectory: unknown,
    buffer: ArrayBuffer,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer>;
  destroy(): Promise<void>;
}

export const POOL_JOB_ABORTED = "__vivSignalAborted";

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
      discarded: boolean;
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
    if (job.discarded) {
      // Aborted tile: drop decoded bytes so they never reach GPU upload.
      return;
    }

    if (error) job.reject(new Error(error));
    else job.resolve(result as { decoded: ArrayBuffer });
  }

  submitJob(message: object, transferables?: Transferable[]) {
    const jobId = this.jobIdCounter++;
    const promise = new Promise<{ decoded: ArrayBuffer }>((resolve, reject) => {
      this.jobs.set(jobId, { resolve, reject, discarded: false });
    });
    this.worker.postMessage({ ...message, jobId }, transferables);
    return { jobId, promise };
  }

  /** Reject waiter early; late worker results are dropped. */
  discardJob(jobId: number, reason: unknown = POOL_JOB_ABORTED) {
    const job = this.jobs.get(jobId);
    if (!job || job.discarded) return;
    job.discarded = true;
    job.reject(reason);
  }

  private rejectAllPending(reason: Error) {
    for (const job of this.jobs.values()) {
      if (!job.discarded) {
        job.discarded = true;
        job.reject(reason);
      }
    }
    this.jobs.clear();
  }

  terminate() {
    this.rejectAllPending(new Error("Decoder pool destroyed"));
    this.worker.terminate();
  }
}

const defaultPoolSize = globalThis?.navigator?.hardwareConcurrency ?? 4;

/**
 * Decoder pool for geotiff.js. Optional AbortSignal skips already-pruned tiles and
 * rejects mid-flight waiters early (worker may still finish; result is dropped).
 * {@link installGeotiffPoolAbortBridge} clears geotiff's promise cache on abort.
 */
class Pool {
  private workerWrappers: Promise<WorkerWrapper[]> | null = null;

  constructor(
    size = defaultPoolSize,
    createWorker: () => Worker = () => new DecoderWorker(),
  ) {
    installGeotiffPoolAbortBridge();
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

  async decode(
    fileDirectory: unknown,
    buffer: ArrayBuffer,
    signal?: AbortSignal,
  ) {
    if (signal?.aborted) {
      throw POOL_JOB_ABORTED;
    }

    const workerWrappersPromise = this.workerWrappers;
    if (workerWrappersPromise) {
      const wrappers = await workerWrappersPromise;
      if (signal?.aborted) {
        throw POOL_JOB_ABORTED;
      }
      const workerWrapper = wrappers.reduce((a, b) =>
        a.getJobCount() < b.getJobCount() ? a : b,
      );
      const { jobId, promise } = workerWrapper.submitJob(
        { fileDirectory, buffer },
        [buffer],
      );
      // Suppress unhandled rejection if abort discards after race settles.
      promise.catch(() => undefined);

      let onAbort: (() => void) | undefined;
      const abortPromise = new Promise<never>((_, reject) => {
        if (!signal) return;
        onAbort = () => {
          workerWrapper.discardJob(jobId, POOL_JOB_ABORTED);
          reject(POOL_JOB_ABORTED);
        };
        signal.addEventListener("abort", onAbort, { once: true });
      });

      try {
        const { decoded } = await Promise.race([promise, abortPromise]);
        if (signal?.aborted) {
          throw POOL_JOB_ABORTED;
        }
        return decoded;
      } finally {
        if (signal && onAbort) {
          signal.removeEventListener("abort", onAbort);
        }
      }
    }

    if (signal?.aborted) {
      throw POOL_JOB_ABORTED;
    }
    const decoder = await getDecoder(fileDirectory as { Compression: number });
    if (signal?.aborted) {
      throw POOL_JOB_ABORTED;
    }
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

type PoolLike = {
  decode: (
    fileDirectory: unknown,
    buffer: ArrayBuffer,
    signal?: AbortSignal,
  ) => Promise<ArrayBuffer>;
};

type GetTileOrStripFn = (
  this: {
    tiles?: (Promise<unknown> | null | undefined)[] | null;
    planarConfiguration: number;
    getWidth: () => number;
    getHeight: () => number;
    getTileWidth: () => number;
    getTileHeight: () => number;
  },
  x: number,
  y: number,
  sample: number,
  poolOrDecoder: PoolLike | { decode: PoolLike["decode"] },
  signal?: AbortSignal,
) => Promise<unknown>;

let geotiffAbortBridgeInstalled = false;

function tileCacheIndex(
  image: {
    planarConfiguration: number;
    getWidth: () => number;
    getHeight: () => number;
    getTileWidth: () => number;
    getTileHeight: () => number;
  },
  x: number,
  y: number,
  sample: number,
): number {
  const numTilesPerRow = Math.ceil(image.getWidth() / image.getTileWidth());
  const numTilesPerCol = Math.ceil(image.getHeight() / image.getTileHeight());
  if (image.planarConfiguration === 2) {
    return sample * numTilesPerRow * numTilesPerCol + y * numTilesPerRow + x;
  }
  return y * numTilesPerRow + x;
}

/**
 * geotiff fetches with AbortSignal but does not forward it to pool.decode.
 * Wrap decode so we can skip already-aborted tiles and clear poisoned cache entries.
 */
export function installGeotiffPoolAbortBridge(): void {
  if (geotiffAbortBridgeInstalled) return;
  geotiffAbortBridgeInstalled = true;

  const proto = (
    GeoTIFFImage as unknown as {
      prototype: { getTileOrStrip: GetTileOrStripFn };
    }
  ).prototype;
  if (!proto?.getTileOrStrip) return;

  const original = proto.getTileOrStrip;
  proto.getTileOrStrip = async function getTileOrStrip(
    x,
    y,
    sample,
    poolOrDecoder,
    signal,
  ) {
    const run =
      poolOrDecoder && typeof (poolOrDecoder as PoolLike).decode === "function"
        ? () => {
            const inner = poolOrDecoder as PoolLike;
            const wrapped: PoolLike = {
              decode: (fileDirectory, buffer, decodeSignal) =>
                inner.decode(fileDirectory, buffer, decodeSignal ?? signal),
            };
            return original.call(this, x, y, sample, wrapped, signal);
          }
        : () => original.call(this, x, y, sample, poolOrDecoder, signal);

    try {
      return await run();
    } catch (err) {
      if ((err === POOL_JOB_ABORTED || signal?.aborted) && this.tiles != null) {
        const index = tileCacheIndex(this, x, y, sample);
        this.tiles[index] = undefined;
      }
      throw err;
    }
  };
}

export { Pool };
