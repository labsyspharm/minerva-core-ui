import { type JpegExportTransfer, u8ToU16Lut } from "./cubeRootEncoding";
import { expandThroughLut } from "./expandThroughLut";
import { JPEG_PYRAMID_TILE_SIZE } from "./jpegPyramid";
import { sharedOmeDecodePool } from "./omeDecodePool";

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
  transfer?: JpegExportTransfer;
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
  transfer: JpegExportTransfer;
  /** One grayscale JPEG tile, described as a TIFF tile for the decode worker. */
  tileDirectory: Record<string, number>;

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
    this.transfer = opts.transfer ?? "contrast";
    this.tileDirectory = {
      Compression: 7,
      SamplesPerPixel: 1,
      TileWidth: tileSize,
      TileLength: tileSize,
    };
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
    // The decoder pads short edge tiles, so this is the full tile Viv expects.
    const bytes = new Uint8Array(
      await sharedOmeDecodePool().decode(
        this.tileDirectory,
        await blob.arrayBuffer(),
      ),
    );
    const data = expandThroughLut(bytes, u8ToU16Lut(this.transfer));
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
