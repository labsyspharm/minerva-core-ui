class JpegImage {
  constructor(opts) {
    const { tileSize } = { tileSize: 1024 }; //TODO
    this.level = opts.level;
    this.c = opts.c;
    this.imagePath = opts.imagePath;
    this.tileWidth = tileSize;
    this.tileHeight = tileSize;
    this.imageHeight = 27120; //TODO
    this.imageWidth = 26139; //TODO
    this.n_levels = 6; //TODO
  }

  async getTileOrStrip(x, y, sample) {
    const max = this.n_levels;
    const level = this.level;
    const zoom = max - level;
    const ipath = this.imagePath;
    // TODO TODO TODO
    const lpath = [
      "c448b5c9f0b02d44d40093437c8d3233ef59a9cca802aef9aeea91ead96f5683",
      "f62cdd1d845de7d402cbe0775627238038e6eebc1a5377fc7c431450eca491e3",
    ][Math.min(this.c, 1)]; // TODO
    const fname = `${zoom}_${x}_${y}.jpg`;
    const url = `${ipath}/${lpath}/${fname}`;
    /*    const response = await fetch(url);
    const decoder = new ImageDecoder({
      data: response.body,
      type: "image/jpeg",
    });
    const { image } = await decoder.decode();
    const in_data = new Uint8Array(4 * 1024 * 1024); // TODO
    */
    const data = new Uint16Array(1024 * 1024); // TODO
    //image.copyTo(in_data);
    for (let i = 0; i < data.length; i += 1) {
      //data[i] = in_data[i * 4] * 256;
      data[i] = Math.round(Math.random() * 65535);
    }
    return { x, y, sample, data };
  }

  async _readRaster({ x, y, width, height, sample }) {
    const { tileHeight, tileWidth } = this;
    const imageHeight = this.imageHeight;
    const imageWidth = this.imageWidth;
    const origin_x = x * this.tileWidth;
    const origin_y = y * this.tileHeight;
    return await this.getTileOrStrip(x, y, sample).then((tile) => {
      const fullTile = tileHeight * tileWidth;
      const ymax = Math.min(tileHeight, height, imageHeight - origin_y);
      const xmax = Math.min(tileWidth, width, imageWidth - origin_x);
      const data = new Uint16Array(tile.data.buffer);
      const full = data.length === fullTile;
      // Blackout missing data
      for (let pixel_y = ymax; pixel_y < tileHeight; ++pixel_y) {
        for (let pixel_x = 0; pixel_x < tileWidth; ++pixel_x) {
          const windowCoordinate = pixel_y * tileWidth + pixel_x;
          data[windowCoordinate] = 0;
        }
      }
      // Blackout missing data
      for (let pixel_x = xmax; pixel_x < tileWidth; ++pixel_x) {
        for (let pixel_y = 0; pixel_y < tileHeight; ++pixel_y) {
          const windowCoordinate = pixel_y * tileWidth + pixel_x;
          data[windowCoordinate] = 0;
        }
      }
      return {
        data,
        width: full ? tileWidth : xmax,
        height: full ? tileHeight : ymax,
      };
    });
  }

  async readRasters(options = {}) {
    const { signal } = options;
    const { x, y, height, width } = options;
    const samples = options.samples ?? [0];
    const _origin_x = x * this.tileWidth;
    const _origin_y = y * this.tileHeight;
    const sample = samples[0];
    const raster = await this._readRaster({
      x,
      y,
      width,
      height,
      sample,
    });
    return raster;
  }

  getWidth() {
    return this.imageWidth;
  }

  getHeight() {
    return this.imageHeight;
  }
}

export { JpegImage };
