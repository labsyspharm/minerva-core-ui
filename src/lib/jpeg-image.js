class JpegImage {
  constructor(opts) {
    const { tileSize } = { tileSize: 1024 }; //TODO
    this.level = opts.level;
    this.c = opts.c;
    this.tileSize = tileSize;
    this.imagePath = opts.imagePath;
    this.tileWidth = tileSize;
    this.tileHeight = tileSize;
    this.imageHeight = 27120; //TODO
    this.imageWidth = 26139; //TODO
  }

  async getTileOrStrip(x, y, sample) {
    const level = this.level; //TODO
    const ipath = this.imagePath;
    // TODO TODO TODO
    const lpath = [
      "c448b5c9f0b02d44d40093437c8d3233ef59a9cca802aef9aeea91ead96f5683",
      "f62cdd1d845de7d402cbe0775627238038e6eebc1a5377fc7c431450eca491e3",
    ][Math.min(this.c, 1)]; // TODO
    const fname = `${level}_${x}_${y}.jpg`;
    const url = `${ipath}/${lpath}/${fname}`;
    const response = await fetch(url);
    console.log({ url });
    const decoder = new ImageDecoder({
      data: response.body,
      type: "image/jpeg",
    });
    const { image } = await decoder.decode();
    const { displayWidth, displayHeight } = image;
    const data_length = displayWidth * displayHeight;
    console.log({ image });
    const tileSize = this.tileSize;
    const in_data = new Uint8Array(4 * data_length);
    const data = new Uint16Array(tileSize ** 2); // TODO
    await image.copyTo(in_data, { format: "RGBA" });
    for (let h = 0; h < displayHeight; h += 1) {
      for (let w = 0; w < displayWidth; w += 1) {
        const i = displayWidth * h + w;
        const j = tileSize * h + w;
        data[j] = in_data[i * 4] * 256;
      }
    }
    return { x, y, sample, data };
  }

  async _readRaster({ x, y, /*width, height,*/ sample }) {
    const { tileHeight, tileWidth } = this;
    const tile = await this.getTileOrStrip(x, y, sample);
    const data = new Uint16Array(tile.data.buffer);
    return {
      data,
      width: tileWidth,
      height: tileHeight,
    };
  }

  async readRasters(options = {}) {
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
    const scale = 2 ** (this.level - 1);
    return Math.round(this.imageWidth / scale);
  }

  getHeight() {
    const scale = 2 ** (this.level - 1);
    return Math.round(this.imageHeight / scale);
  }
}

export { JpegImage };
