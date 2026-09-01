import { fetchFrame } from "./fetchFrame";

const littleEndianPlatform = (() => {
  const uint16 = new Uint16Array(1);
  uint16[0] = 0x1234;
  return new Uint8Array(uint16.buffer)[0] === 0x34;
})();

class DicomTIFFImage {
  constructor(opts) {
    const { metadata, little_endian } = opts;
    const { Pixels } = metadata;
    const rgbImage = Pixels.Type === "Uint8";
    this.Pixels = Pixels;
    this.level = opts.level;
    this.c = opts.c;
    this.series = opts.series;
    // Keys are Viv channel indices ("0"…"N") after pyramidsForChannelIndex.
    this.pyramids = opts.pyramids;
    this.littleEndian = little_endian;
    this.bytesPerSample = rgbImage ? 3 : 2;
    this.rgbImage = rgbImage;
  }

  getPyramid() {
    const levels = this.pyramids[String(this.c)];
    if (!Array.isArray(levels) || levels.length === 0) {
      throw new Error(
        `[minerva] dicom: no pyramid levels for channel ${this.c}`,
      );
    }
    // Viv level 0 = full resolution (finest→coarsest).
    const pyramid = levels[this.level];
    if (!pyramid) {
      throw new Error(
        `[minerva] dicom: missing pyramid level ${this.level} for channel ${this.c}`,
      );
    }
    return pyramid;
  }

  get tileWidth() {
    return this.getPyramid().tileSize;
  }

  get tileHeight() {
    return this.getPyramid().tileSize;
  }

  async getTileOrStrip(x, y, sample, signal) {
    const pyramid = this.getPyramid();
    const subpath = pyramid.frameMappings[`${y + 1}-${x + 1}-${this.c}`];
    if (!subpath) {
      throw "__minervaEmptyFramePath";
    }
    const request = await fetchFrame({ series: this.series, subpath, signal });
    return { x, y, sample, data: request };
  }

  async _readRaster({ x, y, width, height, sample, signal }) {
    const { tileHeight, tileWidth } = this;
    const imageHeight = this.getHeight();
    const imageWidth = this.getWidth();
    const origin_x = x * this.tileWidth;
    const origin_y = y * this.tileHeight;
    return this.getTileOrStrip(x, y, sample, signal).then((tile) => {
      const fullTile = tileHeight * tileWidth;
      const ymax = Math.min(tileHeight, height, imageHeight - origin_y);
      const xmax = Math.min(tileWidth, width, imageWidth - origin_x);
      if (this.rgbImage) {
        const rgb = new Uint8ClampedArray(tile.data.buffer);
        const rgba = new Uint8ClampedArray((rgb.length * 4) / 3);
        for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
          rgba[j] = rgb[i];
          rgba[j + 1] = rgb[i + 1];
          rgba[j + 2] = rgb[i + 2];
          rgba[j + 3] = 255;
        }
        const samples = 4;
        const full = Math.round(rgba.length / samples) === fullTile;
        return {
          data: rgba,
          width: full ? tileWidth : xmax,
          height: full ? tileHeight : ymax,
        };
      }
      if (littleEndianPlatform === this.littleEndian) {
        const data = new Uint16Array(
          tile.data.buffer,
          tile.data.byteOffset,
          tile.data.byteLength / 2,
        );
        const full = data.length === fullTile;
        for (let pixel_y = ymax; pixel_y < tileHeight; ++pixel_y) {
          for (let pixel_x = 0; pixel_x < tileWidth; ++pixel_x) {
            data[pixel_y * tileWidth + pixel_x] = 0;
          }
        }
        for (let pixel_x = xmax; pixel_x < tileWidth; ++pixel_x) {
          for (let pixel_y = 0; pixel_y < tileHeight; ++pixel_y) {
            data[pixel_y * tileWidth + pixel_x] = 0;
          }
        }
        return {
          data,
          width: full ? tileWidth : xmax,
          height: full ? tileHeight : ymax,
        };
      }
      const data = new Uint16Array(ymax * xmax);
      for (let pixel_y = 0; pixel_y < ymax; ++pixel_y) {
        for (let pixel_x = 0; pixel_x < xmax; ++pixel_x) {
          data[pixel_y * tileWidth + pixel_x] = tile.data.getUint16(
            (pixel_y * tileWidth + pixel_x) * this.bytesPerSample,
            this.littleEndian,
          );
        }
      }
      return { data, width: xmax, height: ymax };
    });
  }

  async readRasters(options = {}) {
    const { signal, x, y, height, width } = options;
    const sample = (options.samples ?? [0])[0];
    return this._readRaster({ x, y, width, height, sample, signal });
  }

  getWidth() {
    return this.getPyramid().width;
  }

  getHeight() {
    return this.getPyramid().height;
  }
}

export { DicomTIFFImage };
