import {
  decodeCubeRootU8ToU16,
  type JpegExportTransfer,
} from "./cubeRootEncoding";
import type { LoaderPlane } from "./loaderTypes";
import type { Loader } from "./viv";

function expandCubeRootTileData(data: ArrayLike<number>): Uint16Array {
  const out = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = decodeCubeRootU8ToU16(data[i]);
  }
  return out;
}

/** Same expand as contrast JPEG pyramids (`jpegImage.ts`). */
function expandContrastBakedTileData(data: ArrayLike<number>): Uint16Array {
  const out = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = (data[i] & 0xff) << 8;
  }
  return out;
}

/**
 * Wrap Viv OME planes so JPEG-decoded uint8 tiles become uint16 for display.
 * Cube-root: inverse transfer. Contrast: `byte << 8` (baked window already applied).
 */
export function wrapOmeLoaderJpegExport(
  loader: Loader,
  transfer: JpegExportTransfer,
): Loader {
  const expand =
    transfer === "cube-root"
      ? expandCubeRootTileData
      : expandContrastBakedTileData;
  const data = loader.data?.map((plane) => {
    const getTile = plane.getTile?.bind(plane);
    if (!getTile) return plane;
    const wrapped: LoaderPlane = {
      ...plane,
      dtype: "Uint16",
      getTile: async (args) => {
        const tile = await getTile(args);
        const raw = tile.data as ArrayLike<number>;
        return { ...tile, data: expand(raw) };
      },
    };
    return wrapped;
  });
  return data ? { ...loader, data } : loader;
}
