import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { DicomTIFFImage } from "./dicom-tiff-image";
import { DicomPixelSource } from "./dicom-pixel-source";
import * as dcmjs from 'dcmjs'
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary

function _groupFramesPerMapping (metadata) {
  const mappings = {}
  const sharedItem = metadata.SharedFunctionalGroupsSequence[0]
  if (sharedItem.RealWorldValueMappingSequence !== undefined) {
    const labels = sharedItem.RealWorldValueMappingSequence.map(
      item => item.LUTLabel
    )
    const key = labels.join('-')
    const numFrames = Number(metadata.NumberOfFrames)
    mappings[key] = {
      frameNumbers: [...Array(numFrames).keys()].map(index => index + 1),
      realWorldValueMappings: sharedItem.RealWorldValueMappingSequence
    }
  } else {
    // Dimension Organization TILED_FULL is not defined for Parametric Map
    if (metadata.PerFrameFunctionalGroupsSequence !== undefined) {
      metadata.PerFrameFunctionalGroupsSequence.forEach((frameItem, i) => {
        if (frameItem.RealWorldValueMappingSequence !== undefined) {
          const labels = frameItem.RealWorldValueMappingSequence.map(
            item => item.LUTLabel
          )
          const key = labels.join('-')
          if (key in mappings) {
            mappings[key].frameNumbers.push(i + 1)
          } else {
            mappings[key] = {
              frameNumbers: [i + 1],
              realWorldValueMappings: frameItem.RealWorldValueMappingSequence
            }
          }
        }
      })
    }
  }

  const frameNumberToMappingNumber = {}
  const mappingNumberToFrameNumbers = {}
  const mappingNumberToDescriptions = {}
  Object.values(mappings).forEach((mapping, mappingIndex) => {
    const mappingNumber = mappingIndex + 1
    mapping.frameNumbers.forEach(frameNumber => {
      frameNumberToMappingNumber[frameNumber] = mappingNumber
      if (mappingNumber in mappingNumberToFrameNumbers) {
        mappingNumberToFrameNumbers[mappingNumber].push(frameNumber)
      } else {
        mappingNumberToFrameNumbers[mappingNumber] = [frameNumber]
      }
    })
    mappingNumberToDescriptions[mappingNumber] = mapping.realWorldValueMappings
  })

  return {
    frameNumberToMappingNumber,
    mappingNumberToFrameNumbers,
    mappingNumberToDescriptions
  }
}

function getFrameMapping (metadata) {
  const rows = metadata.Rows
  const columns = metadata.Columns
  const totalPixelMatrixColumns = metadata.TotalPixelMatrixColumns
  const totalPixelMatrixRows = metadata.TotalPixelMatrixRows
  const sopInstanceUID = metadata.SOPInstanceUID
  const numberOfFrames = Number(metadata.NumberOfFrames || 1)

  /**
   * Handle images that may contain multiple "planes"
   *  - z-planes (VL Whole Slide Microscopy Image)
   *  - optical paths (VL Whole Slide Microscopy Image)
   *  - segments (Segmentation)
   *  - mappings (Parametric Map)
   */
  const numberOfFocalPlanes = Number(metadata.NumberOfFocalPlanes || 1)
  if (numberOfFocalPlanes > 1) {
    throw new Error('Images with multiple focal planes are not yet supported.')
  }

  const {
    mappingNumberToFrameNumbers,
    frameNumberToMappingNumber
  } = _groupFramesPerMapping(metadata)
  let numberOfChannels = 0
  let numberOfOpticalPaths = 0
  let numberOfSegments = 0
  let numberOfMappings = 0
  if (metadata.OpticalPathSequence != null) {
    numberOfOpticalPaths = Number(metadata.NumberOfOpticalPaths || 1)
    numberOfChannels = numberOfOpticalPaths
  } else if (metadata.SegmentSequence != null) {
    numberOfSegments = Number(metadata.SegmentSequence.length)
    numberOfChannels = numberOfSegments
  } else if (Object.keys(mappingNumberToFrameNumbers).length > 0) {
    numberOfMappings = Number(Object.keys(mappingNumberToFrameNumbers).length)
    numberOfChannels = numberOfMappings
  } else {
    throw new Error('Could not determine the number of image channels.')
  }

  const tileColumns = Math.ceil(totalPixelMatrixColumns / columns)
  const tileRows = Math.ceil(totalPixelMatrixRows / rows)
  const frameMapping = {}
  /**
   * The values "TILED_SPARSE" and "TILED_FULL" were introduced in the 2018
   * edition of the standard. Older datasets are equivalent to "TILED_SPARSE".
   */
  const dimensionOrganizationType = (
    metadata.DimensionOrganizationType || 'TILED_SPARSE'
  )
  if (dimensionOrganizationType === 'TILED_FULL') {
    let number = 1
    // Forth, along "channels"
    for (let i = 0; i < numberOfChannels; i++) {
      // Third, along the depth direction from glass slide -> coverslip
      for (let p = 0; p < numberOfFocalPlanes; p++) {
        // Second, along the column direction from top -> bottom
        for (let r = 0; r < tileRows; r++) {
          // First, along the row direction from left -> right
          for (let c = 0; c < tileColumns; c++) {
            /*
             * The standard currently only defines TILED_FULL for optical paths
             * and not any other types of "channels" such as segments or
             * parameter mappings.
             */
            let channelIdentifier
            if (numberOfOpticalPaths > 0) {
              const opticalPath = metadata.OpticalPathSequence[i]
              channelIdentifier = String(opticalPath.OpticalPathIdentifier)
            } else if (numberOfSegments > 0) {
              const segment = metadata.SegmentSequence[i]
              channelIdentifier = String(segment.SegmentNumber)
            } else if (numberOfMappings > 0) {
              // TODO: ensure that frames are mapped accordingly
              channelIdentifier = String(frameNumberToMappingNumber[number])
            } else {
              throw new Error(
                `Could not determine channel of frame #${number}.`
              )
            }
            const key = `${r + 1}-${c + 1}-${channelIdentifier}`
            frameMapping[key] = `${sopInstanceUID}/frames/${number}`
            number += 1
          }
        }
      }
    }
  } else {
    const sharedFuncGroups = metadata.SharedFunctionalGroupsSequence
    const perframeFuncGroups = metadata.PerFrameFunctionalGroupsSequence
    for (let j = 0; j < numberOfFrames; j++) {
      const planePositions = perframeFuncGroups[j].PlanePositionSlideSequence[0]
      const rowPosition = planePositions.RowPositionInTotalImagePixelMatrix
      const columnPosition = planePositions.ColumnPositionInTotalImagePixelMatrix
      const rowIndex = Math.ceil(rowPosition / rows)
      const colIndex = Math.ceil(columnPosition / columns)
      const number = j + 1
      let channelIdentifier
      if (numberOfOpticalPaths === 1) {
        try {
          channelIdentifier = String(
            sharedFuncGroups[0]
              .OpticalPathIdentificationSequence[0]
              .OpticalPathIdentifier
          )
        } catch {
          channelIdentifier = String(
            perframeFuncGroups[j]
              .OpticalPathIdentificationSequence[0]
              .OpticalPathIdentifier
          )
        }
      } else if (numberOfOpticalPaths > 1) {
        channelIdentifier = String(
          perframeFuncGroups[j]
            .OpticalPathIdentificationSequence[0]
            .OpticalPathIdentifier
        )
      } else if (numberOfSegments === 1) {
        try {
          channelIdentifier = String(
            sharedFuncGroups[0]
              .SegmentIdentificationSequence[0]
              .ReferencedSegmentNumber
          )
        } catch {
          channelIdentifier = String(
            perframeFuncGroups[j]
              .SegmentIdentificationSequence[0]
              .ReferencedSegmentNumber
          )
        }
      } else if (numberOfSegments > 1) {
        channelIdentifier = String(
          perframeFuncGroups[j]
            .SegmentIdentificationSequence[0]
            .ReferencedSegmentNumber
        )
      } else if (numberOfMappings > 0) {
        channelIdentifier = String(frameNumberToMappingNumber[number])
      } else {
        throw new Error(`Could not determine channel of frame ${number}.`)
      }
      const key = `${rowIndex}-${colIndex}-${channelIdentifier}`
      const frameNumber = j + 1
      frameMapping[key] = `${sopInstanceUID}/frames/${frameNumber}`
    }
  }
  return {
    frameMapping,
    numberOfChannels
  }
}

function getPixelSpacing (metadata) {
  const functionalGroup = metadata.SharedFunctionalGroupsSequence[0]
  const pixelMeasures = functionalGroup.PixelMeasuresSequence[0]
  return [
    Number(pixelMeasures.PixelSpacing[0]),
    Number(pixelMeasures.PixelSpacing[1])
  ]
}

function computeImagePyramid ({ metadata, bits }) {
  if (metadata.length === 0) {
    throw new Error(
      'No image metadata was provided to computate image pyramid structure.'
    )
  }

  // Sort instances and optionally concatenation parts if present.
  metadata.sort((a, b) => {
    const sizeDiff = a.TotalPixelMatrixColumns - b.TotalPixelMatrixColumns
    if (sizeDiff === 0) {
      if (a.ConcatenationFrameOffsetNumber !== undefined) {
        return a.ConcatenationFrameOffsetNumber - b.ConcatenationFrameOffsetNumber
      }
      return sizeDiff
    }
    return sizeDiff
  })

  const pyramidMetadata = []
  const pyramidFrameMappings = []
  let pyramidNumberOfChannels
  for (let i = 0; i < metadata.length; i++) {
    if (metadata[0].FrameOfReferenceUID !== metadata[i].FrameOfReferenceUID) {
      throw new Error(
        'Images of pyramid must all have the same Frame of Reference UID.'
      )
    }
    if (metadata[0].ContainerIdentifier !== metadata[i].ContainerIdentifier) {
      throw new Error(
        'Images of pyramid must all have the same Container Identifier.'
      )
    }

    const numberOfFrames = Number(metadata[i].NumberOfFrames || 1)
    const cols = metadata[i].TotalPixelMatrixColumns || metadata[i].Columns
    const rows = metadata[i].TotalPixelMatrixRows || metadata[i].Rows

    const { frameMapping, numberOfChannels } = getFrameMapping(metadata[i])
    if (i > 0) {
      if (pyramidNumberOfChannels !== numberOfChannels) {
        throw new Error(
          'Images of pyramid must all have the same number of channels ' +
          '(optical paths, segments, mappings, etc.)'
        )
      }
    } else {
      pyramidNumberOfChannels = numberOfChannels
    }

    /*
     * Instances may be broken down into multiple concatentation parts.
     * Therefore, we have to re-assemble instance metadata.
    */
    let alreadyExists = false
    let index = null
    for (let j = 0; j < pyramidMetadata.length; j++) {
      const c = (
        pyramidMetadata[j].TotalPixelMatrixColumns ||
        pyramidMetadata[j].Columns
      )
      const r = (
        pyramidMetadata[j].TotalPixelMatrixRows ||
        pyramidMetadata[j].Rows
      )
      if (r === rows && c === cols) {
        alreadyExists = true
        index = j
      }
    }
    if (alreadyExists) {
      Object.assign(pyramidFrameMappings[index], frameMapping)
      /*
       * Create a new SOP Instance with metadata updated from current
       * concatentation part.
       */
      const rawMetadata = pyramidMetadata[index].json
      rawMetadata['00280008'].Value[0] += numberOfFrames
      if ('PerFrameFunctionalGroupsSequence' in metadata[index]) {
        rawMetadata['52009230'].Value.push(
          ...metadata[i].PerFrameFunctionalGroupsSequence
        )
      }
      if (!('SOPInstanceUIDOfConcatenationSource' in metadata[i])) {
        throw new Error(
          'Multiple image instances for the same channel and ' +
          'focal plane have identical dimensions, but the instances ' +
          'are not part of a concatenation either. ' +
          'The image metadata is probably incorrect.'
        )
      }
      const sopInstanceUID = metadata[i].SOPInstanceUIDOfConcatenationSource
      rawMetadata['00080018'].Value[0] = sopInstanceUID
      delete rawMetadata['00200242'] // SOPInstanceUIDOfConcatenationSource
      delete rawMetadata['00209161'] // ConcatentationUID
      delete rawMetadata['00209162'] // InConcatenationNumber
      delete rawMetadata['00209228'] // ConcatenationFrameOffsetNumber
      pyramidMetadata[index] = new VLWholeSlideMicroscopyImage({
        metadata: rawMetadata
      })
    } else {
      pyramidMetadata.push(metadata[i])
      pyramidFrameMappings.push(frameMapping)
    }
  }

  const nLevels = pyramidMetadata.length
  if (nLevels === 0) {
    console.error('empty pyramid - no levels found')
  }
  const pyramidBaseMetadata = pyramidMetadata[nLevels - 1]

  /*
   * Collect relevant information from DICOM metadata for each pyramid
   * level to construct the Openlayers map.
   */
  const pyramidTileSizes = []
  const pyramidGridSizes = []
  const pyramidResolutions = []
  const pyramidOrigins = []
  const pyramidPixelSpacings = []
  const pyramidImageSizes = []
  const pyramidPhysicalSizes = []
  const offset = [0, -1]
  const baseTotalPixelMatrixColumns = pyramidBaseMetadata.TotalPixelMatrixColumns
  const baseTotalPixelMatrixRows = pyramidBaseMetadata.TotalPixelMatrixRows
  for (let j = (nLevels - 1); j >= 0; j--) {
    const columns = pyramidMetadata[j].Columns
    const rows = pyramidMetadata[j].Rows
    const totalPixelMatrixColumns = pyramidMetadata[j].TotalPixelMatrixColumns
    const totalPixelMatrixRows = pyramidMetadata[j].TotalPixelMatrixRows
    const pixelSpacing = getPixelSpacing(pyramidMetadata[j])
    const nColumns = Math.ceil(totalPixelMatrixColumns / columns)
    const nRows = Math.ceil(totalPixelMatrixRows / rows)
    pyramidTileSizes.push([
      columns,
      rows
    ])
    pyramidGridSizes.push([
      nColumns,
      nRows
    ])
    pyramidPixelSpacings.push(pixelSpacing)

    pyramidImageSizes.push([
      totalPixelMatrixColumns,
      totalPixelMatrixRows
    ])
    pyramidPhysicalSizes.push([
      (totalPixelMatrixColumns * pixelSpacing[1]).toFixed(4),
      (totalPixelMatrixRows * pixelSpacing[0]).toFixed(4)
    ])
    let zoomFactor = baseTotalPixelMatrixColumns / totalPixelMatrixColumns
    const roundedZoomFactor = Math.round(zoomFactor)
    /*
    * Compute the resolution at each pyramid level, since the zoom
    * factor may not be the same between adjacent pyramid levels.
    *
    * Round is conditional to avoid openlayers resolutions error.
    * The resolutions array should be composed of unique values in descending order.
    */
    if (pyramidResolutions.includes(roundedZoomFactor)) {
      console.warn('resolution conflict rounding zoom factor (baseTotalPixelMatrixColumns / totalPixelMatrixColumns): ', zoomFactor)
      zoomFactor = parseFloat(zoomFactor.toFixed(2))
    } else {
      zoomFactor = roundedZoomFactor
    }
    pyramidResolutions.push(zoomFactor)
    pyramidOrigins.push(offset)
  }
  pyramidResolutions.reverse()
  pyramidTileSizes.reverse()
  pyramidGridSizes.reverse()
  pyramidOrigins.reverse()
  pyramidPixelSpacings.reverse()
  pyramidImageSizes.reverse()
  pyramidPhysicalSizes.reverse()

  const uniquePhysicalSizes = [
    ...new Set(pyramidPhysicalSizes.map(v => v.toString()))
  ].map(v => v.split(','))
  if (uniquePhysicalSizes.length > 1) {
    console.warn(
      'images of the image pyramid have different sizes: ',
      '\nsize [mm]: ', pyramidPhysicalSizes,
      '\npixel spacing [mm]: ', pyramidPixelSpacings,
      '\nsize [pixels]: ', pyramidImageSizes,
      '\ntile size [pixels]: ', pyramidTileSizes,
      '\ntile grid size [tiles]: ', pyramidGridSizes,
      '\nresolution [factors]: ', pyramidResolutions
    )
  }

  /**
   * Frames may extend beyond the size of the total pixel matrix.
   * The excess pixels may contain garbage and should not be displayed.
   * We set the extent to the size of the actual image without taken
   * excess pixels into account.
   * Note that the vertical axis is flipped in the used tile source,
   * i.e., values on the axis lie in the range [-n, -1], where n is the
   * number of rows in the total pixel matrix.
   */
  //const extent = [
  //  0, // min X
  //  -(baseTotalPixelMatrixRows + 1), // min Y
  //  baseTotalPixelMatrixColumns, // max X
  //  -1 // max Y
  //]
  const extent = [
    0, 0, baseTotalPixelMatrixColumns, baseTotalPixelMatrixRows
  ]

  return {
    bits,
    extent,
    origins: pyramidOrigins,
    resolutions: pyramidResolutions,
    gridSizes: pyramidGridSizes,
    tileSizes: pyramidTileSizes,
    pixelSpacings: pyramidPixelSpacings,
    metadata: pyramidMetadata,
    frameMappings: pyramidFrameMappings,
    numberOfChannels: pyramidNumberOfChannels
  }
}

const readInstances = async (series) => {
  const response = await fetch(`${series}`);
  const result = await response.json();
  const naturalized = result.map(json => (
    { ...naturalizeDataset(json), json }
  ));
  return naturalized;
}

const readMetadata = async (series) => {
  const response = await fetch(`${series}/metadata`);
  const result = await response.json();
  const naturalized = result.map(json => (
    { ...naturalizeDataset(json), json }
  ));
  return naturalized;
}

const toIndexer = (opts) => {
  const {
    metadata, pyramids, series, little_endian
  } = opts;
  return ( sel, level ) => {
    return new DicomTIFFImage({
      little_endian, metadata,
      pyramids, series, level,
      ...sel
    });
  }
}


const getShapeForBinaryDownsampleLevel = (
  options
) => {
  const { axes, level } = options;
  const xIndex = axes.labels.indexOf('x');
  const yIndex = axes.labels.indexOf('y');
  const resolutionShape = axes.shape.slice();
  resolutionShape[xIndex] = axes.shape[xIndex] >> level;
  resolutionShape[yIndex] = axes.shape[yIndex] >> level;
  return resolutionShape;
}

const loadDicom = (meta) => {
  const { pyramids, series, little_endian } = meta;
  const { width, height, bits } = [
    ...pyramids[0]
  ].pop()
  const channels = (
    Object.keys(pyramids).map(n => parseInt(n))
  ).toSorted((x,y) => x-y)
  const levels = (
    Object.keys(pyramids["0"]).map(n => parseInt(n))
  ).toSorted((x,y) => x-y)
  const pixels = {
    "Channels":channels.map(id => ({
      "ID":`Channel:0:${id}`,
      "Name":`Channel ${id}`,
      "SamplesPerPixel":1
    })),
    "ID":"Pixels:0",
    "DimensionOrder":"XYZCT",
    "Type": bits === 8 ? "Uint8" : "Uint16",
    "SizeT":1,
    "SizeZ":1,
    "SizeC":channels.length,
    "SizeY":height,
    "SizeX":width,
    "PhysicalSizeX":1,
    "PhysicalSizeY":1,
    "PhysicalSizeXUnit":"µm",
    "PhysicalSizeYUnit":"µm",
    "PhysicalSizeZUnit":"µm",
    "BigEndian":false,
    "TiffData": channels.map(id => ({
      "IFD": id,
      "PlaneCount": 1,
      "FirstT": 0,
      "FirstC": id,
      "FirstZ": 0,
      "UUID": {
        "FileName": "tmp.tif"
      }
    }))
  }
  const { tileSize } = pyramids["0"][0];
  const metadata = { Pixels: pixels };
  const pyramidIndexer = toIndexer({
    metadata, pyramids, series, little_endian
  });
  const data = levels.map(level => {
    const pyramid = pyramids["0"][level];
    const axes = {
      labels: ['t', 'c', 'z', 'y', 'x'],
      shape: [
        1, channels.length, 1, height, width
      ]
    }
    const meta = {
      "physicalSizes": {
          "x": {
              "size": 0.324999988079,
              "unit": "µm"
          },
          "y": {
              "size": 0.324999988079,
              "unit": "µm"
          }
      },
      "photometricInterpretation": 1
    }
    return new DicomPixelSource(
      sel => pyramidIndexer(
        sel, level
      ),
      metadata.Pixels.Type,
      tileSize,
      getShapeForBinaryDownsampleLevel({
        axes, level 
      }),
      axes.labels,
      meta
    );
    return data;
  });
  return {
    data, metadata
  };
}

function createTileLayers(meta) {
  const {
    channelsVisible,
    colors,
    contrastLimits,
    selections,
  } = meta.settings;
  const { pyramids, dicomSource, rgbImage } = meta;
  const height = [...pyramids["0"]].pop().height;
  const width = [...pyramids["0"]].pop().width;
  const tileSize = pyramids["0"][0].tileSize;
  const maxLevel = pyramids["0"].length;
  const minZoom = Math.round(-(maxLevel-1));
  if (rgbImage) {
    return new TileLayer({
      id: 'rgb_image',
      getTileData: async ({ index, signal }) => {
        const { x, y, z } = index;
        const level = Math.abs(-z);
        console.log("z level and x,y")
        console.log({x, y, z, level});
        const source = dicomSource.data[level];
        if (!source) {
          return null;
        }
        console.log("z level Has Source")
        console.log({x, y, z, level}, source);
        const selection = {z: 0, t:0, c: 0};
        let tile = null;
        try {
          tile = await source.getTile({
            x, y, selection, signal
          })
        }
        catch (e) {
          if (e !== "__minervaEmptyFramePath") {
            if (!(e instanceof AbortError)) {
              console.error(e);
            }
          };
          return null;
        }
        if (!tile) {
          return null;
        }
        console.log("x,y Has Tile")
        console.log({x, y, z, level}, source, tile);
        return tile;
      },
      refinementStrategy: "best-available",
      tileSize: 1024,
      minZoom: minZoom,
      maxZoom: 0,
      // See
      // viv/packages/layers/src/multiscale-image-layer/multiscale-image-layer.js
      zoomOffset: 0, // what should this be?
      extent: [0, 0, width, height],
      renderSubLayers: props => {
        const { left, bottom, right, top } = props.tile.bbox;
        if (!props.data) {
          return null;
        }
        const {
          data, width, height
        } = props.data;
        const imageDataArguments = [
          data, width, height
        ] 
        console.log("Image Data Arguments:");
        console.log(imageDataArguments);
        const imageData = new ImageData(
          ...imageDataArguments
        );
        console.log("Bitmap Layer Bounds:");
        console.log([
          left, bottom, right, top
        ])
        return new BitmapLayer(props, {
          image: data,
          bounds: [
            left, bottom, right, top
          ]
        });
      },
      pickable: true,
      onClick: ({bitmap, layer}) => {
        if (bitmap) {
          console.log("Picked Pixel:");
          console.log({
            sourceX: bitmap.pixel[0],
            sourceY: bitmap.pixel[1],
            sourceWidth: 1,
            sourceHeight: 1
          });
        }
      }
    });
  }
  const imageProps = {
    loader: dicomSource.data,
    // https://deck.gl/docs/api-reference/geo-layers/tile-layer#refinementstrategy
    refinementStrategy: "no-overlap",
    id: "multichannel-tiled-image",
    channelsVisible,
    colors,
    contrastLimits,
    selections
  }
  return new MultiscaleImageLayer(imageProps);
}

const listDicomWeb = async (series) => {
  return await readInstances(`${series}/instances/`);
}

class DicomPlane {
  constructor(props) {
    this.meta = props.meta;
    this.dtype = props.dtype;
    this.samples = props.samples;
    this.shape = props.shape;
    this.labels = props.labels;
    this.series = props.series;
    this.metadata = props.metadata;
    this.tileSize = props.tileSize;
  }

  async getTile({ selection, x, y, signal }) {
    const metadata= this.metadata;
    const width = this.shape[0];
    const height = this.shape[1];
    const series = this.series;
// TODO
/*
    const pyramids = computeImagePyramid({ metadata });
    const image = new DicomTIFFImage({
      little_endian, metadata,
      pyramids, series, level,
      ...sel
    });
    const data = await image._readRaster({
      x, y, width, height, sample, signal
    });
*/
    const data = [];
    return {
      width, height, data
    };
  }
}

const parseDicomWeb = (series, dicom_pyramids) => {
  if (!dicom_pyramids) {
    return null;
  }
  const channel_pyramids = (
    Object.values(dicom_pyramids)
  );
  const n_channels = channel_pyramids.length;
  const any_channel = [...channel_pyramids].pop();
  const levels = any_channel.toReversed();
  // Levels starting at full resolution
  const data_config = levels.map(level => {
    const {tileSize, width, height, bits} = level;
    const shape = [width, height, n_channels];
    return {
      "series": series,
      "samples": ( bits === 16 ) ? 1 : 3,
      "dtype": ( bits === 16 ) ? "Uint16" : "Uint8",
      "tileSize":tileSize,
      "shape": shape,
      "labels":["x","y","c"],
      "meta":{
        "physicalSizes":{
          "x":{"size":1,"unit":"µm"},
          "y":{"size":1,"unit":"µm"}
        },
        "photometricInterpretation":1
      }
    };
  });
  const metadata = {
    "ID":"Image:0",
    "AquisitionDate":"",
    "Description":"",
    "Pixels": {
      "Channels":channel_pyramids.map((_, i) => {
        const { samples } = data_config[0];
        return {
          "ID":`Channel:0:${i}`,
          "Name":`Channel ${i}`,
          "SamplesPerPixel": samples
        }
      }),
      "ID":"Pixels:0",
      "DimensionOrder":"XYC",
      "Type": data_config[0].dtype,
      "SizeC":data_config[0].shape[2],
      "SizeY":data_config[0].shape[1],
      "SizeX":data_config[0].shape[0],
      "PhysicalSizeX":1,
      "PhysicalSizeY":1,
      "PhysicalSizeXUnit":"µm",
      "PhysicalSizeYUnit":"µm",
      "BigEndian":false
    }
  }
  const data = data_config.map(level_data => {
    return new DicomPlane({
      metadata,
      ...level_data
    });
  });
  return {
    data, metadata
  };
}

const loadDicomWeb = async (series) => {
  // Test Series: 
  // "https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb/studies/2.25.93749216439228361118017742627453453196/series/1.3.6.1.4.1.5962.99.1.2344794501.795090168.1655907236229.4.0"
  const instance_list = await listDicomWeb(series);
  const pyramids = await Promise.all(
    instance_list.map((opts, i) => {
      const { SOPInstanceUID, BitsAllocated } = opts;
      const instance = `${series}/instances/${SOPInstanceUID}`;
      return readMetadata(instance).then(
        instance_metadata => {
          const pyramid = computeImagePyramid({
            metadata: instance_metadata,
            bits: BitsAllocated
          })
          return pyramid;
        }
      )
    })
  )
  const channel_pyramids = pyramids.reduce((o, i) => {
    const k = String(
      i.metadata[0].OpticalPathSequence[0].OpticalPathIdentifier
    );
    const channel_pyramid = [
      ...(o[k] || []), ...[i]
    ];
    return {
      ...o, [k]: channel_pyramid
    }
  }, {});
  // For first optical channel
  const dicom_pyramids = Object.fromEntries(
    Object.entries(channel_pyramids).map(
      ([key, pyramid]) => ([
        key, Object.values(pyramid).map(
          ({
            frameMappings, bits, extent, tileSizes
          }) => ({ 
            bits,
            extent,
            width: Math.abs(extent[2]),
            height: Math.abs(extent[3]),
            frameMappings: Object.fromEntries(
              Object.entries(frameMappings[0]).map(
                ([k,v]) => (
                  [k, v.split('/').slice(-3).join('/')]
                )
              )
            ),
            tileSize: Math.max(...tileSizes[0])
          })
        ).sort((a, b) => {
          return a.width - b.width
        })
      ])
    )
  );
  return dicom_pyramids;
}

const findDicomWeb = (series) => {
  return listDicomWeb(series);
}

export {
  loadDicomWeb, findDicomWeb,
  createTileLayers, readInstances,
  readMetadata, computeImagePyramid,
  parseDicomWeb, loadDicom
}
