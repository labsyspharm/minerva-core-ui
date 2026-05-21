import type { CellFeatureTable, GateDefinition, GateEvalMode } from "./types";

function rowPassesGate(
  table: CellFeatureTable,
  rowIndex: number,
  gate: GateDefinition,
): boolean {
  if (!gate.enabled) return true;
  const col = table.columns.get(gate.column);
  if (!col) return false;
  const v = col[rowIndex];
  if (!Number.isFinite(v)) return false;
  return v >= gate.min && v <= gate.max;
}

/**
 * Return row indices matching active gates (AND or OR).
 */
export function getGatedRowIndices(
  table: CellFeatureTable,
  gates: GateDefinition[],
  mode: GateEvalMode,
): number[] {
  const active = gates.filter((g) => g.enabled);
  if (active.length === 0) {
    return [...Array(table.rowCount).keys()];
  }

  const out: number[] = [];
  for (let r = 0; r < table.rowCount; r++) {
    const passes = active.map((g) => rowPassesGate(table, r, g));
    const ok = mode === "and" ? passes.every(Boolean) : passes.some(Boolean);
    if (ok) out.push(r);
  }
  return out;
}

export function countGatedCells(
  table: CellFeatureTable,
  gates: GateDefinition[],
  mode: GateEvalMode,
): number {
  return getGatedRowIndices(table, gates, mode).length;
}

/**
 * Restrict gated rows to a selection (lasso) by row index.
 */
export function getGatedRowIndicesInSelection(
  table: CellFeatureTable,
  gates: GateDefinition[],
  mode: GateEvalMode,
  selectionRowIndices: Set<number> | null,
): number[] {
  const base = getGatedRowIndices(table, gates, mode);
  if (!selectionRowIndices || selectionRowIndices.size === 0) {
    return base;
  }
  return base.filter((i) => selectionRowIndices.has(i));
}

export function exportGatedCsv(
  table: CellFeatureTable,
  headers: string[],
  rowIndices: number[],
): string {
  const lines: string[] = [headers.join(",")];
  for (const r of rowIndices) {
    const cells = headers.map((h) => {
      const arr = table.columns.get(h);
      const v = arr ? arr[r] : "";
      return String(v);
    });
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}
