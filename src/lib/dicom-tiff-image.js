import { fetchFrame } from './fetch-frame';

const littleEndianPlatform = (() => {
  const uint16 = new Uint16Array( 1 );
	uint16[ 0 ] = 0x1234;
	return (
    new Uint8Array( uint16.buffer )[ 0 ] === 0x34
  );
})();

class DicomTIFFImage {
  constructor(opts) {
    const { metadata, little_endian } = opts;
    const { tileSize } = opts.pyramids[0][0];
    const { Pixels } = metadata;
    const rgbImage = Pixels.Type === "Uint8";
    const bytesPerSample = rgbImage ? 3 : 2;
    this.Pixels = Pixels;
    this.level = opts.level;
    this.c = opts.c;
    this.series = opts.series;
    this.pyramids = opts.pyramids;
    this.littleEndian = little_endian;
    this.bytesPerSample = bytesPerSample;
    this.tileWidth = tileSize;
    this.tileHeight = tileSize;
    this.rgbImage = rgbImage;
  }

  getPyramid() {
    const n_levels = this.pyramids[this.c].length - 1;
    const pyramid_level = n_levels - this.level;
    const pyramid = this.pyramids[this.c][pyramid_level];
    return pyramid;
  }

  async getTileOrStrip(x, y, sample, signal) {
    const pyramid = this.getPyramid();
    const subpath = pyramid.frameMappings[`${y+1}-${x+1}-${this.c}`];
    const request = await fetchFrame({ series: this.series, subpath, signal });
    return { x, y, sample, data: request };
  }

  async _readRaster({
    x, y, width, height, sample, signal
  }) {
    const { tileHeight, tileWidth } = this;
    const imageHeight = this.getHeight();
    const imageWidth = this.getWidth();
    const origin_x = x * this.tileWidth;
    const origin_y = y * this.tileHeight;
    return await this.getTileOrStrip(
        x, y, sample, signal
    ).then((tile) => {
      const fullTile = tileHeight * tileWidth;
      const ymax = Math.min(
        tileHeight, height, imageHeight - origin_y 
      );
      const xmax = Math.min(
        tileWidth, width, imageWidth - origin_x
      );
      if (this.rgbImage) {
        const rgb = new Uint8ClampedArray(tile.data.buffer);
        const rgba = new Uint8ClampedArray(rgb.length * 4 / 3);
        for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
          rgba[j] = rgb[i];
          rgba[j + 1] = rgb[i + 1];
          rgba[j + 2] = rgb[i + 2];
          rgba[j + 3] = 255;
        }
        const samples = 4;
        const full = Math.round(
          rgba.length / samples
        ) === fullTile;
        return {
          data: rgba,
          width: full ? tileWidth: xmax,
          height: full ? tileHeight: ymax
        }
      }
      const optimization = true;
      if ( littleEndianPlatform == this.littleEndian && optimization) {
        const data = new Uint16Array(tile.data.buffer);
        const full = data.length === fullTile;
        // Blackout missing data
        for (let pixel_y = ymax; pixel_y < tileHeight; ++pixel_y) {
          for (let pixel_x = 0; pixel_x < tileWidth; ++pixel_x) {
            const windowCoordinate = ( pixel_y * tileWidth ) + pixel_x;
            data[windowCoordinate] = 0;
          }
        }
        // Blackout missing data
        for (let pixel_x = xmax; pixel_x < tileWidth; ++pixel_x) {
          for (let pixel_y = 0; pixel_y < tileHeight; ++pixel_y) {
            const windowCoordinate = ( pixel_y * tileWidth ) + pixel_x;
            data[windowCoordinate] = 0;
          }
        }
        return {
          data,
          width: full ? tileWidth: xmax,
          height: full ? tileHeight: ymax
        }
      }
      const data = new Uint16Array(ymax * xmax);
      for (let pixel_y = 0; pixel_y < ymax; ++pixel_y) {
        for (let pixel_x = 0; pixel_x < xmax; ++pixel_x) {
          const windowCoordinate = ( pixel_y * tileWidth ) + pixel_x;
          data[windowCoordinate] = tile.data.getUint16(
            windowCoordinate * this.bytesPerSample, this.littleEndian
          );
        }
      }
      return {
        data,
        width: full ? tileWidth: xmax,
        height: full ? tileHeight: ymax
      }
    });
  }

  async readRasters(options = {}) {
    const { signal } = options;
    const { x, y, height, width } = options;
    const samples = options.samples ?? [0];
    const origin_x = x * this.tileWidth;
    const origin_y = y * this.tileHeight;
    const sample = samples[0]
    const raster = await this._readRaster({
      x, y, width, height, sample, signal
    });
    return raster;
  }

  getWidth() {
    return this.getPyramid().width;
  }

  getHeight() {
    return this.getPyramid().height;
  }
}

export { DicomTIFFImage };
