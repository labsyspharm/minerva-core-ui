import { histogramBinFromPixels } from "@/lib/histogramBin";

type InMsg = {
  jobId: number;
  bits: number;
  width: number;
  buffer: ArrayBuffer;
  arrayCtorName: string;
};

const CTORS: Record<string, new (buf: ArrayBuffer) => ArrayLike<number>> = {
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Float32Array,
  Float64Array,
};

type WorkerGlobal = typeof globalThis & {
  onmessage: ((e: MessageEvent<InMsg>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const w = globalThis as WorkerGlobal;

w.onmessage = (e: MessageEvent<InMsg>) => {
  const { jobId, bits, width, buffer, arrayCtorName } = e.data;
  try {
    const Ctor = CTORS[arrayCtorName];
    if (!Ctor) {
      throw new Error(`histogram.worker: unsupported array ${arrayCtorName}`);
    }
    const view = new Ctor(buffer);
    const y = histogramBinFromPixels(bits, width, view);
    w.postMessage({ jobId, y });
  } catch (err) {
    w.postMessage({
      jobId,
      y: [] as number[],
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
