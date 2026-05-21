import type { CellFeatureTable, GateDefinition } from "./types";
import { GATING_TEXTURE_MAX_CELLS } from "./types";

export type GatingTexturePack = {
  cellCount: number;
  ids: Float32Array;
  centers: Float32Array;
  gateMags: Float32Array[];
  gatings: Float32Array;
  pickings: Float32Array;
  textureWidth: number;
};

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return Math.min(p, GATING_TEXTURE_MAX_CELLS);
}

/**
 * Pack per-cell GPU attributes into 1D arrays (uploaded as DataTextures).
 */
export function buildGatingTexturePack(
  table: CellFeatureTable,
  gates: GateDefinition[],
  xField: string,
  yField: string,
  selectionRowIndices: Set<number> | null,
  maxGates = 4,
): GatingTexturePack {
  const n = Math.min(table.rowCount, GATING_TEXTURE_MAX_CELLS);
  const width = nextPow2(n);
  const xs = table.columns.get(xField);
  const ys = table.columns.get(yField);

  const ids = new Float32Array(width);
  const centers = new Float32Array(width * 2);
  const gateMags: Float32Array[] = [];
  for (let g = 0; g < maxGates; g++) {
    gateMags.push(new Float32Array(width));
  }
  const gatings = new Float32Array(width * 4);
  const pickings = new Float32Array(width);

  const activeGates = gates.filter((g) => g.enabled).slice(0, maxGates);

  for (let i = 0; i < n; i++) {
    if (table.numericIds) {
      ids[i] = (table.ids as Uint32Array)[i];
    } else {
      ids[i] = i;
    }
    centers[i * 2] = xs ? xs[i] : 0;
    centers[i * 2 + 1] = ys ? ys[i] : 0;

    for (let g = 0; g < maxGates; g++) {
      const gate = activeGates[g];
      if (!gate) {
        gateMags[g][i] = 0;
        continue;
      }
      const col = table.columns.get(gate.column);
      const v = col ? col[i] : 0;
      const span = gate.max - gate.min || 1;
      gateMags[g][i] = Number.isFinite(v)
        ? Math.max(0, Math.min(1, (v - gate.min) / span))
        : 0;
    }

    for (let g = 0; g < 4; g++) {
      const gate = activeGates[g];
      if (!gate) {
        gatings[i * 4 + g] = 0;
        continue;
      }
      const col = table.columns.get(gate.column);
      const v = col ? col[i] : NaN;
      const pass = Number.isFinite(v) && v >= gate.min && v <= gate.max ? 1 : 0;
      gatings[i * 4 + g] = pass;
    }

    pickings[i] =
      selectionRowIndices && selectionRowIndices.size > 0
        ? selectionRowIndices.has(i)
          ? 1
          : 0
        : 0;
  }

  return {
    cellCount: n,
    ids,
    centers,
    gateMags,
    gatings,
    pickings,
    textureWidth: width,
  };
}
