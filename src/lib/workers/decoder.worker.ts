import { addDecoder, getDecoder } from "geotiff";
import { LZWDecoder } from "./decoders";

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
  fileDirectory: FileDirectory;
  buffer: ArrayBuffer;
}
type Message = MessageEvent & {
  data: MessageData;
}

async function defaultDecoderParameterFn(fileDirectory) {
  // TODO -- using v2.0 fileDirectory
  return {
    tileWidth: fileDirectory.TileWidth,
    tileHeight: fileDirectory.TileLength,
    planarConfiguration: 1,
    bitsPerSample: await fileDirectory.BitsPerSample,
    predictor: 1
  };
}

worker.addEventListener("message", async (e: Message) => {
  const { jobId, fileDirectory, buffer } = e.data;
  const params = await defaultDecoderParameterFn(
    fileDirectory
  );
  const decoder = await getDecoder(fileDirectory, params);
  const decoded = await decoder.decode(buffer);
  worker.postMessage({ decoded, jobId }, [decoded]);
});
