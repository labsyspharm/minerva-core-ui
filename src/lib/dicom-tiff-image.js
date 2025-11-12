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
    const bytesPerSample = 2;
    const { metadata, little_endian } = opts;
    const { tileSize } = opts.pyramids[0][0];
    const { Pixels } = metadata;
    this.Pixels = Pixels;
    this.level = opts.level;
    this.c = opts.c;
    this.series = opts.series;
    this.pyramids = opts.pyramids;
    this.littleEndian = little_endian;
    this.bytesPerSample = bytesPerSample;
    this.tileWidth = tileSize;
    this.tileHeight = tileSize;
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
      const ymax = Math.min(
        tileHeight, height, imageHeight - origin_y 
      );
      const xmax = Math.min(
        tileWidth, width, imageWidth - origin_x
      );
      const optimization = true;
      if ( littleEndianPlatform == this.littleEndian && optimization) {
        const data = new Uint16Array(tile.data.buffer);
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
        const fullTile = tileHeight * tileWidth;
        const full = data.length === fullTile;
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
      const fullTile = tileHeight * tileWidth;
      const full = data.length === fullTile;
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
