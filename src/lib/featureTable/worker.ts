/**
 * DuckDB-wasm lives only here. The UI thread talks through client.ts.
 */

import * as duckdb from "@duckdb/duckdb-wasm";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdbWasmMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import { parseCsvLine, peekCsvHeaders } from "./columns";
import { indexTexSize, MAX_CLASS_NAMES } from "./lutLayout";

type FeatureTableColumns = { id: string; name: string };

type Inbound =
  | {
      id: number;
      type: "ingest";
      featureTableId: string;
      bytes?: Uint8Array;
      file?: File;
      columns?: FeatureTableColumns;
      header?: boolean;
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
  | { id: number; type: "drop"; featureTableId: string }
  | { id: number; type: "reset" };

type Outbound =
  | {
      id: number;
      type: "ingested";
      maxClassId: number;
      names: string[];
      persist?: Uint8Array;
      columns: FeatureTableColumns;
      header: boolean;
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
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: duckdbWasmMvp, mainWorker: mvpWorker },
    eh: { mainModule: duckdbWasmEh, mainWorker: ehWorker },
  });
  const mainWorker = bundle.mainWorker;
  if (!mainWorker) throw new Error("DuckDB worker missing");
  duckWorker = new Worker(mainWorker);
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
  source: { file?: File; bytes?: Uint8Array },
  columns?: FeatureTableColumns,
  header?: boolean,
): Promise<{ cols: FeatureTableColumns; header: boolean }> {
  if (columns) return { cols: columns, header: header ?? true };
  const head = source.file
    ? new Uint8Array(await source.file.slice(0, 8192).arrayBuffer())
    : source.bytes?.subarray(0, Math.min(8192, source.bytes.byteLength));
  if (!head) throw new Error("CSV is empty");
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

async function exportTwoColCsv(
  duck: duckdb.AsyncDuckDB,
  c: duckdb.AsyncDuckDBConnection,
  table: string,
): Promise<Uint8Array> {
  const out = `${table}_persist.csv`;
  await duck.registerEmptyFileBuffer(out);
  await c.query(
    `COPY ${table} TO ${sqlString(out)} (HEADER true, DELIMITER ',')`,
  );
  const buf = await duck.copyFileToBuffer(out);
  await duck.dropFile(out).catch(() => undefined);
  return buf.slice();
}

async function ingest(
  featureTableId: string,
  source: { file?: File; bytes?: Uint8Array },
  columns?: FeatureTableColumns,
  header?: boolean,
): Promise<{
  maxClassId: number;
  names: string[];
  persist?: Uint8Array;
  columns: FeatureTableColumns;
  header: boolean;
  index?: { data: Uint8Array; width: number; height: number };
}> {
  const c = await ensureConn();
  const duck = db;
  if (!duck) throw new Error("DuckDB failed to start");

  const { cols, header: hasHeader } = await resolveColumns(
    source,
    columns,
    header,
  );
  const table = tableName(featureTableId);
  const staging = `${table}_stg`;
  const raw = `${table}_raw`;
  const file = `${table}.csv`;
  await c.query(`DROP TABLE IF EXISTS ${staging}`);
  await c.query(`DROP TABLE IF EXISTS ${raw}`);
  await registerSource(duck, file, source);
  try {
    await c.query(
      `CREATE TABLE ${raw} AS SELECT trim(CAST(${sqlIdent(cols.id)} AS VARCHAR)) AS class_id, CAST(COALESCE(${sqlIdent(cols.name)}, '') AS VARCHAR) AS class_name FROM read_csv(${sqlString(file)}, header=${hasHeader ? "true" : "false"}, all_varchar=true)`,
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
    const persist = source.file
      ? await exportTwoColCsv(duck, c, table)
      : undefined;
    return {
      maxClassId,
      names,
      persist,
      columns: cols,
      header: hasHeader,
      index,
    };
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
      const { maxClassId, names, persist, columns, header, index } =
        await ingest(
          msg.featureTableId,
          { file: msg.file, bytes: msg.bytes },
          msg.columns,
          msg.header,
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
          columns,
          header,
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
