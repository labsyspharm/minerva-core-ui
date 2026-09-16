import type { ClassVisibility, MaskGpuStyle } from "@/lib/imaging/maskLayers";

type Outbound =
  | {
      id: number;
      type: "page";
      rows: { name: string }[];
      total: number;
    }
  | {
      id: number;
      type: "ingested";
      maxClassId: number;
      names: string[];
    }
  | {
      id: number;
      type: "lut";
      strategy: "denseLut";
      rgba: Uint8Array;
      width: number;
      height: number;
    }
  | {
      id: number;
      type: "lut";
      strategy: "sparse";
      missHidden: boolean;
      overrides: Uint32Array;
    }
  | { id: number; type: "ok" }
  | { id: number; type: "error"; message: string };

let worker: Worker | null = null;
let nextId = 1;
let ingestEpoch = 0;
const ingestListeners = new Set<() => void>();
const pending = new Map<
  number,
  { resolve: (msg: Outbound) => void; reject: (err: Error) => void }
>();

export function subscribeClassTableIngest(
  onStoreChange: () => void,
): () => void {
  ingestListeners.add(onStoreChange);
  return () => {
    ingestListeners.delete(onStoreChange);
  };
}

export function getClassTableIngestEpoch(): number {
  return ingestEpoch;
}

function noteIngest() {
  ingestEpoch += 1;
  for (const fn of ingestListeners) fn();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<Outbound>) => {
    const waiter = pending.get(e.data.id);
    if (!waiter) return;
    pending.delete(e.data.id);
    waiter.resolve(e.data);
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || "class table worker failed");
    for (const waiter of pending.values()) waiter.reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

function request(
  payload: object,
  transfer?: Transferable[],
): Promise<Outbound> {
  const id = nextId++;
  const w = ensureWorker();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, ...payload }, transfer ?? []);
  });
}

export async function ingestClassTable(
  classTableId: string,
  bytes: Uint8Array,
  columns?: { id: string; name: string },
): Promise<{
  maxClassId: number;
  names: string[];
}> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const msg = await request(
    { type: "ingest", classTableId, bytes: copy, columns },
    [copy.buffer],
  );
  if (msg.type === "error") throw new Error(msg.message);
  if (msg.type !== "ingested") throw new Error("unexpected ingest reply");
  noteIngest();
  return { maxClassId: msg.maxClassId, names: msg.names };
}

export async function pageClassTable(
  classTableId: string,
  query: string,
  offset: number,
  limit: number,
): Promise<{ rows: { name: string }[]; total: number }> {
  const msg = await request({
    type: "page",
    classTableId,
    query,
    offset,
    limit,
  });
  if (msg.type === "error") throw new Error(msg.message);
  if (msg.type !== "page") throw new Error("unexpected page reply");
  return { rows: msg.rows, total: msg.total };
}

export async function rebuildClassTableLut(input: {
  classTableId: string;
  maxClassId: number;
  seed: number;
  nameColors: { name: string; r: number; g: number; b: number }[];
  vis: ClassVisibility | undefined;
  rev: string;
}): Promise<MaskGpuStyle> {
  const msg = await request({
    type: "rebuildLut",
    classTableId: input.classTableId,
    maxClassId: input.maxClassId,
    seed: input.seed,
    nameColors: input.nameColors,
    vis:
      !input.vis || input.vis.mode === "all"
        ? { mode: "all" as const }
        : { mode: input.vis.mode, names: [...input.vis.names] },
  });
  if (msg.type === "error") throw new Error(msg.message);
  if (msg.type !== "lut") throw new Error("unexpected lut reply");
  if (msg.strategy === "denseLut") {
    return {
      strategy: "denseLut",
      rgba: msg.rgba,
      width: msg.width,
      height: msg.height,
      rev: input.rev,
    };
  }
  return {
    strategy: "sparse",
    missHidden: msg.missHidden,
    overrides: msg.overrides,
    rev: input.rev,
  };
}

export async function dropClassTable(classTableId: string): Promise<void> {
  const msg = await request({ type: "drop", classTableId });
  if (msg.type === "error") throw new Error(msg.message);
}

export async function resetClassTables(): Promise<void> {
  if (!worker) return;
  const msg = await request({ type: "reset" });
  if (msg.type === "error") throw new Error(msg.message);
  noteIngest();
}
