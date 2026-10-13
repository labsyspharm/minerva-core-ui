import { getDecoder } from "geotiff";
import { expandThroughLut } from "../expandThroughLut";
import { registerJpegDecoder, registerLzwDecoder } from "./decoders";

registerLzwDecoder();
registerJpegDecoder();

// @ts-expect-error - We are in a worker context
const worker: ServiceWorker = self;

type FileDirectory = {
  TileWidth: number;
  TileLength: number;
  BitsPerSample: number[];
  /** Set by `OmeDecodePool.decodeWidened`: return uint16 through this table. */
  MinervaWidenLut?: Uint16Array;
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
    const raw = await decoder.decode(fileDirectory, buffer);
    const lut = fileDirectory.MinervaWidenLut;
    const decoded = lut
      ? expandThroughLut(new Uint8Array(raw), lut).buffer
      : raw;
    worker.postMessage({ decoded, jobId }, [decoded]);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    worker.postMessage({ error, jobId });
  }
});
