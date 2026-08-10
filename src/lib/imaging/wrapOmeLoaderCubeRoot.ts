import { decodeCubeRootU8ToU16 } from "./cubeRootEncoding";
import type { LoaderPlane } from "./loaderTypes";
import type { Loader } from "./viv";

function expandCubeRootTileData(data: ArrayLike<number>): Uint16Array {
  const out = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = decodeCubeRootU8ToU16(data[i]);
  }
  return out;
}

/**
 * Wrap Viv OME planes so JPEG-decoded uint8 cube-root codes become uint16
 * intensities for contrast editing / display.
 */
export function wrapOmeLoaderCubeRoot(loader: Loader): Loader {
  const data = loader.data?.map((plane) => {
    const getTile = plane.getTile?.bind(plane);
    if (!getTile) return plane;
    const wrapped: LoaderPlane = {
      ...plane,
      dtype: "Uint16",
      getTile: async (args) => {
        const tile = await getTile(args);
        const raw = tile.data as ArrayLike<number>;
        return { ...tile, data: expandCubeRootTileData(raw) };
      },
    };
    return wrapped;
  });
  return data ? { ...loader, data } : loader;
}
