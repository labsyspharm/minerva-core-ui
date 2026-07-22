import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { JpegImage } from "./jpegImage";
import { JpegPixelSource } from "./jpegPixelSource";
import {
  JPEG_BAKED_CONTRAST_LIMIT,
  JPEG_PYRAMID_TILE_SIZE,
  jpegPyramidLevels,
} from "./jpegPyramid";
import { VIV_TILE_DEBOUNCE_MS, VIV_TILE_MAX_REQUESTS } from "./viv";

function createJpegLayers(meta) {
  const { channelsVisible, colors, selections } = meta.settings;
  const visible = channelsVisible.some((x) => x);
  const { imagePath, jpegLoader, channelFolders } = meta;
  const imageID = String(imagePath).replace(/\//g, "-");
  // Contrast is baked into tiles; keep Viv at full range.
  const contrastLimits = (meta.settings.contrastLimits || []).map(
    () => JPEG_BAKED_CONTRAST_LIMIT,
  );
  const imageProps = {
    visible,
    loader: jpegLoader,
    refinementStrategy: "no-overlap",
    maxRequests: VIV_TILE_MAX_REQUESTS,
    debounceTime: VIV_TILE_DEBOUNCE_MS,
    id: `${imageID}-${Object.values(channelFolders || {}).join("-")}-${selections?.map((s) => s.c).join("-")}`,
    channelsVisible,
    colors,
    contrastLimits,
    selections,
  };
  return new MultiscaleImageLayer(imageProps);
}

const toIndexer = (opts) => {
  const {
    imagePath,
    channelFolders,
    imageWidth,
    imageHeight,
    tileSize,
    fetchTile,
  } = opts;
  return (sel, level) => {
    const folder = channelFolders?.[sel.c];
    if (!folder) {
      // Do not throw here — that aborts the whole JPEG layer. Warn and let tile
      // fetch fail for this channel until channelFolders is populated/synced.
      console.warn(`jpeg: no pyramid folder for channel index ${sel.c}`);
    }
    return new JpegImage({
      imagePath,
      level,
      c: sel.c,
      folder: folder ?? "",
      imageWidth,
      imageHeight,
      tileSize,
      fetchTile,
    });
  };
};

const getShapeForBinaryDownsampleLevel = (options) => {
  const { axes, level } = options;
  const xIndex = axes.labels.indexOf("x");
  const yIndex = axes.labels.indexOf("y");
  const resolutionShape = axes.shape.slice();
  resolutionShape[xIndex] = axes.shape[xIndex] >> level;
  resolutionShape[yIndex] = axes.shape[yIndex] >> level;
  return resolutionShape;
};

const loadJpeg = (meta) => {
  const {
    imagePath,
    imageWidth,
    imageHeight,
    channels,
    channelFolders,
    tileSize = JPEG_PYRAMID_TILE_SIZE,
    fetchTile,
  } = meta;
  const width = imageWidth;
  const height = imageHeight;
  const nChannels = Math.max(1, channels?.length ?? 1);
  const levels = meta.levels ?? jpegPyramidLevels(width, height, tileSize);
  const pyramidIndexer = toIndexer({
    imagePath,
    channelFolders,
    imageWidth: width,
    imageHeight: height,
    tileSize,
    fetchTile,
  });
  const data = levels.map((level) => {
    const axes = {
      labels: ["t", "c", "z", "y", "x"],
      shape: [1, nChannels, 1, height, width],
    };
    return new JpegPixelSource(
      (sel) => pyramidIndexer(sel, level),
      tileSize,
      getShapeForBinaryDownsampleLevel({
        axes,
        level,
      }),
    );
  });
  const omeChannels = (channels ?? []).map((ch, i) => ({
    ID: ch.id ?? `Channel:${i}`,
    Name: ch.name || `Channel ${i}`,
    SamplesPerPixel: 1,
  }));
  while (omeChannels.length < nChannels) {
    const i = omeChannels.length;
    omeChannels.push({
      ID: `Channel:${i}`,
      Name: `Channel ${i}`,
      SamplesPerPixel: 1,
    });
  }
  return {
    data,
    metadata: {
      Pixels: {
        Channels: omeChannels,
        Type: "Uint16",
        ID: "JpegPixels",
        DimensionOrder: "TCZYX",
        SamplesPerPixel: 1,
        SizeT: 1,
        SizeC: nChannels,
        SizeZ: 1,
        SizeY: height,
        SizeX: width,
        PhysicalSizeX: 1,
        PhysicalSizeY: 1,
        PhysicalSizeZ: 1,
        PhysicalSizeXUnit: "µm",
        PhysicalSizeYUnit: "µm",
        PhysicalSizeZUnit: "µm",
        BigEndian: false,
        TiffData: null,
      },
      ID: "JpegImage",
      AquisitionDate: new Date().toISOString().split("T")[0],
      Description: "",
      ROIs: [],
    },
  };
};

export { createJpegLayers, loadJpeg };
