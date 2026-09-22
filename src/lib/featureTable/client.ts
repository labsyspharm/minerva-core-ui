type ClassIndexMap = {
  data: Uint8Array;
  width: number;
  height: number;
  names: string[];
};

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
      persist?: Uint8Array;
      columns: { id: string; name: string };
      header: boolean;
      index?: Uint8Array;
      indexWidth?: number;
      indexHeight?: number;
    }
  | {
      id: number;
      type: "classIndex";
      names: string[];
      index?: Uint8Array;
      indexWidth?: number;
      indexHeight?: number;
    }
  | { id: number; type: "ok" }
  | { id: number; type: "error"; message: string };

let worker: Worker | null = null;
let nextId = 1;
let ingestEpoch = 0;
const ingestListeners = new Set<() => void>();
const classIndexCache = new Map<string, ClassIndexMap>();
const ingestedIds = new Set<string>();
const pending = new Map<
  number,
  { resolve: (msg: Outbound) => void; reject: (err: Error) => void }
>();

export function subscribeFeatureTableIngest(
  onStoreChange: () => void,
): () => void {
  ingestListeners.add(onStoreChange);
  return () => {
    ingestListeners.delete(onStoreChange);
  };
}

export function getFeatureTableIngestEpoch(): number {
  return ingestEpoch;
}

function noteIngest() {
  ingestEpoch += 1;
  for (const fn of ingestListeners) fn();
}

function stashClassIndex(
  featureTableId: string,
  names: string[],
  index?: Uint8Array,
  width?: number,
  height?: number,
) {
  if (!index || !width || !height) {
    classIndexCache.delete(featureTableId);
    return;
  }
  classIndexCache.set(featureTableId, { data: index, width, height, names });
}

export function peekClassIndex(
  featureTableId: string,
): ClassIndexMap | undefined {
  return classIndexCache.get(featureTableId);
}

export function hasIngestedFeatureTable(featureTableId: string): boolean {
  return ingestedIds.has(featureTableId);
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
    console.error("[featureTable] worker", e);
    const err = new Error(e.message || "feature table worker failed");
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

export async function ingestFeatureTable(
  featureTableId: string,
  source: File | Uint8Array,
  columns?: { id: string; name: string; header?: boolean },
): Promise<{
  maxClassId: number;
  names: string[];
  persist?: Uint8Array;
  columns: { id: string; name: string };
  header: boolean;
}> {
  const cols = columns ? { id: columns.id, name: columns.name } : undefined;
  const header = columns?.header;
  let msg: Outbound;
  if (source instanceof File) {
    msg = await request({
      type: "ingest",
      featureTableId,
      file: source,
      columns: cols,
      header,
    });
  } else {
    const copy = new Uint8Array(source.byteLength);
    copy.set(source);
    msg = await request(
      { type: "ingest", featureTableId, bytes: copy, columns: cols, header },
      [copy.buffer],
    );
  }
  if (msg.type === "error") throw new Error(msg.message);
  if (msg.type !== "ingested") throw new Error("unexpected ingest reply");
  ingestedIds.add(featureTableId);
  stashClassIndex(
    featureTableId,
    msg.names,
    msg.index,
    msg.indexWidth,
    msg.indexHeight,
  );
  noteIngest();
  return {
    maxClassId: msg.maxClassId,
    names: msg.names,
    persist: msg.persist,
    columns: msg.columns,
    header: msg.header,
  };
}

export async function pageFeatureTable(
  featureTableId: string,
  query: string,
  offset: number,
  limit: number,
): Promise<{ rows: { name: string }[]; total: number }> {
  const msg = await request({
    type: "page",
    featureTableId,
    query,
    offset,
    limit,
  });
  if (msg.type === "error") throw new Error(msg.message);
  if (msg.type !== "page") throw new Error("unexpected page reply");
  return { rows: msg.rows, total: msg.total };
}

export async function fetchClassIndex(
  featureTableId: string,
): Promise<ClassIndexMap | undefined> {
  const hit = classIndexCache.get(featureTableId);
  if (hit) return hit;
  const msg = await request({ type: "classIndex", featureTableId });
  if (msg.type === "error") throw new Error(msg.message);
  if (msg.type !== "classIndex") throw new Error("unexpected classIndex reply");
  stashClassIndex(
    featureTableId,
    msg.names,
    msg.index,
    msg.indexWidth,
    msg.indexHeight,
  );
  return classIndexCache.get(featureTableId);
}

export async function dropFeatureTable(featureTableId: string): Promise<void> {
  ingestedIds.delete(featureTableId);
  classIndexCache.delete(featureTableId);
  const msg = await request({ type: "drop", featureTableId });
  if (msg.type === "error") throw new Error(msg.message);
}

export async function resetFeatureTables(): Promise<void> {
  ingestedIds.clear();
  classIndexCache.clear();
  if (!worker) return;
  const msg = await request({ type: "reset" });
  if (msg.type === "error") throw new Error(msg.message);
  noteIngest();
}
