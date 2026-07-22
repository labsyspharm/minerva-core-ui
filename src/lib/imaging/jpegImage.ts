import { JPEG_PYRAMID_TILE_SIZE } from "./jpegPyramid";

export type JpegTileFetcher = (
  folder: string,
  filename: string,
) => Promise<Blob>;

export type JpegImageOpts = {
  imagePath: string;
  level: number;
  c: number;
  /** SHA-256 folder name for this channel (required). */
  folder: string;
  imageWidth: number;
  imageHeight: number;
  tileSize?: number;
  /** Defaults to HTTP fetch under `imagePath/folder/filename`. */
  fetchTile?: JpegTileFetcher;
};

class JpegImage {
  level: number;
  c: number;
  tileSize: number;
  imagePath: string;
  folder: string;
  tileWidth: number;
  tileHeight: number;
  imageHeight: number;
  imageWidth: number;
  fetchTile: JpegTileFetcher;

  constructor(opts: JpegImageOpts) {
    const tileSize = opts.tileSize ?? JPEG_PYRAMID_TILE_SIZE;
    this.level = opts.level;
    this.c = opts.c;
    this.tileSize = tileSize;
    this.imagePath = opts.imagePath.replace(/\/$/, "");
    this.folder = opts.folder;
    this.tileWidth = tileSize;
    this.tileHeight = tileSize;
    this.imageHeight = opts.imageHeight;
    this.imageWidth = opts.imageWidth;
    this.fetchTile =
      opts.fetchTile ??
      (async (folder, filename) => {
        const url = `${this.imagePath}/${folder}/${filename}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`jpeg tile ${response.status}: ${url}`);
        }
        return response.blob();
      });
  }

  async getTileOrStrip(x: number, y: number, sample: number) {
    const fname = `${this.level}_${x}_${y}.jpg`;
    const blob = await this.fetchTile(this.folder, fname);
    const decoder = new ImageDecoder({
      data: await blob.arrayBuffer(),
      type: "image/jpeg",
    });
    const { image } = await decoder.decode();
    const { displayWidth, displayHeight } = image;
    const tileSize = this.tileSize;
    const copyOptions = {
      format: "BGRX" as const,
      layout: [{ offset: 0, stride: displayWidth * 4 }],
    };
    const in_data = new Uint8Array(image.allocationSize(copyOptions));
    // Viv expects a full tile buffer; pad short edge tiles with zeros.
    const data = new Uint16Array(tileSize ** 2);
    await image.copyTo(in_data, copyOptions);
    const rowWidth = Math.min(displayWidth, tileSize);
    const rowCount = Math.min(displayHeight, tileSize);
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < rowWidth; col += 1) {
        data[row * tileSize + col] =
          in_data[(row * displayWidth + col) * 4] << 8;
      }
    }
    image.close();
    decoder.close();
    return { x, y, sample, data };
  }

  async _readRaster({
    x,
    y,
    sample,
  }: {
    x: number;
    y: number;
    sample: number;
  }) {
    const { tileHeight, tileWidth } = this;
    const tile = await this.getTileOrStrip(x, y, sample);
    const data = new Uint16Array(tile.data.buffer);
    return {
      data,
      width: tileWidth,
      height: tileHeight,
    };
  }

  async readRasters(
    options: {
      x?: number;
      y?: number;
      height?: number;
      width?: number;
      samples?: number[];
    } = {},
  ) {
    const { x = 0, y = 0 } = options;
    const samples = options.samples ?? [0];
    const sample = samples[0];
    return this._readRaster({ x, y, sample });
  }

  getWidth() {
    const scale = 2 ** this.level;
    return Math.round(this.imageWidth / scale);
  }

  getHeight() {
    const scale = 2 ** this.level;
    return Math.round(this.imageHeight / scale);
  }
}

export { JpegImage };
