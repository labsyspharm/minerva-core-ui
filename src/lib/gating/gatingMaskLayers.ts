import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import type { Loader } from "@/lib/imaging/viv";
import type { CellFeatureTable, GateDefinition, GateEvalMode } from "./types";

type Selection = { t: number; z: number; c: number };

function rowPassesGates(
  table: CellFeatureTable,
  rowIndex: number,
  gates: GateDefinition[],
  mode: GateEvalMode,
  _drawMode: string,
): boolean {
  const active = gates.filter((g) => g.enabled);
  if (active.length === 0) return true;
  const passes = active.map((gate) => {
    const col = table.columns.get(gate.column);
    if (!col) return false;
    const v = col[rowIndex];
    return Number.isFinite(v) && v >= gate.min && v <= gate.max;
  });
  return mode === "and" ? passes.every(Boolean) : passes.some(Boolean);
}

function resolveRowIndex(
  table: CellFeatureTable,
  cellId: number,
): number | null {
  if (table.numericIds) {
    const idx = table.idToIndex.get(Math.round(cellId));
    return idx !== undefined ? idx : null;
  }
  const idx = table.idToIndex.get(cellId);
  return idx !== undefined ? idx : null;
}

function colorizeMaskRaster(
  raw: ArrayLike<number>,
  width: number,
  height: number,
  table: CellFeatureTable,
  gates: GateDefinition[],
  mode: GateEvalMode,
  selection: Set<number> | null,
  outlines: boolean,
  drawMode: string,
): ImageData {
  const img = new ImageData(width, height);
  const out = img.data;
  const active = gates.filter((g) => g.enabled);

  for (let i = 0; i < width * height; i++) {
    const cellId = raw[i] ?? 0;
    const o = i * 4;
    if (cellId < 0.5) {
      out[o + 3] = 0;
      continue;
    }
    const row = resolveRowIndex(table, cellId);
    if (row === null) {
      out[o] = 30;
      out[o + 1] = 30;
      out[o + 2] = 30;
      out[o + 3] = 40;
      continue;
    }

    const pass = rowPassesGates(table, row, gates, mode, drawMode);
    const picked = selection?.has(row) ?? false;

    if (!pass && !picked) {
      out[o + 3] = 0;
      continue;
    }

    let r = 0;
    let g = 0;
    let b = 0;
    for (let gi = 0; gi < active.length; gi++) {
      const gate = active[gi];
      const col = table.columns.get(gate.column);
      const v = col ? col[row] : 0;
      const span = gate.max - gate.min || 1;
      const t = Number.isFinite(v)
        ? Math.max(0, Math.min(1, (v - gate.min) / span))
        : 0;
      r += gate.rgb[0] * t;
      g += gate.rgb[1] * t;
      b += gate.rgb[2] * t;
    }
    const n = Math.max(1, active.length);
    r = Math.min(255, r / n);
    g = Math.min(255, g / n);
    b = Math.min(255, b / n);

    if (picked) {
      r = Math.min(255, r * 0.6 + 255 * 0.4);
      g = Math.min(255, g * 0.6 + 220 * 0.4);
      b = Math.min(255, b * 0.6);
    }

    if (outlines) {
      const edge = (Math.round(cellId) + i) % 17 === 0;
      if (edge && pass) {
        r = g = b = 255;
      }
    }

    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = pass || picked ? 170 : 0;
  }
  return img;
}

function tileRaster(tile: unknown): {
  data: ArrayLike<number>;
  width: number;
  height: number;
} | null {
  if (!tile || typeof tile !== "object") return null;
  const t = tile as {
    data?: ArrayLike<number>;
    width?: number;
    height?: number;
  };
  if (!t.data) return null;
  const width = t.width ?? Math.sqrt(t.data.length);
  const height = t.height ?? width;
  return { data: t.data, width, height };
}

/**
 * Label mask tiles colored by gate state (CPU per tile; refreshes on gate changes).
 */
export function createGatingMaskLayers(opts: {
  maskLoader: Loader;
  cellTable: CellFeatureTable;
  gates: GateDefinition[];
  evalMode: GateEvalMode;
  selection: Set<number> | null;
  outlines: boolean;
  drawMode: string;
  revision: number;
  id?: string;
}) {
  void opts.revision;
  const level = opts.maskLoader.data[0];
  if (!level) return [];

  const tileSize = level.tileSize ?? 256;

  const tileLayer = new TileLayer({
    id: opts.id ?? "gating-mask-tiles",
    data: opts.maskLoader.data as never,
    tileSize,
    maxZoom: opts.maskLoader.data.length - 1,
    minZoom: 0,
    pickable: false,
    opacity: 0.75,
    updateTriggers: {
      getTileData: [
        opts.gates,
        opts.evalMode,
        opts.selection,
        opts.outlines,
        opts.revision,
      ],
    },
    renderSubLayers: (props) => {
      const bbox = props.tile.bbox as {
        left: number;
        bottom: number;
        right: number;
        top: number;
      };
      const { left, bottom, right, top } = bbox;
      const { data } = props;
      const raster = tileRaster(data);
      if (!raster) return null;
      const w = Math.round(right - left) || raster.width;
      const h = Math.round(top - bottom) || raster.height;
      const image = colorizeMaskRaster(
        raster.data,
        w,
        h,
        opts.cellTable,
        opts.gates,
        opts.evalMode,
        opts.selection,
        opts.outlines,
        opts.drawMode,
      );
      return new BitmapLayer(props as never, {
        image,
        bounds: [left, bottom, right, top],
        pickable: false,
      });
    },
    getTileData: async ({ index, signal }) => {
      const { x, y } = index;
      const sel: Selection = { t: 0, z: 0, c: 0 };
      return level.getTile({ x, y, selection: sel, signal });
    },
  } as never);

  return [tileLayer];
}
