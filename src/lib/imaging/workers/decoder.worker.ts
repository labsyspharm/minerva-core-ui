import { getDecoder } from "geotiff";
import { registerLzwDecoder } from "./decoders";

registerLzwDecoder();

// @ts-expect-error - We are in a worker context
const worker: ServiceWorker = self;

type FileDirectory = {
  TileWidth: number;
  TileLength: number;
  BitsPerSample: number[];
};

type MessageData = {
  jobId: number;
  fileDirectory: FileDirectory;
  buffer: ArrayBuffer;
};
type Message = MessageEvent & {
  data: MessageData;
};

worker.addEventListener("message", async (e: Message) => {
  const { jobId, fileDirectory, buffer } = e.data;
  try {
    const decoder = await getDecoder(fileDirectory);
    const decoded = await decoder.decode(fileDirectory, buffer);
    worker.postMessage({ decoded, jobId }, [decoded]);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    worker.postMessage({ error, jobId });
  }
});
