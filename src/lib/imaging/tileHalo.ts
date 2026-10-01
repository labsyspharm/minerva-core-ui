import {
  type _Tile2DHeader as Tile2DHeader,
  TileLayer,
} from "@deck.gl/geo-layers";
import type { SupportedTypedArray } from "@/lib/imaging/loaderTypes";

/** One tile's channel planes, row-major. */
export type TileRaster = {
  data: SupportedTypedArray[];
  width: number;
  height: number;
};

/** `renderSubLayers` props from a `HaloTileLayer`: `halo` is `data` padded by 1 texel. */
export type WithHalo<P> = P & { halo: TileRaster };

/** Map a 0..1 tile UV into the tile's halo-padded texture. */
export const TILE_HALO_GLSL = `
vec2 haloUv(vec2 uv, vec2 paddedSize) {
  return (uv * (paddedSize - 2.0) + 1.0) / paddedSize;
}
`;

type TileIndex = { x: number; y: number; z: number };

/** 3×3 neighborhood, row-major. Center is index 4 and unused by the border. */
const BLOCK = [-1, 0, 1].flatMap((dy) =>
  [-1, 0, 1].map((dx) => [dx, dy] as const),
);

const keyOf = ({ x, y, z }: TileIndex) => `${x}-${y}-${z}`;

const loadedByTileset = new WeakMap<object, Map<string, Tile2DHeader>>();

const rasterId = new WeakMap<TileRaster, number>();
let nextRasterId = 1;

const haloCache = new WeakMap<
  TileRaster,
  { ids: Int32Array; raster: TileRaster }
>();
const scratchIds = new Int32Array(8);

const live = (r: TileRaster | null | undefined): r is TileRaster =>
  r != null && r.width > 0 && r.height > 0 && r.data.length > 0;

function idOf(raster: TileRaster): number {
  const existing = rasterId.get(raster);
  if (existing !== undefined) return existing;
  const id = nextRasterId++;
  rasterId.set(raster, id);
  return id;
}

function neighborIds(block: readonly (TileRaster | null)[], into: Int32Array) {
  let k = 0;
  for (let i = 0; i < 9; i++) {
    if (i === 4) continue;
    const n = block[i];
    into[k++] = live(n) ? idOf(n) : 0;
  }
}

function sameIds(a: Int32Array, b: Int32Array) {
  for (let i = 0; i < 8; i++) if (a[i] !== b[i]) return false;
  return true;
}

function allocate(center: TileRaster): TileRaster {
  const { width: w, height: h } = center;
  const pw = w + 2;
  const data = center.data.map((plane) => {
    const Out = plane.constructor as new (n: number) => SupportedTypedArray;
    const out = new Out(pw * (h + 2));
    for (let y = 0; y < h; y++) {
      out.set(plane.subarray(y * w, y * w + w), (y + 1) * pw + 1);
    }
    return out;
  });
  return { data, width: pw, height: h + 2 };
}

function paintBorder(
  raster: TileRaster,
  center: TileRaster,
  block: readonly (TileRaster | null)[],
) {
  const { width: w, height: h } = center;
  const pw = w + 2;
  for (let c = 0; c < center.data.length; c++) {
    const out = raster.data[c];
    const at = (src: TileRaster, x: number, y: number) => {
      const xx = x < 0 ? 0 : x >= src.width ? src.width - 1 : x;
      const yy = y < 0 ? 0 : y >= src.height ? src.height - 1 : y;
      return src.data[c][yy * src.width + xx];
    };
    const put = (x: number, y: number) => {
      const dx = x < 0 ? -1 : x >= w ? 1 : 0;
      const dy = y < 0 ? -1 : y >= h ? 1 : 0;
      const src = block[(dy + 1) * 3 + (dx + 1)];
      const n = live(src) ? src : null;
      const sx = n && dx !== 0 ? (dx < 0 ? n.width - 1 : 0) : x;
      const sy = n && dy !== 0 ? (dy < 0 ? n.height - 1 : 0) : y;
      out[(y + 1) * pw + x + 1] = at(n ?? center, sx, sy);
    };
    for (let x = -1; x <= w; x++) {
      put(x, -1);
      put(x, h);
    }
    for (let y = 0; y < h; y++) {
      put(-1, y);
      put(w, y);
    }
  }
}

/** Center copied once. Later neighbor changes repaint the one-texel border. */
function paddedTile(
  center: TileRaster,
  block: readonly (TileRaster | null)[],
): TileRaster {
  neighborIds(block, scratchIds);
  const hit = haloCache.get(center);
  if (hit && sameIds(hit.ids, scratchIds)) return hit.raster;
  const raster = hit?.raster ?? allocate(center);
  paintBorder(raster, center, block);
  if (hit) {
    hit.ids.set(scratchIds);
    return raster;
  }
  haloCache.set(center, { ids: new Int32Array(scratchIds), raster });
  return raster;
}

type SubLayerProps<T> = Parameters<TileLayer<T>["renderSubLayers"]>[0];

/**
 * TileLayer whose `renderSubLayers` also receives `halo` when `padHalo` is
 * not false. Tiles that already drew are redrawn when a neighbor loads.
 */
export class HaloTileLayer<T extends TileRaster> extends TileLayer<
  T,
  { padHalo?: boolean }
> {
  static layerName = "HaloTileLayer";
  static defaultProps = { padHalo: true };

  loadedTiles(): Map<string, Tile2DHeader> | null {
    const { tileset } = this.state;
    if (!tileset) return null;
    let loaded = loadedByTileset.get(tileset);
    if (!loaded) {
      loaded = new Map();
      loadedByTileset.set(tileset, loaded);
    }
    return loaded;
  }

  _onTileLoad(tile: Tile2DHeader<T>) {
    const loaded = this.loadedTiles();
    if (loaded) {
      loaded.set(keyOf(tile.index), tile);
      if (this.props.padHalo !== false) {
        const { x, y, z } = tile.index;
        for (const [dx, dy] of BLOCK) {
          if (dx === 0 && dy === 0) continue;
          const neighbor = loaded.get(keyOf({ x: x + dx, y: y + dy, z }));
          if (neighbor?.layers) neighbor.layers = null;
        }
      }
    }
    super._onTileLoad(tile);
  }

  _onTileUnload(tile: Tile2DHeader<T>) {
    // Drawn neighbors keep the border they already uploaded.
    this.loadedTiles()?.delete(keyOf(tile.index));
    super._onTileUnload(tile);
  }

  renderSubLayers(props: SubLayerProps<T>) {
    const center = props.data;
    if (this.props.padHalo === false || !live(center)) {
      return super.renderSubLayers(props);
    }
    const loaded = this.loadedTiles();
    const { x, y, z } = props.tile.index;
    const block: (TileRaster | null)[] = BLOCK.map(([dx, dy]) =>
      dx === 0 && dy === 0
        ? null
        : ((loaded?.get(keyOf({ x: x + dx, y: y + dy, z }))?.content as
            | TileRaster
            | null
            | undefined) ?? null),
    );
    return super.renderSubLayers({
      ...props,
      halo: paddedTile(center, block),
    } as WithHalo<SubLayerProps<T>>);
  }
}
