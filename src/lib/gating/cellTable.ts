import Papa from "papaparse";
import type { CellFeatureTable, GatingDatasetConfig } from "./types";

export type ParseCsvOptions = {
  idField: string;
  /** Optional — if omitted, the spatial index is disabled. */
  xField?: string;
  yField?: string;
  log1pColumns?: string[];
};

function parseNumeric(val: string): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : NaN;
}

function applyLog1p(v: number): number {
  if (!Number.isFinite(v) || v < 0) return v;
  return Math.log1p(v);
}

/**
 * Parse quantification CSV into typed column arrays and id lookup.
 */
export function parseCellCsv(
  csvText: string,
  opts: ParseCsvOptions,
): CellFeatureTable {
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
  }
  const rows = parsed.data as string[][];
  if (rows.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }
  const headers = rows[0].map((h) => String(h).trim());
  const dataRows = rows.slice(1);
  const rowCount = dataRows.length;

  const idCol = headers.indexOf(opts.idField);
  if (idCol < 0) {
    throw new Error(`Cell ID column "${opts.idField}" not found in CSV.`);
  }
  if (opts.xField && headers.indexOf(opts.xField) < 0) {
    throw new Error(`X column "${opts.xField}" not found in CSV.`);
  }
  if (opts.yField && headers.indexOf(opts.yField) < 0) {
    throw new Error(`Y column "${opts.yField}" not found in CSV.`);
  }

  const logSet = new Set(opts.log1pColumns ?? []);
  const columns = new Map<string, Float32Array>();
  for (let c = 0; c < headers.length; c++) {
    const name = headers[c];
    if (!name) continue;
    columns.set(name, new Float32Array(rowCount));
  }

  const ids: (number | string)[] = [];
  const idToIndex = new Map<number | string, number>();
  let numericIds = true;

  for (let r = 0; r < rowCount; r++) {
    const row = dataRows[r];
    const rawId = row[idCol]?.trim() ?? "";
    let id: number | string = parseNumeric(rawId);
    if (!Number.isFinite(id)) {
      numericIds = false;
      id = rawId;
    }
    ids.push(id);
    idToIndex.set(id, r);

    for (let c = 0; c < headers.length; c++) {
      const name = headers[c];
      if (!name) continue;
      const arr = columns.get(name);
      if (!arr) continue;
      let v = parseNumeric(row[c] ?? "");
      if (logSet.has(name) && Number.isFinite(v)) {
        v = applyLog1p(v);
      }
      arr[r] = v;
    }
  }

  const idArray = numericIds
    ? (ids as number[]).map((n) => Math.round(n))
    : (ids as string[]);

  return {
    rowCount,
    columns,
    ids: numericIds
      ? new Uint32Array(idArray as number[])
      : (idArray as string[]),
    idToIndex,
    numericIds,
  };
}

export async function loadCellTableFromHandle(
  handle: Handle.File,
  config: Pick<
    GatingDatasetConfig,
    "idField" | "xCoordinate" | "yCoordinate" | "log1pColumns"
  >,
): Promise<CellFeatureTable> {
  const file = await handle.getFile();
  const text = await file.text();
  return parseCellCsv(text, {
    idField: config.idField,
    xField: config.xCoordinate || undefined,
    yField: config.yCoordinate || undefined,
    log1pColumns: config.log1pColumns,
  });
}

export function getColumnValues(
  table: CellFeatureTable,
  column: string,
): Float32Array | null {
  return table.columns.get(column) ?? null;
}

export function csvHeadersFromText(csvText: string): string[] {
  const firstLine = csvText.split(/\r?\n/)[0] ?? "";
  const parsed = Papa.parse<string[]>(firstLine, { header: false });
  const row = parsed.data[0] as string[] | undefined;
  return row?.map((h) => String(h).trim()) ?? [];
}
