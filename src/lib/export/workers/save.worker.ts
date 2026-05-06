import type { SaveIn } from "@/lib/export/save";
import { save } from "@/lib/export/save";

type InMsg = SaveIn & {
  jobId: number;
};

type WorkerGlobal = typeof globalThis & {
  onmessage: ((e: MessageEvent<InMsg>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const w = globalThis as WorkerGlobal;

const readRasters = async (image, props) => {
  const interleave = false; //TODO
  const { window, width, height } = props;
  const raster = await image.readRasters({
    interleave,
    window,
    width,
    height,
  });
  /*
   * geotiff.js returns objects with different structure
   * depending on `interleave`. It's weird, but this seems to work.
   */
  const data = (interleave ? raster : raster[0]) as TypedArray;
  return {
    data,
    width: (raster as TypedArray & { width: number }).width,
    height: (raster as TypedArray & { height: number }).height,
  };
};

const toTileGetters = async (loaderData) => {
  const tileGetters = loaderData.map((data) => {
    const { tileExtents, tileImages, tileSize } = data;
    return ({ x, y, selection }) => {
      const { height, width } = tileExtents[`${x}-${y}`];
      const image = tileImages[selection.c];
      const x0 = x * tileSize;
      const y0 = y * tileSize;
      const window = [x0, y0, x0 + width, y0 + height];
      const raster = readRasters(image, { window, width, height });
    };
  });
  console.log({ tileGetters, worker: "ok" });
  return tileGetters;
};

w.onmessage = async (e: MessageEvent<InMsg>) => {
  const { jobId, index, loaderData, directory_handle } = e.data;
  try {
    const tileGetters = await toTileGetters(loaderData);
    await save({ index, tileGetters, directory_handle });
    console.log({ done: true, worker: "ok" });
    w.postMessage({ jobId });
  } catch (err) {
    w.postMessage({
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
