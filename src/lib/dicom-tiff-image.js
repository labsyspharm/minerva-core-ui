class DicomTIFFImage {
  constructor( opts ) {
    const { metadata, little_endian } = opts;
    const { Pixels } = metadata;
    const { TiffData } = Pixels;
    const { c, level } =  opts;
    this.level = level;
    this.c = c;
    // Initialize with default values that make sense for an empty GeoTIFF
    const TileWidth = 1024;
    const TileLength = 1024;
    const BytesPerSample = 2;

    this.series = opts.series;
    this.pyramids = opts.pyramids;
    this.TileByteCount = (
      TileWidth * TileLength * BytesPerSample
    )
    const BitsPerSample = TiffData.map(tiffdata => {
      return 8 * BytesPerSample;
    });
    const SampleFormat = TiffData.map(tiffdata => {
      return 1;
    });
    const TileByteCounts = TiffData.map(tiffdata => {
      return this.TileByteCount;
    });
    const TileOffsets = TiffData.map(tiffdata => {
      return tiffdata.IFD; // TODO -- not needed
    });
    const StripOffsets = TiffData.map(tiffdata => {
      return tiffdata.IFD; // TODO -- not needed
    });
    const StripByteCounts = TiffData.map(tiffdata => {
      return null; // TODO -- not needed
    });
    // TODO
    this.fileDirectory = {
      ImageWidth: Pixels.SizeX,
      ImageLength: Pixels.SizeY,
      SamplesPerPixel: 1,
      BitsPerSample: BitsPerSample,
      SampleFormat: SampleFormat,
      PhotometricInterpretation: 1, // TODO
      TileWidth: TileWidth,
      TileLength: TileLength,
      TileOffsets: TileOffsets,
      TileByteCounts: TileByteCounts,
      ModelTiepoint: [],
      ModelTransformation: [],
      StripOffsets: StripOffsets,
      StripByteCounts: StripByteCounts,
      RowsPerStrip: 1,
      PlanarConfiguration: 1,
      ColorMap: null,
      GDAL_METADATA: '',
      GDAL_NODATA: '0'
    };
    this.geoKeys = {
      GTRasterTypeGeoKey: 1
    };
    this.dataView = new DataView(
      new ArrayBuffer(this.TileByteCount)
    );
    this.littleEndian = little_endian;
    this.tiles = {};
    this.isTiled = true;
    this.planarConfiguration = 1;
  }

  getFileDirectory() {
    return this.fileDirectory;
  }

  getGeoKeys() {
    return this.geoKeys;
  }

  getWidth() {
    return this.fileDirectory.ImageWidth;
  }

  getHeight() {
    return this.fileDirectory.ImageLength;
  }

  getSamplesPerPixel() {
    return this.fileDirectory.SamplesPerPixel || 1;
  }

  getTileWidth() {
    return this.fileDirectory.TileWidth;
  }

  getTileHeight() {
    return this.fileDirectory.TileLength;
  }

  getBlockWidth() {
    return this.getTileWidth();
  }

  getBlockHeight(y) {
    return this.getTileHeight();
  }

  getBytesPerPixel() {
    return this.fileDirectory.BitsPerSample[0] / 8;
  }

  getSampleByteSize(i) {
    if (i >= this.fileDirectory.BitsPerSample.length) {
      throw new RangeError(`Sample index ${i} is out of range.`);
    }
    return Math.ceil(this.fileDirectory.BitsPerSample[i] / 8);
  }

  getSampleFormat(sampleIndex = 0) {
    return this.fileDirectory.SampleFormat[sampleIndex] || 1;
  }

  getBitsPerSample(sampleIndex = 0) {
    return this.fileDirectory.BitsPerSample[sampleIndex] || 8;
  }

  getArrayForSample(sampleIndex, size) {
    return new Uint8Array(size);
  }

  async getTileOrStrip(x, y, sample, pool, signal) {
    const { series, pyramids }  =  this;
    // TODO -- verify
    const c = this.c;
    const zoom = this.level;
    const pyramid = pyramids[c];
    const subpath = pyramid[zoom].frameMappings[
      `${y+1}-${x+1}-${c}`
    ];
    const numTilesPerRow = Math.ceil(
      this.getWidth() / this.getTileWidth()
    );
    const index = (y * numTilesPerRow) + x;
    const request = (
      async () => (
        await pool.fetch({ series, subpath })
      )
    )();
    const data = await request;
    console.log(
      x, y, c, zoom, data
    );
    return {
      x, y, sample, data
    };
  }

  async _readRaster(
    imageWindow, samples, valueArrays,
    pool, width, height, signal
  ) {
    const tileHeight = this.getTileHeight();
    const tileWidth = this.getTileWidth();
    const imageHeight = this.getHeight();
    const imageWidth = this.getWidth();

    const minXTile = Math.max(Math.floor(imageWindow[0] / tileWidth), 0);
    const maxXTile = Math.min(
      Math.ceil(imageWindow[2] / tileWidth),
      Math.ceil(imageWidth / tileWidth),
    );
    const minYTile = Math.max(Math.floor(imageWindow[1] / tileHeight), 0);
    const maxYTile = Math.min(
      Math.ceil(imageWindow[3] / tileHeight),
      Math.ceil(imageHeight / tileHeight),
    );
    const bytesPerPixel = this.getBytesPerPixel();
    const windowWidth = imageWindow[2] - imageWindow[0];
//    console.log(
//      `${maxXTile-minXTile} tiles in x,
//      ${maxYTile-minYTile} tiles in y`
//    )
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
              tileHeight, tileHeight - (lastLine - imageWindow[3]),
              imageHeight - firstLine
            );
            const xmax = Math.min(
              tileWidth, tileWidth - (lastCol - imageWindow[2]),
              imageWidth - firstCol
            );
            for (let y = y0; y < ymax; ++y) {
              for (let x = x0; x < xmax; ++x) {
                const pixelOffset = ((y * tileWidth) + x) * bytesPerPixel;
                const value = tile_dataview.getUint16(
                  pixelOffset * bytesPerPixel, this.littleEndian  
                );
                const windowCoordinate = (
                  (y + firstLine - imageWindow[1]) * windowWidth
                ) + x + firstCol - imageWindow[0];
                valueArrays[si][windowCoordinate] = value;
              }
            }
          });
        }));
      }
    }
    // TODO: this is odd --
    // It seems due to using loaders.gl,
    // viv.js expects a height and width
    // https://github.com/hms-dbmi/viv/blob/main/packages/loaders/src/tiff/pixel-source.ts#L68
    valueArrays["height"] = height;
    valueArrays["width"] = width;
    return valueArrays;
  }

  createValueArrays(imageWindow, samples) {
    const [x0, y0, x1, y1] = imageWindow;
    const numPixels = (x1 - x0) * (y1 - y0);

    const arrays = samples.map(sample => {
      return new Uint16Array(numPixels);
    });
    return arrays;
  }

  async readRasters(options = {}) {
    const { pool, signal } = options;
    const { height, width } = options;
    // TODO
    const samples = options.samples ?? [ 0 ];
    const validatedSamples = samples;
    if (!height || !width) {
      return []; //TODO -- unknown behavior
    }
    const imageWidth = this.getWidth();
    const imageHeight = this.getHeight();
    const imageWindow = options.window ?? [
      0, 0, width, height 
    ];
    const valueArrays = this.createValueArrays(
      imageWindow, samples
    );
    // Write to valueArrays
    const raster = await this._readRaster(
      imageWindow, samples, valueArrays,
      pool, width, height, signal
    );
    return valueArrays;
  }

  async readRGB(options = {}) {
    const size = options.width || 0;
    return new Uint8Array(size * 3);
  }

  getTiePoints() {
    return [];
  }

  getGDALMetadata(sample = null) {
    return {};
  }

  getGDALNoData() {
    return 0;
  }

  getOrigin() {
    return [0, 0, 0];
  }

  getResolution(referenceImage = null) {
    return [1, -1, 0];
  }

  pixelIsArea() {
    return true;
  }

  getBoundingBox(tilegrid = false) {
    return [0, 0, 0, 0];
  }
}

export { DicomTIFFImage }
