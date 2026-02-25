import { addDecoder, Pool as GeotiffPool, getDecoder } from "geotiff";
import { LZWDecoder } from "./decoders";

// Register the LZW decoder
addDecoder(5, () => Promise.resolve(LZWDecoder));

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

// https://developer.mozilla.org/en-US/docs/Web/API/NavigatorConcurrentHardware/hardwareConcurrency
// We need to give a different way of getting this for safari, so 4 is probably a safe bet
// for parallel processing in the meantime.  More can't really hurt since they'll just block
// each other and not the UI thread, which is the real benefit.
const defaultPoolSize = globalThis?.navigator?.hardwareConcurrency ?? 4;

async function defaultDecoderParameterFn(fileDirectory) {
  // TODO -- using v2.0 fileDirectory
  return {
    tileWidth: fileDirectory.TileWidth,
    tileHeight: fileDirectory.TileLength,
    planarConfiguration: 1,
    bitsPerSample: await fileDirectory.BitsPerSample,
    predictor: 1,
  };
}

class Pool extends GeotiffPool {
  workers: null;
  _awaitingDecoder: null;
  size: 1;
  messageId: 0;

  constructor(numWorkers = 1) {
    super(numWorkers || defaultPoolSize);
  }

  async decode(fileDirectory, buffer) {
    const compression = fileDirectory.Compression;
    const params = await defaultDecoderParameterFn(fileDirectory);
    const decoder = await getDecoder(compression, params);
    const decoded = await decoder.decode(buffer);
    return decoded;
  }

  async destroy() {
    super.destroy();
  }
}

export { Pool };
