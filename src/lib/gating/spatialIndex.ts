import RBush from "rbush";
import type { CellFeatureTable } from "./types";

type SpatialItem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  index: number;
};

export type SpatialIndex = {
  queryNearest: (x: number, y: number, k?: number) => number[];
  queryRadius: (x: number, y: number, radius: number) => number[];
  queryPolygon: (ring: [number, number][]) => number[];
};

function pointInPolygon(
  x: number,
  y: number,
  ring: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function bboxFromRing(ring: [number, number][]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

export function buildSpatialIndex(
  table: CellFeatureTable,
  xField: string,
  yField: string,
): SpatialIndex | null {
  const xs = table.columns.get(xField);
  const ys = table.columns.get(yField);
  if (!xs || !ys) {
    return null;
  }

  const tree = new RBush<SpatialItem>();
  const items: SpatialItem[] = [];
  for (let i = 0; i < table.rowCount; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    items.push({
      minX: x,
      minY: y,
      maxX: x,
      maxY: y,
      index: i,
    });
  }
  tree.load(items);

  return {
    queryNearest(x: number, y: number, k = 1): number[] {
      const hits = tree.search({
        minX: x,
        minY: y,
        maxX: x,
        maxY: y,
      });
      hits.sort((a, b) => {
        const da = (a.minX - x) ** 2 + (a.minY - y) ** 2;
        const db = (b.minX - x) ** 2 + (b.minY - y) ** 2;
        return da - db;
      });
      return hits.slice(0, k).map((h) => h.index);
    },

    queryRadius(x: number, y: number, radius: number): number[] {
      const r2 = radius * radius;
      return tree
        .search({
          minX: x - radius,
          minY: y - radius,
          maxX: x + radius,
          maxY: y + radius,
        })
        .filter((h) => {
          const dx = h.minX - x;
          const dy = h.minY - y;
          return dx * dx + dy * dy <= r2;
        })
        .map((h) => h.index);
    },

    queryPolygon(ring: [number, number][]): number[] {
      if (ring.length < 3) return [];
      const bb = bboxFromRing(ring);
      const candidates = tree.search(bb);
      return candidates
        .filter((h) => pointInPolygon(h.minX, h.minY, ring))
        .map((h) => h.index);
    },
  };
}

export function indicesToCellIds(
  table: CellFeatureTable,
  indices: number[],
): (number | string)[] {
  const out: (number | string)[] = [];
  if (table.numericIds) {
    const ids = table.ids as Uint32Array;
    for (const i of indices) out.push(ids[i]);
  } else {
    const ids = table.ids as string[];
    for (const i of indices) out.push(ids[i]);
  }
  return out;
}
