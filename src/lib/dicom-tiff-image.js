class DicomTIFFImage {
  constructor(opts) {
    const bytesPerSample = 2;
    const { metadata, little_endian } = opts;
    const { tileSize } = opts.pyramids[0][0];
    const { Pixels } = metadata;
    const { TiffData } = Pixels;
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

  async getTileOrStrip(x, y, sample, pool, signal) {
    const n_levels = this.pyramids[this.c].length - 1;
    const pyramid_level = n_levels - this.level;
    const pyramid = this.pyramids[this.c][pyramid_level];
    const subpath = pyramid.frameMappings[`${y+1}-${x+1}-${this.c}`];
    const request = await pool.fetch({ series: this.series, subpath });
    return { x, y, sample, data: request };
  }

  createValueArrays(imageWindow, samples) {
    const [x0, y0, x1, y1] = imageWindow;
    const numPixels = (x1 - x0) * (y1 - y0);
    return samples.map(() => new Uint16Array(numPixels));
  }

  async _readRaster(imageWindow, samples, valueArrays, pool, width, height, signal) {
    const { tileHeight, tileWidth } = this;
    const imageHeight = this.getHeight();
    const imageWidth = this.getWidth();

    const minXTile = Math.max(Math.floor(imageWindow[0] / tileWidth), 0);
    const maxXTile = Math.min(
      Math.ceil(imageWindow[2] / tileWidth),
      Math.ceil(imageWidth / tileWidth)
    );
    const minYTile = Math.max(Math.floor(imageWindow[1] / tileHeight), 0);
    const maxYTile = Math.min(
      Math.ceil(imageWindow[3] / tileHeight),
      Math.ceil(imageHeight / tileHeight)
    );

    for (let yTile = minYTile; yTile < maxYTile; ++yTile) {
      for (let xTile = minXTile; xTile < maxXTile; ++xTile) {
        await Promise.all(samples.map((sample, si) => {
          return this.getTileOrStrip(
            xTile, yTile, sample, pool, signal
          ).then((tile) => {
            const tile_dataview = tile.data;
            const firstCol = tile.x * tileWidth;
            const firstLine = tile.y * tileHeight;
            const lastCol = (tile.x + 1) * tileWidth;
            const lastLine = firstLine + tileHeight;

            const y0 = Math.max(0, imageWindow[1] - firstLine);
            const x0 = Math.max(0, imageWindow[0] - firstCol);

            const ymax = Math.min(
              tileHeight, 
              tileHeight - (lastLine - imageWindow[3]),
              imageHeight - firstLine
            );
            const xmax = Math.min(
              tileWidth, 
              tileWidth - (lastCol - imageWindow[2]),
              imageWidth - firstCol
            );

            for (let y = y0; y < ymax; ++y) {
              for (let x = x0; x < xmax; ++x) {
                const pixelOffset = ((y * tileWidth) + x);
                const value = tile_dataview.getUint16(
                  pixelOffset * this.bytesPerSample, this.littleEndian
                );
                const windowCoordinate = (
                  (y + firstLine - imageWindow[1]) * width
                ) + (
                  x + firstCol - imageWindow[0]
                );
                valueArrays[si][windowCoordinate] = value;
              }
            }
          });
        }));
      }
    }
    return {
      data: valueArrays[0],
      width,
      height
    };
  }

  async readRasters(options = {}) {
    const { pool, signal } = options;
    const { height, width } = options;
    const samples = options.samples ?? [0];
    
    const imageWindow = options.window ?? [0, 0, width, height];
    const valueArrays = this.createValueArrays(imageWindow, samples);
    
    const raster = await this._readRaster(
      imageWindow, samples, valueArrays,
      pool, width, height, signal
    );
    return raster;
  }

  getWidth() {
    return this.Pixels.SizeX;
  }

  getHeight() {
    return this.Pixels.SizeY;
  }
}

export { DicomTIFFImage };
