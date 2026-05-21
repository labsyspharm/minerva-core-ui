import { exportGatedCsv, getGatedRowIndicesInSelection } from "./gateEval";
import type { CellFeatureTable, GateDefinition, GateEvalMode } from "./types";

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadGatedCsvExport(opts: {
  table: CellFeatureTable;
  headers: string[];
  gates: GateDefinition[];
  mode: GateEvalMode;
  selection: Set<number> | null;
  datasetName: string;
}): void {
  const indices = getGatedRowIndicesInSelection(
    opts.table,
    opts.gates,
    opts.mode,
    opts.selection,
  );
  const csv = exportGatedCsv(opts.table, opts.headers, indices);
  const safe = opts.datasetName.replace(/[^\w.-]+/g, "_") || "gated";
  downloadTextFile(`${safe}_gated.csv`, csv);
}

export function downloadGatesJson(
  gates: GateDefinition[],
  datasetName: string,
): void {
  const safe = datasetName.replace(/[^\w.-]+/g, "_") || "gates";
  downloadTextFile(`${safe}_gates.json`, JSON.stringify({ gates }, null, 2));
}

export function parseGatesJsonFile(text: string): GateDefinition[] {
  const parsed = JSON.parse(text) as { gates?: GateDefinition[] };
  if (!Array.isArray(parsed.gates)) {
    throw new Error("Invalid gates file: expected { gates: [...] }");
  }
  return parsed.gates;
}
