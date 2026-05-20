import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { JpegImage } from "../jpeg-image";
import { JpegPixelSource } from "../jpeg-pixel-source";

function createJpegLayers(meta) {
  const { channelsVisible, colors, contrastLimits, selections } = meta.settings;
  const visible = channelsVisible.some((x) => x);
  const { imagePath, jpegLoader } = meta;
  const imageID = imagePath.replace("/", "-");
  const imageProps = {
    visible,
    loader: jpegLoader,
    // https://deck.gl/docs/api-reference/geo-layers/tile-layer#refinementstrategy
    refinementStrategy: "best-available",
    // Include contrast limits in ID to force layer recreation when they change
    // This prevents flash when switching channel groups
    id: `${imageID}-${contrastLimits.map(([l, u]) => `${l}-${u}`).join("-")}`,
    channelsVisible,
    colors,
    contrastLimits,
    selections,
  };
  console.log(imageProps.loader, "jpeg");
  return new MultiscaleImageLayer(imageProps);
}

const toIndexer = (opts) => {
  const { imagePath } = opts;
  return (sel, level) => {
    return new JpegImage({
      imagePath,
      level,
      ...sel,
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
  const { imagePath, imageWidth, imageHeight } = meta;
  const width = imageWidth;
  const height = imageHeight;
  const nChannels = 2; // TODO
  const tileSize = 1024; // TODO
  const levels = [0, 1, 2, 3, 4, 5, 6]; // TODO
  const pyramidIndexer = toIndexer({
    imagePath,
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
  return {
    data,
    metadata: {
      Pixels: {
        Channels: [
          {
            Name: "DNA1",
            SamplesPerPixel: 1,
          },
          {
            Name: "AF488",
            SamplesPerPixel: 1,
          },
        ],
        Type: "Uint16",
      },
    },
  };
};

export { createJpegLayers, loadJpeg };
