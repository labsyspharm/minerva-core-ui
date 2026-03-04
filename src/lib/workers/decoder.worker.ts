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

worker.addEventListener("message", async (e: Message) => {
  const { jobId, fileDirectory, buffer } = e.data;
  const decoder = await getDecoder(fileDirectory);
  const decoded = await decoder.decode(fileDirectory, buffer);
  worker.postMessage({ decoded, jobId }, [decoded]);
});
