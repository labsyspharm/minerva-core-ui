import {
  encodeGrayscaleJpeg,
  JPEG_EXPORT_QUALITY,
  PIXEL_CTORS,
} from "../jpegExportEncode";

export type JpegExportInMsg = {
  jobId: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  arrayCtorName: string;
  lowerLimit: number;
  upperLimit: number;
  quality?: number;
};

export type JpegExportOutMsg = {
  jobId: number;
  jpeg?: ArrayBuffer;
  error?: string;
};

type WorkerGlobal = typeof globalThis & {
  onmessage: ((e: MessageEvent<JpegExportInMsg>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const w = globalThis as WorkerGlobal;

w.onmessage = async (e: MessageEvent<JpegExportInMsg>) => {
  const {
    jobId,
    width,
    height,
    buffer,
    arrayCtorName,
    lowerLimit,
    upperLimit,
    quality = JPEG_EXPORT_QUALITY,
  } = e.data;
  try {
    const Ctor = PIXEL_CTORS[arrayCtorName];
    if (!Ctor) {
      throw new Error(`jpegExport.worker: unsupported array ${arrayCtorName}`);
    }
    const pixels = new Ctor(buffer);
    const jpeg = await encodeGrayscaleJpeg(
      width,
      height,
      pixels,
      lowerLimit,
      upperLimit,
      quality,
    );
    w.postMessage({ jobId, jpeg } satisfies JpegExportOutMsg, [jpeg]);
  } catch (err) {
    w.postMessage({
      jobId,
      error: err instanceof Error ? err.message : String(err),
    } satisfies JpegExportOutMsg);
  }
};
