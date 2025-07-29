class DicomPixelSource {
  constructor(
    indexer,
    dtype,
    tileSize,
    shape,
    labels,
    meta,
    pool
  ) {
    this._indexer = indexer;
    this.dtype = dtype;
    this.tileSize = tileSize;
    this.shape = shape;
    this.labels = labels;
    this.meta = meta;
    this.pool = pool;
  }

  async getRaster({ selection, signal }) {
    const image = await this._indexer(selection);
    const { height, width } = this._getTileExtent(0,0);
    const window = [0, 0, width, height];
    return this._readRasters(
      image, { window, width, height, signal }
    );
  }

  async getTile({ x, y, selection, signal }) {
    const { height, width } = this._getTileExtent(x, y);
    const x0 = x * this.tileSize;
    const y0 = y * this.tileSize;
    const window = [x0, y0, x0 + width, y0 + height];

    const image = await this._indexer(selection);
    return this._readRasters(
      image, { window, width, height, signal }
    );
  }

  async _readRasters(image, props = {}) {
    const raster = await image.readRasters({
      ...props, pool: this.pool
    });

    if (props.signal?.aborted) {
      throw "__vivSignalAborted";
    }

    const { data, width, height } = raster;
    return {
      data, width, height
    };
  }

  _getTileExtent(x, y) {
    const [
      zoomLevelHeight, zoomLevelWidth
    ] = this.shape.slice(-2);
    let height = this.tileSize;
    let width = this.tileSize;
    const maxXTileCoord = Math.floor(zoomLevelWidth / this.tileSize);
    const maxYTileCoord = Math.floor(zoomLevelHeight / this.tileSize);
    
    if (x === maxXTileCoord) {
      width = zoomLevelWidth % this.tileSize;
    }
    if (y === maxYTileCoord) {
      height = zoomLevelHeight % this.tileSize;
    }
    return { height, width };
  }

  onTileError(err) {
    console.error(err);
  }
}

export { DicomPixelSource };
