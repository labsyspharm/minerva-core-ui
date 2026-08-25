import {
  dtypeFromTiffDirectory,
  type GeoTiff,
  type GeoTiffImage,
  isTiffTiled,
  PHOTOMETRIC_RGB,
  padTiffSampleTags,
  parseFirstOmeImagePixels,
  resolveSubIfdPyramidImages,
  vivTileSize,
} from "./geotiffUtils";
import type { HasTile, LoaderPlane } from "./loaderTypes";
import type { Loader } from "./viv";
import type { PoolClass } from "./workers/pool";

const RGB_SAMPLES = [0, 1, 2];
const RGB_LABELS: LoaderPlane["labels"] = ["t", "c", "z", "y", "x", "_c"];

type OmePixelMetadata = Loader["metadata"]["Pixels"];

type RasterRead = ArrayLike<number> & { width?: number; height?: number };

async function readPlanarRgbInterleaved(
  image: GeoTiffImage,
  pool: PoolClass | undefined,
  window?: [number, number, number, number],
  outWidth?: number,
  outHeight?: number,
): Promise<HasTile> {
  padTiffSampleTags(image.fileDirectory);
  const raster = (await image.readRasters({
    samples: RGB_SAMPLES,
    interleave: true,
    ...(window ? { window, width: outWidth, height: outHeight } : {}),
    ...(pool ? { pool } : {}),
  })) as RasterRead;
  return {
    data: raster as unknown as HasTile["data"],
    width: raster.width ?? outWidth ?? image.getWidth(),
    height: raster.height ?? outHeight ?? image.getHeight(),
  };
}

function planarRgbPlaneFromImage(
  image: GeoTiffImage,
  dtype: LoaderPlane["dtype"],
  pool: PoolClass | undefined,
  physicalSizeX: number,
  physicalSizeY: number,
  physicalSizeXUnit: string,
  physicalSizeYUnit: string,
): LoaderPlane {
  const width = image.getWidth();
  const height = image.getHeight();
  const tiled = isTiffTiled(image);
  const tileSize = tiled ? vivTileSize(image) : Math.max(width, height, 1);
  const getRaster = async ({ signal }: { signal?: AbortSignal }) => {
    const raster = await readPlanarRgbInterleaved(image, pool);
    if (signal?.aborted) throw "__vivSignalAborted";
    return raster;
  };
  return {
    dtype,
    shape: [1, 1, 1, height, width, 3],
    tileSize,
    labels: RGB_LABELS,
    meta: {
      photometricInterpretation: PHOTOMETRIC_RGB,
      physicalSizes: {
        x: { size: physicalSizeX, unit: physicalSizeXUnit },
        y: { size: physicalSizeY, unit: physicalSizeYUnit },
      },
    },
    onTileError: (err) => {
      console.error(err);
    },
    getRaster,
    getTile: tiled
      ? async ({ x, y, signal }) => {
          const x0 = x * tileSize;
          const y0 = y * tileSize;
          const x1 = Math.min(x0 + tileSize, width);
          const y1 = Math.min(y0 + tileSize, height);
          const w = x1 - x0;
          const h = y1 - y0;
          const raster = await readPlanarRgbInterleaved(
            image,
            pool,
            [x0, y0, x1, y1],
            w,
            h,
          );
          if (signal?.aborted) throw "__vivSignalAborted";
          return raster;
        }
      : async ({ x, y, signal }) => {
          if (x !== 0 || y !== 0) {
            return { data: new Uint8Array(0), width: 0, height: 0 };
          }
          return getRaster({ signal });
        },
  };
}

/**
 * Load photometric-RGB planar OME-TIFF (one IFD, samples as separate planes)
 * as a Viv interleaved RGB pyramid. Call only after detecting planar RGB.
 */
export async function loadPlanarRgbOmeTiff(
  tiff: GeoTiff,
  baseImage: GeoTiffImage,
  pool?: PoolClass,
): Promise<Loader> {
  padTiffSampleTags(baseImage.fileDirectory);
  const pyramidImages = await resolveSubIfdPyramidImages(tiff, baseImage);
  for (const image of pyramidImages) {
    padTiffSampleTags(image.fileDirectory);
  }
  const fd = baseImage.fileDirectory;
  const width = baseImage.getWidth();
  const height = baseImage.getHeight();
  const dtype = dtypeFromTiffDirectory(fd);
  const ome = parseFirstOmeImagePixels(fd.ImageDescription);
  const channelName =
    ome?.firstChannelSamples === 3 && ome.firstChannelName
      ? ome.firstChannelName
      : "RGB";
  const pixels: OmePixelMetadata = {
    ID: ome?.ID ?? "Pixels:0",
    DimensionOrder: "XYZCT",
    // Viv extractChannels H&E group matches `Uint8`, not OME `uint8`.
    Type: dtype,
    SizeT: 1,
    SizeC: 1,
    SizeZ: 1,
    SizeY: height,
    SizeX: width,
    PhysicalSizeX: ome?.PhysicalSizeX ?? 1,
    PhysicalSizeY: ome?.PhysicalSizeY ?? 1,
    PhysicalSizeXUnit: ome?.PhysicalSizeXUnit ?? "µm",
    PhysicalSizeYUnit: ome?.PhysicalSizeYUnit ?? "µm",
    PhysicalSizeZUnit: ome?.PhysicalSizeZUnit ?? "µm",
    BigEndian: ome?.BigEndian ?? false,
    TiffData: [],
    Channels: [
      {
        ID: "Channel:0:0",
        Name: channelName,
        SamplesPerPixel: 3,
      },
    ],
  };
  return {
    data: pyramidImages.map((image) =>
      planarRgbPlaneFromImage(
        image,
        dtype,
        pool,
        pixels.PhysicalSizeX,
        pixels.PhysicalSizeY,
        pixels.PhysicalSizeXUnit,
        pixels.PhysicalSizeYUnit,
      ),
    ),
    metadata: {
      ID: "Image:0",
      AquisitionDate: "",
      Description: "",
      Pixels: pixels,
      ROIs: [],
    },
  } as Loader;
}
