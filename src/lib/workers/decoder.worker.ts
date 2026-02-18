import { addDecoder, getDecoder } from "geotiff";
import { LZWDecoder } from "./decoders";

import type { PoolClass } from './Pool';

// Register the LZW decoder
addDecoder(5, () => Promise.resolve(LZWDecoder));

// @ts-expect-error - We are in a worker context
const worker: ServiceWorker = self;

type FileDirectory = {
  TileWidth: number;
  TileLength: number;
  BitsPerSample: number[];
}

type MessageData = {
  jobId: number;
  pool: PoolClass;
  fileDirectory: FileDirectory;
  buffer: ArrayBuffer;
}
type Message = MessageEvent & {
  data: MessageData;
}

async function defaultDecoderParameterFn(fileDirectory) {
  const isTiled = !fileDirectory.hasTag('StripOffsets');
  return /** @type {BaseDecoderParameters} */ ({
    tileWidth: isTiled
      ? await fileDirectory.loadValue('TileWidth')
      : await fileDirectory.loadValue('ImageWidth'),
    tileHeight: isTiled
      ? await fileDirectory.loadValue('TileLength')
      : (
        await fileDirectory.loadValue('RowsPerStrip')
        || await fileDirectory.loadValue('ImageLength')
      ),
    planarConfiguration: await fileDirectory.loadValue('PlanarConfiguration'),
    bitsPerSample: await fileDirectory.loadValue('BitsPerSample'),
    predictor: await fileDirectory.loadValue('Predictor') || 1,
  });
}

worker.addEventListener("message", async (e: Message) => {
  const { jobId, fileDirectory, buffer, pool } = e.data;
  const compression = fileDirectory.getValue('Compression');
  //const params = await getDecoderParameters(compression, fileDirectory);
  const params = await defaultDecoderParameterFn(fileDirectory);
  const boundPool = pool.bindParameters(compression, params);
  const decoded = await boundPool.decode(buffer);
  worker.postMessage({ decoded, jobId }, [decoded]);
});
