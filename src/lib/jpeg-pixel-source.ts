import type { JpegImage } from "./jpeg-image.js";

type Dtype =
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Int8"
  | "Int16"
  | "Int32"
  | "Float32"
  | "Float64";
type Selection = Record<"z" | "t" | "c", number>;
type Labels = [...("y" | "x" | "z" | "t" | "c")[], "y", "x"];
type Shape = [number, number, number, number, number];
type ReadRasterProps = {
  x?: number;
  y?: number;
  height?: number;
  width?: number;
  signal?: AbortSignal;
};

class JpegPixelSource {
  _indexer: (s: Selection) => JpegImage;
  tileSize: number;
  labels: Labels;
  shape: Shape;
  dtype: Dtype;

  constructor(
    indexer: (s: Selection) => JpegImage,
    tileSize: number,
    shape: Shape,
  ) {
    this._indexer = indexer;
    this.tileSize = tileSize;
    this.labels = ["z", "c", "t", "y", "x"];
    this.dtype = "Uint16";
    this.shape = shape;
  }

  async getRaster({ selection, signal }) {
    return await this.getTile({ x: 0, y: 0, selection, signal });
  }

  async getTile({ x, y, selection, signal }) {
    const { height, width } = this._getTileExtent(x, y);

    const image = this._indexer(selection);
    return this._readRasters(image, { x, y, width, height, signal });
  }

  async _readRasters(image: JpegImage, props: ReadRasterProps = {}) {
    const raster = await image.readRasters({
      ...props,
    });

    if (props.signal?.aborted) {
      throw "__vivSignalAborted";
    }

    const { data, width, height } = raster;
    return {
      data,
      width,
      height,
    };
  }

  _getTileExtent(_x: number, _y: number) {
    const height = this.tileSize;
    const width = this.tileSize;
    return { height, width };
  }

  onTileError(err) {
    console.error(err);
  }
}

export { JpegPixelSource };
