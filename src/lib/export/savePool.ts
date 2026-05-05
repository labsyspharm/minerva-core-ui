import type { Save, SaveIn } from "./save";
import { save as save_main_thread } from "./save";

type OutMsg = {
  jobId: number;
  error?: string;
};

const poolSize = () =>
  Math.min(4, Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 4));

export class SavePool {
  private workers: Worker[] = [];
  private pending = new Map<
    number,
    { resolve: () => void; reject: (e: unknown) => void }
  >();
  private nextId = 1;
  private rr = 0;

  constructor(size: number) {
    const url = new URL("./workers/save.worker.ts", import.meta.url);
    for (let i = 0; i < size; i++) {
      const w = new Worker(url, { type: "module" });
      w.onmessage = (ev: MessageEvent<OutMsg>) => {
        const { jobId, error } = ev.data;
        const p = this.pending.get(jobId);
        if (!p) return;
        this.pending.delete(jobId);
        if (error) p.reject(new Error(error));
        else p.resolve();
      };
      w.onmessageerror = (ev) => {
        console.warn("[minerva] export worker messageerror:", ev);
      };
      this.workers.push(w);
    }
  }

  run(inputs: SaveIn): Promise<void> {
    const { index, tileGetters, directory_handle } = inputs;
    const jobId = this.nextId++;
    const w = this.workers[this.rr++ % this.workers.length];
    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject });
      w.postMessage(
        { jobId, index, tileGetters, directory_handle },
        // TODO --
        // these getTile functions can not be cloned
        // these getTile functions can't be transferred
        // The same issues apply to the bound loader instances
        [
          /*tileGetters*/
        ],
      );
    });
  }
}

let savePool: SavePool | null = null;

function getSavePool(): SavePool | null {
  if (typeof Worker === "undefined") return null;
  if (!savePool) {
    savePool = new SavePool(poolSize());
  }
  return savePool;
}

// main-thread `save` if web Worker supported
const save: Save = async (inputs) => {
  const pool = getSavePool();
  if (pool) {
    try {
      return await pool.run(inputs);
    } catch (err) {
      console.warn("[minerva] export worker failed, using main thread:", err);
    }
  }
  return await save_main_thread(inputs);
};

export { getSavePool, save };
