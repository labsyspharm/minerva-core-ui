import { Pool as GeotiffPool } from "geotiff";
import DecoderWorker from "./decoder.worker.ts?worker";

export declare class PoolClass {
  /**
   * @constructor
   * @param {Number}
   * @param {function(): Worker}
   */
  constructor(
    size?: number | undefined,
    createWorker?: (() => Worker) | undefined,
  );
  workers: null;
  _awaitingDecoder: null;
  size: number;
  messageId: number;
  decode(fileDirectory: unknown, buffer: ArrayBuffer): Promise<ArrayBuffer>;
  destroy(): void;
}

// adapted from https://github.com/hms-dbmi/viv/blob/08a74203b99f54bc62307c741944ed61e33e810c/packages/loaders/src/tiff/lib/Pool.ts#L4

const defaultPoolSize = globalThis?.navigator?.hardwareConcurrency ?? 1;

function createWorker() {
  return new DecoderWorker();
}

class Pool extends GeotiffPool {
  workers: null;
  _awaitingDecoder: null;
  size: 1;
  messageId: 0;

  constructor(numWorkers = defaultPoolSize) {
    super(numWorkers, createWorker);
  }

  decode(fileDirectory, buffer) {
    return super.decode(fileDirectory, buffer);
  }

  async destroy() {
    super.destroy();
  }
}

export { Pool };
