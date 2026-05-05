import type { SaveIn } from "@/lib/export/save";
import { save as save_main_thread } from "@/lib/export/save";

type InMsg = SaveIn & {
  jobId: number;
};

type WorkerGlobal = typeof globalThis & {
  onmessage: ((e: MessageEvent<InMsg>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const w = globalThis as WorkerGlobal;

w.onmessage = (e: MessageEvent<InMsg>) => {
  const { jobId, index, getters, directory_handle } = e.data;
  try {
    save_main_thread({
      index,
      getters,
      directory_handle,
    });
    w.postMessage({ jobId });
  } catch (err) {
    w.postMessage({
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
