import type { JpegExportTransfer } from "../cubeRootEncoding";
import {
  encodeGrayscaleJpeg,
  ensureJpegEncoderReady,
  JPEG_EXPORT_QUALITY,
  PIXEL_CTORS,
} from "../jpegExportEncode";

type MessageData = {
  jobId: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  arrayCtorName: string;
  lowerLimit: number;
  upperLimit: number;
  quality?: number;
  transfer?: JpegExportTransfer;
  padTileWidth?: number;
  padTileLength?: number;
};

type Message = MessageEvent & {
  data: MessageData;
};

// @ts-expect-error - We are in a worker context
const worker: ServiceWorker = self;

void ensureJpegEncoderReady().catch((err) => {
  console.warn("[minerva] jpegExport worker encoder init failed:", err);
});

worker.addEventListener("message", async (e: Message) => {
  const {
    jobId,
    width,
    height,
    buffer,
    arrayCtorName,
    lowerLimit,
    upperLimit,
    quality = JPEG_EXPORT_QUALITY,
    transfer = "contrast",
    padTileWidth,
    padTileLength,
  } = e.data;
  try {
    const Ctor = PIXEL_CTORS[arrayCtorName];
    if (!Ctor) {
      throw new Error(`unsupported pixel array ${arrayCtorName}`);
    }
    const pixels = new Ctor(buffer);
    const jpeg = await encodeGrayscaleJpeg(
      width,
      height,
      pixels,
      lowerLimit,
      upperLimit,
      quality,
      transfer,
      padTileWidth,
      padTileLength,
    );
    worker.postMessage({ jpeg, jobId }, [jpeg]);
  } catch (err) {
    worker.postMessage({
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
