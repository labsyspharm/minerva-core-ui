/**
 * DuckDB-wasm lives only here. The UI thread talks through client.ts.
 */

import * as duckdb from "@duckdb/duckdb-wasm";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdbWasmMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import { pickClassColumns } from "./columns";

type ClassTableColumns = { id: string; name: string };

type Inbound =
  | {
      id: number;
      type: "ingest";
      classTableId: string;
      bytes: Uint8Array;
      columns?: ClassTableColumns;
    }
  | {
      id: number;
      type: "page";
      classTableId: string;
      query: string;
      offset: number;
      limit: number;
    }
  | {
      id: number;
      type: "rebuildLut";
      classTableId: string;
      maxClassId: number;
      seed: number;
      nameColors: { name: string; r: number; g: number; b: number }[];
      vis: { mode: "all" } | { mode: "hide" | "show"; names: string[] };
    }
  | { id: number; type: "drop"; classTableId: string }
  | { id: number; type: "reset" };

type Outbound =
  | {
      id: number;
      type: "ingested";
      maxClassId: number;
      names: string[];
    }
  | {
      id: number;
      type: "page";
      rows: { name: string }[];
      total: number;
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

function tableName(classTableId: string): string {
  return `classtable_${classTableId.replaceAll("-", "")}`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function describeHeaders(result: {
  numRows: number;
  getChildAt: (i: number) => { get: (i: number) => unknown } | null;
}): string[] {
  const names = result.getChildAt(0);
  const headers: string[] = [];
  for (let i = 0; i < result.numRows; i++) {
    headers.push(String(names?.get(i) ?? ""));
  }
  return headers;
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

async function ingest(
  classTableId: string,
  bytes: Uint8Array,
  columns?: ClassTableColumns,
): Promise<{
  maxClassId: number;
  names: string[];
}> {
  const c = await ensureConn();
  const duck = db;
  if (!duck) throw new Error("DuckDB failed to start");
  const table = tableName(classTableId);
  const staging = `${table}_stg`;
  const raw = `${table}_raw`;
  const file = `${table}.csv`;
  await c.query(`DROP TABLE IF EXISTS ${staging}`);
  await c.query(`DROP TABLE IF EXISTS ${raw}`);
  await duck.registerFileBuffer(file, bytes);
  const loadRaw = async (header: boolean): Promise<string[]> => {
    await c.query(`DROP TABLE IF EXISTS ${raw}`);
    await c.query(
      `CREATE TABLE ${raw} AS SELECT * FROM read_csv(${sqlString(file)}, header=${header ? "true" : "false"}, all_varchar=true)`,
    );
    return describeHeaders(await c.query(`DESCRIBE ${raw}`));
  };
  try {
    let headers: string[] | null = null;
    try {
      headers = await loadRaw(true);
    } catch {
      headers = null;
    }
    let cols: ClassTableColumns | null = null;
    if (columns) {
      if (!headers?.includes(columns.id) || !headers.includes(columns.name)) {
        throw new Error(`CSV is missing "${columns.id}" or "${columns.name}"`);
      }
      cols = columns;
    } else {
      cols = headers ? pickClassColumns(headers) : null;
      if (!cols) {
        try {
          headers = await loadRaw(false);
        } catch {
          throw new Error("CSV has no class rows");
        }
        cols =
          pickClassColumns(headers) ??
          (headers.length >= 2 ? { id: headers[0], name: headers[1] } : null);
      }
    }
    if (!cols) {
      throw new Error(
        "CSV needs classID,className; cellId,className; cellId,phenotype; cellId,cellType; or two columns with no header",
      );
    }
    const idExpr = `trim(CAST(${sqlIdent(cols.id)} AS VARCHAR))`;
    const nameExpr = `CAST(COALESCE(${sqlIdent(cols.name)}, '') AS VARCHAR)`;
    const valid = `regexp_matches(${idExpr}, '^[0-9]+$') AND TRY_CAST(${idExpr} AS UINTEGER) BETWEEN 1 AND 4294967295`;
    const bad = await c.query(
      `SELECT ${idExpr} FROM ${raw} WHERE ${idExpr} NOT IN ('', '0') AND NOT (${valid}) LIMIT 1`,
    );
    const badId = firstValue(bad);
    if (badId != null && String(badId).length > 0) {
      throw new Error(`Invalid classID "${String(badId)}"`);
    }
    const dup = await c.query(
      `SELECT TRY_CAST(${idExpr} AS UINTEGER) FROM ${raw} WHERE ${valid} GROUP BY 1 HAVING COUNT(*) > 1 LIMIT 1`,
    );
    const dupId = firstValue(dup);
    if (dupId != null) {
      throw new Error(`Duplicate classID ${Number(dupId)}`);
    }
    await c.query(
      `CREATE TABLE ${staging} AS SELECT CAST(${idExpr} AS UINTEGER) AS class_id, ${nameExpr} AS class_name FROM ${raw} WHERE ${valid}`,
    );
    const stats = await c.query(
      `SELECT COUNT(*)::INTEGER AS n, MAX(class_id)::INTEGER AS m FROM ${staging}`,
    );
    if (Number(stats.getChildAt(0)?.get(0) ?? 0) === 0) {
      throw new Error("CSV has no class rows");
    }
    const maxClassId = Number(stats.getChildAt(1)?.get(0) ?? 0);
    await c.query(`DROP TABLE IF EXISTS ${table}`);
    await c.query(`ALTER TABLE ${staging} RENAME TO ${table}`);
    const names = await uniqueNames(c, table);
    return { maxClassId, names };
  } finally {
    await c.query(`DROP TABLE IF EXISTS ${raw}`).catch(() => undefined);
    await c.query(`DROP TABLE IF EXISTS ${staging}`).catch(() => undefined);
    await duck.dropFile(file).catch(() => undefined);
  }
}

async function page(
  classTableId: string,
  query: string,
  offset: number,
  limit: number,
): Promise<{ rows: { name: string }[]; total: number }> {
  const c = await ensureConn();
  const table = tableName(classTableId);
  const exists = await c.query(
    `SELECT COUNT(*)::INTEGER FROM information_schema.tables WHERE table_name = ${sqlString(table)}`,
  );
  if (Number(exists.getChildAt(0)?.get(0) ?? 0) === 0) {
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

// Keep in sync with defaultClassColor in maskLayers.ts.
const CELL_OUTLINE_RGB = [
  [82, 249, 0],
  [0, 251, 255],
  [255, 0, 40],
  [255, 188, 0],
  [145, 169, 255],
  [255, 0, 255],
] as const;

function defaultClassColor(
  classId: number,
  colorSeed: number,
): { r: number; g: number; b: number } {
  const i = ((classId ^ colorSeed) >>> 0) % CELL_OUTLINE_RGB.length;
  const [r, g, b] = CELL_OUTLINE_RGB[i];
  return { r, g, b };
}

function packRgba(
  color: { r: number; g: number; b: number },
  a: number,
): number {
  return (
    (color.r & 255) |
    ((color.g & 255) << 8) |
    ((color.b & 255) << 16) |
    ((a & 255) << 24)
  );
}

function nameVisible(
  vis: { mode: "all" } | { mode: "hide" | "show"; names: string[] },
  name: string,
): boolean {
  if (vis.mode === "all") return true;
  const hit = vis.names.includes(name);
  return vis.mode === "hide" ? !hit : hit;
}

/** ponytail: 1024×1024 RGBA8 = 4MB. Typical class IDs 1..N with N ≤ 1M. */
const DENSE_LUT_MAX = 1_048_576;

async function rebuildLut(msg: {
  classTableId: string;
  maxClassId: number;
  seed: number;
  nameColors: { name: string; r: number; g: number; b: number }[];
  vis: { mode: "all" } | { mode: "hide" | "show"; names: string[] };
}): Promise<
  | { strategy: "denseLut"; rgba: Uint8Array; width: number; height: number }
  | { strategy: "sparse"; missHidden: boolean; overrides: Uint32Array }
> {
  const maxClassId = Math.max(0, msg.maxClassId | 0);
  const colors = new Map<string, { r: number; g: number; b: number }>();
  for (const o of msg.nameColors) {
    colors.set(o.name, { r: o.r, g: o.g, b: o.b });
  }
  const unnamedAlpha = msg.vis.mode === "show" ? 0 : 255;
  const c = await ensureConn();
  const table = tableName(msg.classTableId);
  const exists = await c.query(
    `SELECT COUNT(*)::INTEGER FROM information_schema.tables WHERE table_name = ${sqlString(table)}`,
  );
  const hasTable = Number(exists.getChildAt(0)?.get(0) ?? 0) > 0;
  const rows: { id: number; name: string }[] = [];
  if (hasTable) {
    const result = await c.query(`SELECT class_id, class_name FROM ${table}`);
    const ids = result.getChildAt(0);
    const names = result.getChildAt(1);
    for (let i = 0; i < result.numRows; i++) {
      rows.push({
        id: Number(ids?.get(i) ?? 0),
        name: String(names?.get(i) ?? ""),
      });
    }
  }
  if (maxClassId + 1 <= DENSE_LUT_MAX) {
    const width = Math.min(1024, Math.max(1, maxClassId + 1));
    const height = Math.max(1, Math.ceil((maxClassId + 1) / width));
    const rgba = new Uint8Array(width * height * 4);
    for (let id = 1; id <= maxClassId; id++) {
      const color = defaultClassColor(id, msg.seed);
      const x = id % width;
      const y = Math.floor(id / width);
      const i = (y * width + x) * 4;
      rgba[i] = color.r;
      rgba[i + 1] = color.g;
      rgba[i + 2] = color.b;
      rgba[i + 3] = unnamedAlpha;
    }
    for (const row of rows) {
      if (row.id < 1 || row.id > maxClassId) continue;
      const color = colors.get(row.name) ?? defaultClassColor(row.id, msg.seed);
      const x = row.id % width;
      const y = Math.floor(row.id / width);
      const i = (y * width + x) * 4;
      rgba[i] = color.r;
      rgba[i + 1] = color.g;
      rgba[i + 2] = color.b;
      rgba[i + 3] = nameVisible(msg.vis, row.name) ? 255 : 0;
    }
    return { strategy: "denseLut", rgba, width, height };
  }
  const entries: { id: number; packed: number }[] = [];
  for (const row of rows) {
    if (row.id < 1) continue;
    const color = colors.get(row.name) ?? defaultClassColor(row.id, msg.seed);
    const a = nameVisible(msg.vis, row.name) ? 255 : 0;
    entries.push({ id: row.id, packed: packRgba(color, a) });
  }
  let size = 16;
  while (size < Math.max(16, entries.length * 2)) size <<= 1;
  const overrides = new Uint32Array(size * 2);
  for (const e of entries) {
    const slot = (Math.imul(e.id, 2654435761) >>> 0) % size;
    for (let k = 0; k < size; k++) {
      const i = (slot + k) % size;
      if (overrides[i * 2] === 0) {
        overrides[i * 2] = e.id;
        overrides[i * 2 + 1] = e.packed;
        break;
      }
    }
  }
  return {
    strategy: "sparse",
    missHidden: msg.vis.mode === "show",
    overrides,
  };
}

async function drop(classTableId: string): Promise<void> {
  if (!conn) return;
  await conn.query(`DROP TABLE IF EXISTS ${tableName(classTableId)}`);
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
      const { maxClassId, names } = await ingest(
        msg.classTableId,
        msg.bytes,
        msg.columns,
      );
      self.postMessage({
        id: msg.id,
        type: "ingested",
        maxClassId,
        names,
      } satisfies Outbound);
      return;
    }
    if (msg.type === "rebuildLut") {
      const lut = await rebuildLut(msg);
      if (lut.strategy === "denseLut") {
        self.postMessage(
          {
            id: msg.id,
            type: "lut",
            strategy: "denseLut",
            rgba: lut.rgba,
            width: lut.width,
            height: lut.height,
          } satisfies Outbound,
          { transfer: [lut.rgba.buffer] },
        );
        return;
      }
      self.postMessage(
        {
          id: msg.id,
          type: "lut",
          strategy: "sparse",
          missHidden: lut.missHidden,
          overrides: lut.overrides,
        } satisfies Outbound,
        { transfer: [lut.overrides.buffer] },
      );
      return;
    }
    if (msg.type === "page") {
      const result = await page(
        msg.classTableId,
        msg.query,
        msg.offset,
        msg.limit,
      );
      const out: Outbound = { id: msg.id, type: "page", ...result };
      self.postMessage(out);
      return;
    }
    if (msg.type === "drop") {
      await drop(msg.classTableId);
      self.postMessage({ id: msg.id, type: "ok" } satisfies Outbound);
      return;
    }
    await reset();
    self.postMessage({ id: msg.id, type: "ok" } satisfies Outbound);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      id: msg.id,
      type: "error",
      message,
    } satisfies Outbound);
  }
}
