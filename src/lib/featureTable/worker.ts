/**
 * DuckDB-wasm lives only here. The UI thread talks through client.ts.
 */

import * as duckdb from "@duckdb/duckdb-wasm";
import {
  createDuckdbWorker,
  duckdbBundles,
} from "@/lib/featureTable/duckdbBundles";
import { parseCsvLine, peekCsvHeaders } from "./columns";
import { indexTexSize, MAX_CLASS_NAMES } from "./lutLayout";
import { PERSISTED_COLUMNS, storedTableFormat } from "./persistFormat";

type FeatureTableColumns = { id: string; name: string };

type Inbound =
  | {
      id: number;
      type: "ingest";
      featureTableId: string;
      bytes?: Uint8Array;
      file?: File;
      columns?: FeatureTableColumns;
    }
  | {
      id: number;
      type: "page";
      featureTableId: string;
      query: string;
      offset: number;
      limit: number;
    }
  | { id: number; type: "classIndex"; featureTableId: string }
  | { id: number; type: "exportParquet"; featureTableId: string }
  | { id: number; type: "drop"; featureTableId: string }
  | { id: number; type: "reset" };

type Outbound =
  | {
      id: number;
      type: "ingested";
      maxClassId: number;
      names: string[];
      persist?: Uint8Array;
      index?: Uint8Array;
      indexWidth?: number;
      indexHeight?: number;
    }
  | {
      id: number;
      type: "page";
      rows: { name: string }[];
      total: number;
    }
  | {
      id: number;
      type: "classIndex";
      names: string[];
      index?: Uint8Array;
      indexWidth?: number;
      indexHeight?: number;
    }
  | { id: number; type: "parquet"; bytes: Uint8Array }
  | { id: number; type: "ok" }
  | { id: number; type: "error"; message: string };

function tableName(featureTableId: string): string {
  return `featuretable_${featureTableId.replaceAll("-", "")}`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function firstValue(result: {
  numRows: number;
  getChildAt: (i: number) => { get: (i: number) => unknown } | null;
}): unknown {
  if (result.numRows === 0) return undefined;
  return result.getChildAt(0)?.get(0);
}

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let duckWorker: Worker | null = null;

async function ensureConn(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  const bundle = await duckdb.selectBundle(duckdbBundles);
  const mainWorker = bundle.mainWorker;
  if (!mainWorker) throw new Error("DuckDB worker missing");
  duckWorker = createDuckdbWorker(mainWorker);
  db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), duckWorker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
  conn = await db.connect();
  return conn;
}

async function uniqueNames(
  c: duckdb.AsyncDuckDBConnection,
  table: string,
): Promise<string[]> {
  const result = await c.query(
    `SELECT class_name FROM ${table} GROUP BY class_name ORDER BY class_name`,
  );
  const col = result.getChildAt(0);
  const names: string[] = [];
  for (let i = 0; i < result.numRows; i++) {
    names.push(String(col?.get(i) ?? ""));
  }
  return names;
}

async function resolveColumns(
  file: File,
  columns?: FeatureTableColumns,
): Promise<{ cols: FeatureTableColumns; header: boolean }> {
  if (columns) return { cols: columns, header: true };
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  if (head.byteLength === 0) throw new Error("CSV is empty");
  const peeked = peekCsvHeaders(head);
  if (peeked)
    return { cols: { id: peeked.id, name: peeked.name }, header: true };
  const text = new TextDecoder().decode(head);
  let line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
  const cells = parseCsvLine(line).filter((h) => h.length > 0);
  if (cells.length < 2) {
    throw new Error(
      "CSV needs classID,className; cellId,className; cellId,phenotype; cellId,cellType; or two columns with no header",
    );
  }
  return { cols: { id: "column0", name: "column1" }, header: false };
}

async function registerSource(
  duck: duckdb.AsyncDuckDB,
  name: string,
  source: { file?: File; bytes?: Uint8Array },
): Promise<void> {
  if (source.file) {
    await duck.registerFileHandle(
      name,
      source.file,
      duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
      true,
    );
    return;
  }
  if (!source.bytes) throw new Error("CSV is empty");
  const copy = new Uint8Array(source.bytes.byteLength);
  copy.set(source.bytes);
  await duck.registerFileBuffer(name, copy);
}

async function exportParquet(
  duck: duckdb.AsyncDuckDB,
  c: duckdb.AsyncDuckDBConnection,
  table: string,
): Promise<Uint8Array> {
  const out = `${table}_persist.parquet`;
  await duck.registerEmptyFileBuffer(out);
  try {
    await c.query(
      `COPY (SELECT class_id, class_name FROM ${table} ORDER BY class_id) TO ${sqlString(out)} (FORMAT parquet, COMPRESSION zstd)`,
    );
    const buf = await duck.copyFileToBuffer(out);
    // Copy out before any later register call reuses the buffer.
    return buf.slice();
  } finally {
    await duck.dropFile(out).catch(() => undefined);
  }
}

type ReadPlan = {
  file: string;
  cols: FeatureTableColumns;
  reader: string;
  /** False when the source is already the stored Parquet. */
  persist: boolean;
};

// The sniffer samples the first rows only; a quoted comma past them would split.
const CSV_QUOTING = `quote='"', escape='"'`;

async function planRead(
  table: string,
  source: { file?: File; bytes?: Uint8Array },
  columns?: FeatureTableColumns,
): Promise<ReadPlan> {
  if (source.file) {
    const { cols, header } = await resolveColumns(source.file, columns);
    const file = `${table}.csv`;
    return {
      file,
      cols,
      reader: `read_csv(${sqlString(file)}, header=${header ? "true" : "false"}, all_varchar=true, ${CSV_QUOTING})`,
      persist: true,
    };
  }
  if (!source.bytes || source.bytes.byteLength === 0) {
    throw new Error("Feature table is empty");
  }
  const format = storedTableFormat(source.bytes);
  if (format.kind === "parquet") {
    const file = `${table}.parquet`;
    return {
      file,
      cols: PERSISTED_COLUMNS,
      reader: `read_parquet(${sqlString(file)})`,
      persist: false,
    };
  }
  const file = `${table}.csv`;
  return {
    file,
    cols: format.columns,
    reader: `read_csv(${sqlString(file)}, header=true, all_varchar=true, ${CSV_QUOTING})`,
    persist: true,
  };
}

async function ingest(
  featureTableId: string,
  source: { file?: File; bytes?: Uint8Array },
  columns?: FeatureTableColumns,
): Promise<{
  maxClassId: number;
  names: string[];
  persist?: Uint8Array;
  index?: { data: Uint8Array; width: number; height: number };
}> {
  const c = await ensureConn();
  const duck = db;
  if (!duck) throw new Error("DuckDB failed to start");

  const table = tableName(featureTableId);
  const plan = await planRead(table, source, columns);
  const { cols, file } = plan;
  const staging = `${table}_stg`;
  const raw = `${table}_raw`;
  await c.query(`DROP TABLE IF EXISTS ${staging}`);
  await c.query(`DROP TABLE IF EXISTS ${raw}`);
  await registerSource(duck, file, source);
  try {
    await c.query(
      `CREATE TABLE ${raw} AS SELECT trim(CAST(${sqlIdent(cols.id)} AS VARCHAR)) AS class_id, CAST(COALESCE(${sqlIdent(cols.name)}, '') AS VARCHAR) AS class_name FROM ${plan.reader}`,
    );

    const valid = `regexp_matches(class_id, '^[0-9]+$') AND TRY_CAST(class_id AS UINTEGER) BETWEEN 1 AND 4294967295`;
    const bad = await c.query(
      `SELECT class_id FROM ${raw} WHERE class_id NOT IN ('', '0') AND NOT (${valid}) LIMIT 1`,
    );
    const badId = firstValue(bad);
    if (badId != null && String(badId).length > 0) {
      throw new Error(`Invalid classID "${String(badId)}"`);
    }
    const dup = await c.query(
      `SELECT TRY_CAST(class_id AS UINTEGER) FROM ${raw} WHERE ${valid} GROUP BY 1 HAVING COUNT(*) > 1 LIMIT 1`,
    );
    const dupId = firstValue(dup);
    if (dupId != null) {
      throw new Error(`Duplicate classID ${Number(dupId)}`);
    }
    await c.query(
      `CREATE TABLE ${staging} AS SELECT CAST(class_id AS UINTEGER) AS class_id, class_name FROM ${raw} WHERE ${valid}`,
    );
    await c.query(`DROP TABLE IF EXISTS ${raw}`);
    const stats = await c.query(
      `SELECT COUNT(*) AS n, MAX(class_id) AS m FROM ${staging}`,
    );
    if (Number(stats.getChildAt(0)?.get(0) ?? 0) === 0) {
      throw new Error("CSV has no class rows");
    }
    const maxClassId = Number(stats.getChildAt(1)?.get(0) ?? 0);
    await c.query(`DROP TABLE IF EXISTS ${table}`);
    await c.query(`ALTER TABLE ${staging} RENAME TO ${table}`);
    const names = await uniqueNames(c, table);
    const index = await fillClassIndex(c, table, maxClassId, names);
    const persist = plan.persist
      ? await exportParquet(duck, c, table)
      : undefined;
    return { maxClassId, names, persist, index };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      /Referenced column|does not exist/i.test(message) &&
      (message.includes(cols.id) || message.includes(cols.name))
    ) {
      throw new Error(`CSV is missing "${cols.id}" or "${cols.name}"`);
    }
    throw e;
  } finally {
    await c.query(`DROP TABLE IF EXISTS ${raw}`).catch(() => undefined);
    await c.query(`DROP TABLE IF EXISTS ${staging}`).catch(() => undefined);
    await duck.dropFile(file).catch(() => undefined);
  }
}

async function page(
  featureTableId: string,
  query: string,
  offset: number,
  limit: number,
): Promise<{ rows: { name: string }[]; total: number }> {
  const c = await ensureConn();
  const table = tableName(featureTableId);
  if (!(await tableExists(c, table))) {
    return { rows: [], total: 0 };
  }
  const needle = query.trim();
  const where =
    needle.length === 0
      ? ""
      : `WHERE class_name ILIKE '%' || ${sqlString(needle)} || '%'`;
  const totalTable = await c.query(
    `SELECT COUNT(*)::INTEGER AS n FROM (SELECT 1 FROM ${table} ${where} GROUP BY class_name)`,
  );
  const total = Number(totalTable.getChildAt(0)?.get(0) ?? 0);
  const result = await c.query(
    `SELECT class_name FROM ${table} ${where} GROUP BY class_name ORDER BY class_name LIMIT ${Math.max(0, limit | 0)} OFFSET ${Math.max(0, offset | 0)}`,
  );
  const names = result.getChildAt(0);
  const rows: { name: string }[] = [];
  const n = result.numRows;
  for (let i = 0; i < n; i++) {
    rows.push({ name: String(names?.get(i) ?? "") });
  }
  return { rows, total };
}

async function tableExists(
  c: duckdb.AsyncDuckDBConnection,
  table: string,
): Promise<boolean> {
  const exists = await c.query(
    `SELECT COUNT(*)::INTEGER FROM information_schema.tables WHERE table_name = ${sqlString(table)}`,
  );
  return Number(exists.getChildAt(0)?.get(0) ?? 0) > 0;
}

async function fillClassIndex(
  c: duckdb.AsyncDuckDBConnection,
  table: string,
  maxClassId: number,
  names: string[],
): Promise<{ data: Uint8Array; width: number; height: number } | undefined> {
  const size = indexTexSize(maxClassId + 1);
  if (!size) {
    console.warn("[featureTable] class index exceeds GPU texture size");
    return undefined;
  }
  const nameToIdx = new Map<string, number>();
  const n = Math.min(names.length, MAX_CLASS_NAMES);
  for (let i = 0; i < n; i++) nameToIdx.set(names[i], i + 1);
  const data = new Uint8Array(size.width * size.height);
  const result = await c.query(`SELECT class_id, class_name FROM ${table}`);
  const ids = result.getChildAt(0);
  const nms = result.getChildAt(1);
  for (let i = 0; i < result.numRows; i++) {
    const id = Number(ids?.get(i) ?? 0);
    if (id < 1 || id > maxClassId) continue;
    const cls = nameToIdx.get(String(nms?.get(i) ?? "")) ?? 0;
    data[Math.floor(id / size.width) * size.width + (id % size.width)] = cls;
  }
  return { data, width: size.width, height: size.height };
}

async function readClassIndex(featureTableId: string): Promise<{
  names: string[];
  index?: { data: Uint8Array; width: number; height: number };
}> {
  const c = await ensureConn();
  const table = tableName(featureTableId);
  if (!(await tableExists(c, table))) return { names: [] };
  const names = await uniqueNames(c, table);
  const stats = await c.query(`SELECT MAX(class_id) AS m FROM ${table}`);
  const maxClassId = Number(stats.getChildAt(0)?.get(0) ?? 0);
  const index = await fillClassIndex(c, table, maxClassId, names);
  return { names, index };
}

/** Parquet of an ingested table, whatever format its blob was stored in. */
async function exportTableParquet(featureTableId: string): Promise<Uint8Array> {
  const c = await ensureConn();
  const duck = db;
  if (!duck) throw new Error("DuckDB failed to start");
  const table = tableName(featureTableId);
  if (!(await tableExists(c, table))) {
    throw new Error("Feature table is not loaded");
  }
  return exportParquet(duck, c, table);
}

async function drop(featureTableId: string): Promise<void> {
  if (!conn) return;
  await conn.query(`DROP TABLE IF EXISTS ${tableName(featureTableId)}`);
}

async function reset(): Promise<void> {
  if (!conn || !db) return;
  await conn.close();
  conn = null;
  await db.terminate();
  db = null;
  duckWorker?.terminate();
  duckWorker = null;
}

let messageQueue: Promise<void> = Promise.resolve();

self.onmessage = (e: MessageEvent<Inbound>) => {
  messageQueue = messageQueue.then(() => handle(e.data));
};

async function handle(msg: Inbound): Promise<void> {
  try {
    if (msg.type === "ingest") {
      const { maxClassId, names, persist, index } = await ingest(
        msg.featureTableId,
        { file: msg.file, bytes: msg.bytes },
        msg.columns,
      );
      const transfer: Transferable[] = [];
      if (persist) transfer.push(persist.buffer);
      if (index) transfer.push(index.data.buffer);
      self.postMessage(
        {
          id: msg.id,
          type: "ingested",
          maxClassId,
          names,
          persist,
          index: index?.data,
          indexWidth: index?.width,
          indexHeight: index?.height,
        } satisfies Outbound,
        { transfer },
      );
      return;
    }
    if (msg.type === "classIndex") {
      const { names, index } = await readClassIndex(msg.featureTableId);
      self.postMessage(
        {
          id: msg.id,
          type: "classIndex",
          names,
          index: index?.data,
          indexWidth: index?.width,
          indexHeight: index?.height,
        } satisfies Outbound,
        index ? { transfer: [index.data.buffer] } : undefined,
      );
      return;
    }
    if (msg.type === "exportParquet") {
      const bytes = await exportTableParquet(msg.featureTableId);
      self.postMessage(
        { id: msg.id, type: "parquet", bytes } satisfies Outbound,
        { transfer: [bytes.buffer] },
      );
      return;
    }
    if (msg.type === "page") {
      const result = await page(
        msg.featureTableId,
        msg.query,
        msg.offset,
        msg.limit,
      );
      const out: Outbound = { id: msg.id, type: "page", ...result };
      self.postMessage(out);
      return;
    }
    if (msg.type === "drop") {
      await drop(msg.featureTableId);
      self.postMessage({ id: msg.id, type: "ok" } satisfies Outbound);
      return;
    }
    await reset();
    self.postMessage({ id: msg.id, type: "ok" } satisfies Outbound);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[featureTable]", err);
    self.postMessage({
      id: msg.id,
      type: "error",
      message,
    } satisfies Outbound);
  }
}
