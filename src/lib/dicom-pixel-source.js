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
    this.tileCache = {};
    this.shape = shape;
    this.labels = labels;
    this.meta = meta;
    this.pool = pool;
  }

  async getRaster({ selection, signal }) {
    const image = await this._indexer(selection);
    return await this.getTile(
      { x: 0, y: 0, selection, signal }
    );
  }

  async getTile({ x, y, selection, signal }) {
    const { height, width } = this._getTileExtent(x, y);

    const image = await this._indexer(selection);
    return this._readRasters(
      image, { x, y, width, height, signal }
    );
  }

  async _readRasters(image, props = {}) {
    const index = [ image.c, props.x, props.y ].join('-');
    let raster = this.tileCache[index];
    if (raster) {
      console.log(`"Okay, tile "${index}" is cached!`)
    }
    if (!raster) {
      raster = await image.readRasters({
        ...props, pool: this.pool
      });
      this.tileCache[index] = raster;
    }

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
