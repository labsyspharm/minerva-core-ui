import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import * as dcmjs from "dcmjs";
import { DicomPixelSource } from "./dicomPixelSource";
import { DicomTIFFImage } from "./dicomTiffImage";

const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary;

function _groupFramesPerMapping(metadata) {
  const mappings = {};
  const sharedItem = metadata.SharedFunctionalGroupsSequence[0];
  if (sharedItem.RealWorldValueMappingSequence !== undefined) {
    const labels = sharedItem.RealWorldValueMappingSequence.map(
      (item) => item.LUTLabel,
    );
    const key = labels.join("-");
    const numFrames = Number(metadata.NumberOfFrames);
    mappings[key] = {
      frameNumbers: [...Array(numFrames).keys()].map((index) => index + 1),
      realWorldValueMappings: sharedItem.RealWorldValueMappingSequence,
    };
  } else {
    // Dimension Organization TILED_FULL is not defined for Parametric Map
    if (metadata.PerFrameFunctionalGroupsSequence !== undefined) {
      metadata.PerFrameFunctionalGroupsSequence.forEach((frameItem, i) => {
        if (frameItem.RealWorldValueMappingSequence !== undefined) {
          const labels = frameItem.RealWorldValueMappingSequence.map(
            (item) => item.LUTLabel,
          );
          const key = labels.join("-");
          if (key in mappings) {
            mappings[key].frameNumbers.push(i + 1);
          } else {
            mappings[key] = {
              frameNumbers: [i + 1],
              realWorldValueMappings: frameItem.RealWorldValueMappingSequence,
            };
          }
        }
      });
    }
  }

  const frameNumberToMappingNumber = {};
  const mappingNumberToFrameNumbers = {};
  const mappingNumberToDescriptions = {};
  Object.values(mappings).forEach((mapping, mappingIndex) => {
    const mappingNumber = mappingIndex + 1;
    mapping.frameNumbers.forEach((frameNumber) => {
      frameNumberToMappingNumber[frameNumber] = mappingNumber;
      if (mappingNumber in mappingNumberToFrameNumbers) {
        mappingNumberToFrameNumbers[mappingNumber].push(frameNumber);
      } else {
        mappingNumberToFrameNumbers[mappingNumber] = [frameNumber];
      }
    });
    mappingNumberToDescriptions[mappingNumber] = mapping.realWorldValueMappings;
  });

  return {
    frameNumberToMappingNumber,
    mappingNumberToFrameNumbers,
    mappingNumberToDescriptions,
  };
}

function getFrameMapping(metadata) {
  const rows = metadata.Rows;
  const columns = metadata.Columns;
  const totalPixelMatrixColumns = metadata.TotalPixelMatrixColumns;
  const totalPixelMatrixRows = metadata.TotalPixelMatrixRows;
  const sopInstanceUID = metadata.SOPInstanceUID;
  const numberOfFrames = Number(metadata.NumberOfFrames || 1);

  /**
   * Handle images that may contain multiple "planes"
   *  - z-planes (VL Whole Slide Microscopy Image)
   *  - optical paths (VL Whole Slide Microscopy Image)
   *  - segments (Segmentation)
   *  - mappings (Parametric Map)
   */
  const numberOfFocalPlanes = Number(metadata.NumberOfFocalPlanes || 1);
  if (numberOfFocalPlanes > 1) {
    throw new Error("Images with multiple focal planes are not yet supported.");
  }

  const { mappingNumberToFrameNumbers, frameNumberToMappingNumber } =
    _groupFramesPerMapping(metadata);
  let numberOfChannels = 0;
  let numberOfOpticalPaths = 0;
  let numberOfSegments = 0;
  let numberOfMappings = 0;
  if (metadata.OpticalPathSequence != null) {
    numberOfOpticalPaths = Number(metadata.NumberOfOpticalPaths || 1);
    numberOfChannels = numberOfOpticalPaths;
  } else if (metadata.SegmentSequence != null) {
    numberOfSegments = Number(metadata.SegmentSequence.length);
    numberOfChannels = numberOfSegments;
  } else if (Object.keys(mappingNumberToFrameNumbers).length > 0) {
    numberOfMappings = Number(Object.keys(mappingNumberToFrameNumbers).length);
    numberOfChannels = numberOfMappings;
  } else {
    throw new Error("Could not determine the number of image channels.");
  }

  const tileColumns = Math.ceil(totalPixelMatrixColumns / columns);
  const tileRows = Math.ceil(totalPixelMatrixRows / rows);
  const frameMapping = {};
  /**
   * The values "TILED_SPARSE" and "TILED_FULL" were introduced in the 2018
   * edition of the standard. Older datasets are equivalent to "TILED_SPARSE".
   */
  const dimensionOrganizationType =
    metadata.DimensionOrganizationType || "TILED_SPARSE";
  if (dimensionOrganizationType === "TILED_FULL") {
    let number = 1;
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
            let channelIdentifier;
            if (numberOfOpticalPaths > 0) {
              const opticalPath = metadata.OpticalPathSequence[i];
              channelIdentifier = String(opticalPath.OpticalPathIdentifier);
            } else if (numberOfSegments > 0) {
              const segment = metadata.SegmentSequence[i];
              channelIdentifier = String(segment.SegmentNumber);
            } else if (numberOfMappings > 0) {
              // TODO: ensure that frames are mapped accordingly
              channelIdentifier = String(frameNumberToMappingNumber[number]);
            } else {
              throw new Error(
                `Could not determine channel of frame #${number}.`,
              );
            }
            const key = `${r + 1}-${c + 1}-${channelIdentifier}`;
            frameMapping[key] = `${sopInstanceUID}/frames/${number}`;
            number += 1;
          }
        }
      }
    }
  } else {
    const sharedFuncGroups = metadata.SharedFunctionalGroupsSequence;
    const perframeFuncGroups = metadata.PerFrameFunctionalGroupsSequence;
    for (let j = 0; j < numberOfFrames; j++) {
      const planePositions =
        perframeFuncGroups[j].PlanePositionSlideSequence[0];
      const rowPosition = planePositions.RowPositionInTotalImagePixelMatrix;
      const columnPosition =
        planePositions.ColumnPositionInTotalImagePixelMatrix;
      const rowIndex = Math.ceil(rowPosition / rows);
      const colIndex = Math.ceil(columnPosition / columns);
      const number = j + 1;
      let channelIdentifier;
      if (numberOfOpticalPaths === 1) {
        try {
          channelIdentifier = String(
            sharedFuncGroups[0].OpticalPathIdentificationSequence[0]
              .OpticalPathIdentifier,
          );
        } catch {
          channelIdentifier = String(
            perframeFuncGroups[j].OpticalPathIdentificationSequence[0]
              .OpticalPathIdentifier,
          );
        }
      } else if (numberOfOpticalPaths > 1) {
        channelIdentifier = String(
          perframeFuncGroups[j].OpticalPathIdentificationSequence[0]
            .OpticalPathIdentifier,
        );
      } else if (numberOfSegments === 1) {
        try {
          channelIdentifier = String(
            sharedFuncGroups[0].SegmentIdentificationSequence[0]
              .ReferencedSegmentNumber,
          );
        } catch {
          channelIdentifier = String(
            perframeFuncGroups[j].SegmentIdentificationSequence[0]
              .ReferencedSegmentNumber,
          );
        }
      } else if (numberOfSegments > 1) {
        channelIdentifier = String(
          perframeFuncGroups[j].SegmentIdentificationSequence[0]
            .ReferencedSegmentNumber,
        );
      } else if (numberOfMappings > 0) {
        channelIdentifier = String(frameNumberToMappingNumber[number]);
      } else {
        throw new Error(`Could not determine channel of frame ${number}.`);
      }
      const key = `${rowIndex}-${colIndex}-${channelIdentifier}`;
      const frameNumber = j + 1;
      frameMapping[key] = `${sopInstanceUID}/frames/${frameNumber}`;
    }
  }
  return {
    frameMapping,
    numberOfChannels,
  };
}

function getPixelSpacing(metadata) {
  const functionalGroup = metadata.SharedFunctionalGroupsSequence[0];
  const pixelMeasures = functionalGroup.PixelMeasuresSequence[0];
  return [
    Number(pixelMeasures.PixelSpacing[0]),
    Number(pixelMeasures.PixelSpacing[1]),
  ];
}

function computeImagePyramid({ metadata, bits }) {
  if (metadata.length === 0) {
    throw new Error(
      "No image metadata was provided to computate image pyramid structure.",
    );
  }

  // Sort instances and optionally concatenation parts if present.
  metadata.sort((a, b) => {
    const sizeDiff = a.TotalPixelMatrixColumns - b.TotalPixelMatrixColumns;
    if (sizeDiff === 0) {
      if (a.ConcatenationFrameOffsetNumber !== undefined) {
        return (
          a.ConcatenationFrameOffsetNumber - b.ConcatenationFrameOffsetNumber
        );
      }
      return sizeDiff;
    }
    return sizeDiff;
  });

  const pyramidMetadata = [];
  const pyramidFrameMappings = [];
  let pyramidNumberOfChannels;
  for (let i = 0; i < metadata.length; i++) {
    if (metadata[0].FrameOfReferenceUID !== metadata[i].FrameOfReferenceUID) {
      throw new Error(
        "Images of pyramid must all have the same Frame of Reference UID.",
      );
    }
    if (metadata[0].ContainerIdentifier !== metadata[i].ContainerIdentifier) {
      throw new Error(
        "Images of pyramid must all have the same Container Identifier.",
      );
    }

    const numberOfFrames = Number(metadata[i].NumberOfFrames || 1);
    const cols = metadata[i].TotalPixelMatrixColumns || metadata[i].Columns;
    const rows = metadata[i].TotalPixelMatrixRows || metadata[i].Rows;

    const { frameMapping, numberOfChannels } = getFrameMapping(metadata[i]);
    if (i > 0) {
      if (pyramidNumberOfChannels !== numberOfChannels) {
        throw new Error(
          "Images of pyramid must all have the same number of channels " +
            "(optical paths, segments, mappings, etc.)",
        );
      }
    } else {
      pyramidNumberOfChannels = numberOfChannels;
    }

    /*
     * Instances may be broken down into multiple concatentation parts.
     * Therefore, we have to re-assemble instance metadata.
     */
    let alreadyExists = false;
    let index = null;
    for (let j = 0; j < pyramidMetadata.length; j++) {
      const c =
        pyramidMetadata[j].TotalPixelMatrixColumns ||
        pyramidMetadata[j].Columns;
      const r =
        pyramidMetadata[j].TotalPixelMatrixRows || pyramidMetadata[j].Rows;
      if (r === rows && c === cols) {
        alreadyExists = true;
        index = j;
      }
    }
    if (alreadyExists) {
      Object.assign(pyramidFrameMappings[index], frameMapping);
      /*
       * Create a new SOP Instance with metadata updated from current
       * concatentation part.
       */
      const rawMetadata = pyramidMetadata[index].json;
      rawMetadata["00280008"].Value[0] += numberOfFrames;
      if ("PerFrameFunctionalGroupsSequence" in metadata[index]) {
        rawMetadata["52009230"].Value.push(
          ...metadata[i].PerFrameFunctionalGroupsSequence,
        );
      }
      if (!("SOPInstanceUIDOfConcatenationSource" in metadata[i])) {
        throw new Error(
          "Multiple image instances for the same channel and " +
            "focal plane have identical dimensions, but the instances " +
            "are not part of a concatenation either. " +
            "The image metadata is probably incorrect.",
        );
      }
      const sopInstanceUID = metadata[i].SOPInstanceUIDOfConcatenationSource;
      rawMetadata["00080018"].Value[0] = sopInstanceUID;
      delete rawMetadata["00200242"]; // SOPInstanceUIDOfConcatenationSource
      delete rawMetadata["00209161"]; // ConcatentationUID
      delete rawMetadata["00209162"]; // InConcatenationNumber
      delete rawMetadata["00209228"]; // ConcatenationFrameOffsetNumber
      pyramidMetadata[index] = new VLWholeSlideMicroscopyImage({
        metadata: rawMetadata,
      });
    } else {
      pyramidMetadata.push(metadata[i]);
      pyramidFrameMappings.push(frameMapping);
    }
  }

  const nLevels = pyramidMetadata.length;
  if (nLevels === 0) {
    console.error("empty pyramid - no levels found");
  }
  const pyramidBaseMetadata = pyramidMetadata[nLevels - 1];

  /*
   * Collect relevant information from DICOM metadata for each pyramid
   * level to construct the Openlayers map.
   */
  const pyramidTileSizes = [];
  const pyramidGridSizes = [];
  const pyramidResolutions = [];
  const pyramidOrigins = [];
  const pyramidPixelSpacings = [];
  const pyramidImageSizes = [];
  const pyramidPhysicalSizes = [];
  const offset = [0, -1];
  const baseTotalPixelMatrixColumns =
    pyramidBaseMetadata.TotalPixelMatrixColumns;
  const baseTotalPixelMatrixRows = pyramidBaseMetadata.TotalPixelMatrixRows;
  for (let j = nLevels - 1; j >= 0; j--) {
    const columns = pyramidMetadata[j].Columns;
    const rows = pyramidMetadata[j].Rows;
    const totalPixelMatrixColumns = pyramidMetadata[j].TotalPixelMatrixColumns;
    const totalPixelMatrixRows = pyramidMetadata[j].TotalPixelMatrixRows;
    const pixelSpacing = getPixelSpacing(pyramidMetadata[j]);
    const nColumns = Math.ceil(totalPixelMatrixColumns / columns);
    const nRows = Math.ceil(totalPixelMatrixRows / rows);
    pyramidTileSizes.push([columns, rows]);
    pyramidGridSizes.push([nColumns, nRows]);
    pyramidPixelSpacings.push(pixelSpacing);

    pyramidImageSizes.push([totalPixelMatrixColumns, totalPixelMatrixRows]);
    pyramidPhysicalSizes.push([
      (totalPixelMatrixColumns * pixelSpacing[1]).toFixed(4),
      (totalPixelMatrixRows * pixelSpacing[0]).toFixed(4),
    ]);
    let zoomFactor = baseTotalPixelMatrixColumns / totalPixelMatrixColumns;
    const roundedZoomFactor = Math.round(zoomFactor);
    /*
     * Compute the resolution at each pyramid level, since the zoom
     * factor may not be the same between adjacent pyramid levels.
     *
     * Round is conditional to avoid openlayers resolutions error.
     * The resolutions array should be composed of unique values in descending order.
     */
    if (pyramidResolutions.includes(roundedZoomFactor)) {
      zoomFactor = parseFloat(zoomFactor.toFixed(2));
    } else {
      zoomFactor = roundedZoomFactor;
    }
    pyramidResolutions.push(zoomFactor);
    pyramidOrigins.push(offset);
  }
  pyramidResolutions.reverse();
  pyramidTileSizes.reverse();
  pyramidGridSizes.reverse();
  pyramidOrigins.reverse();
  pyramidPixelSpacings.reverse();
  pyramidImageSizes.reverse();
  pyramidPhysicalSizes.reverse();

  // Multi-resolution WSI levels routinely differ in physical size (mm);
  // that is expected and not logged.

  /**
   * Frames may extend beyond the size of the total pixel matrix.
   * The excess pixels may contain garbage and should not be displayed.
   * We set the extent to the size of the actual image without taken
   * excess pixels into account.
   * Note that the vertical axis is flipped in the used tile source,
   * i.e., values on the axis lie in the range [-n, -1], where n is the
   * number of rows in the total pixel matrix.
   */
  const extent = [0, 0, baseTotalPixelMatrixColumns, baseTotalPixelMatrixRows];

  return {
    bits,
    extent,
    origins: pyramidOrigins,
    resolutions: pyramidResolutions,
    gridSizes: pyramidGridSizes,
    tileSizes: pyramidTileSizes,
    /** Coarsest → finest, aligned with `tileSizes` after reverse. */
    imageSizes: pyramidImageSizes,
    pixelSpacings: pyramidPixelSpacings,
    metadata: pyramidMetadata,
    frameMappings: pyramidFrameMappings,
    numberOfChannels: pyramidNumberOfChannels,
  };
}

const readInstances = async (series) => {
  const response = await fetch(`${series}`);
  const result = await response.json();
  const naturalized = result.map((json) => ({
    ...naturalizeDataset(json),
    json,
  }));
  return naturalized;
};

/** Accept series roots or deeper WADO paths (`…/instances`, `…/instances/{sop}/frames/{n}`). */
const normalizeDicomWebSeriesUrl = (url) => {
  return String(url)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/instances(?:\/.*)?$/i, "");
};

/** True when URL is (or normalizes to) a DICOMweb series root. */
const isDicomWebSeriesUrl = (url) => {
  const root = normalizeDicomWebSeriesUrl(String(url).trim());
  return /^https?:\/\/.+\/studies\/[^/]+\/series\/[^/]+$/i.test(root);
};

/**
 * Confirm a URL is a reachable DICOMweb series via QIDO `instances?limit=1`.
 * Does not fetch full series `/metadata`.
 */
const isDicomWeb = async (url, signal) => {
  if (!isDicomWebSeriesUrl(url)) return false;
  const root = normalizeDicomWebSeriesUrl(url);
  try {
    const response = await fetch(`${root}/instances/?limit=1`, { signal });
    if (!response.ok) return false;
    const result = await response.json();
    if (!Array.isArray(result) || result.length === 0) return false;
    const first = naturalizeDataset(result[0]);
    return Boolean(first?.SOPInstanceUID);
  } catch {
    return false;
  }
};

const readMetadata = async (series) => {
  const response = await fetch(`${series}/metadata`);
  if (!response.ok) {
    throw new Error(
      `DICOMweb metadata request failed (${response.status}) for ${series}`,
    );
  }
  const result = await response.json();
  if (!Array.isArray(result)) {
    throw new Error("DICOMweb metadata response must be a JSON array.");
  }
  const naturalized = result.map((json) => ({
    ...naturalizeDataset(json),
    json,
  }));
  return naturalized;
};

/** Optical path id used to group VL Whole Slide Microscopy instances. */
function opticalPathIdentifier(instance) {
  const id = instance?.OpticalPathSequence?.[0]?.OpticalPathIdentifier;
  return id != null && String(id).length > 0 ? String(id) : "0";
}

function shortFramePath(path) {
  return String(path).split("/").slice(-3).join("/");
}

/** Pixel matrix size from naturalized VL WSI metadata. */
function pixelMatrixSize(levelMeta) {
  const width = Math.abs(
    Number(levelMeta?.TotalPixelMatrixColumns ?? levelMeta?.Columns ?? 0) || 0,
  );
  const height = Math.abs(
    Number(levelMeta?.TotalPixelMatrixRows ?? levelMeta?.Rows ?? 0) || 0,
  );
  return { width, height };
}

/**
 * Flatten computeImagePyramid into loader levels (coarsest → finest).
 * Frame paths become `instances/{sop}/frames/{n}` relative to the series root.
 */
function pyramidLevelsForLoader(pyramid) {
  const baseW = Math.abs(Number(pyramid.extent?.[2]) || 0);
  const baseH = Math.abs(Number(pyramid.extent?.[3]) || 0);
  const n = pyramid.metadata?.length ?? 0;
  return (pyramid.metadata || []).map((levelMeta, i) => {
    const fromSizes = pyramid.imageSizes?.[i];
    let width = Math.abs(Number(fromSizes?.[0]) || 0);
    let height = Math.abs(Number(fromSizes?.[1]) || 0);
    if (!(width > 0 && height > 0)) {
      ({ width, height } = pixelMatrixSize(levelMeta));
    }
    if (i === n - 1 && baseW > 0 && baseH > 0) {
      width = baseW;
      height = baseH;
    }
    const tileW = Number(levelMeta.Columns) || 0;
    const tileH = Number(levelMeta.Rows) || 0;
    const fromPyramid = pyramid.tileSizes?.[i];
    const tileSize =
      Math.max(tileW, tileH) ||
      Math.max(0, Number(fromPyramid?.[0]) || 0, Number(fromPyramid?.[1]) || 0);
    const frameMapping = pyramid.frameMappings?.[i] || {};
    return {
      bits: pyramid.bits,
      extent: [0, 0, width, height],
      width,
      height,
      tileSize,
      frameMappings: Object.fromEntries(
        Object.entries(frameMapping).map(([k, v]) => [k, shortFramePath(v)]),
      ),
    };
  });
}

/**
 * Viv `c` is a 0-based channel index; DICOM frame keys use OpticalPathIdentifier.
 * Re-key pyramids to `"0"…"N"` and rewrite frame keys; reverse to finest-first
 * so level 0 is full resolution for MultiscaleImageLayer.
 */
function pyramidsForChannelIndex(pyramids) {
  return Object.fromEntries(
    Object.keys(pyramids ?? {}).map((pathKey, cIndex) => {
      const finestFirst = [...(pyramids[pathKey] || [])]
        .reverse()
        .map((level) => ({
          ...level,
          frameMappings: Object.fromEntries(
            Object.entries(level.frameMappings || {}).map(([k, v]) => {
              const [row, col] = String(k).split("-");
              return row != null && col != null
                ? [`${row}-${col}-${cIndex}`, v]
                : [k, v];
            }),
          ),
        }));
      return [String(cIndex), finestFirst];
    }),
  );
}

/** True when series `/metadata` frame maps look incomplete (bulk-elided per-frame). */
function pyramidsNeedInstanceMetadata(pyramids) {
  for (const levels of Object.values(pyramids ?? {})) {
    if (!Array.isArray(levels)) continue;
    for (const level of levels) {
      const tw = Number(level?.tileSize) || 0;
      const w = Number(level?.width) || 0;
      const h = Number(level?.height) || 0;
      if (tw <= 0 || w <= 0 || h <= 0) continue;
      const expected = Math.ceil(w / tw) * Math.ceil(h / tw);
      const mapped = Object.keys(level.frameMappings || {}).length;
      if (expected > 4 && mapped < expected * 0.5) return true;
    }
  }
  return false;
}

/** Group naturalized instances by optical path, then build one pyramid per group. */
function dicomPyramidsFromInstances(instances) {
  if (!instances?.length) {
    throw new Error("No DICOMweb instance metadata to build pyramids from.");
  }
  const byPath = {};
  for (const instance of instances) {
    const k = opticalPathIdentifier(instance);
    if (!byPath[k]) byPath[k] = [];
    byPath[k].push(instance);
  }
  return Object.fromEntries(
    Object.entries(byPath).map(([key, group]) => {
      const bits = Number(group[0]?.BitsAllocated) || 16;
      return [
        key,
        pyramidLevelsForLoader(
          computeImagePyramid({ metadata: [...group], bits }),
        ),
      ];
    }),
  );
}

/** Trim a naturalized DICOM string / multi-value string tag. */
function dicomStringTag(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }
  return "";
}

/**
 * Human label for a DICOMweb series from instance metadata.
 * Prefer original filename (PixelMed private) → container/specimen →
 * series description → series UID tail.
 */
const dicomSeriesDisplayName = (instance, seriesUrl = "") => {
  // dcmjs keeps this PixelMed private tag as the hex key.
  const originalFile = dicomStringTag(instance?.["00091001"]);
  if (originalFile) return originalFile;

  const container = dicomStringTag(instance?.ContainerIdentifier);
  if (container) return container;

  const specimen = dicomStringTag(instance?.SpecimenIdentifier);
  if (specimen) return specimen;

  const seriesDescription = dicomStringTag(instance?.SeriesDescription);
  if (seriesDescription) return seriesDescription;

  const uid =
    dicomStringTag(instance?.SeriesInstanceUID) ||
    String(seriesUrl).match(/\/series\/([^/]+)/i)?.[1] ||
    "";
  if (!uid) return "DICOMweb";
  return uid.length > 18 ? `…${uid.slice(-14)}` : uid;
};

function dicomWebLoadResult(instances, seriesUrl) {
  const first = instances?.[0];
  return {
    pyramids: dicomPyramidsFromInstances(instances),
    displayName: dicomSeriesDisplayName(first, seriesUrl),
    modality: dicomStringTag(first?.Modality) || "SM",
  };
}

/** QIDO instances list + one `/metadata` fetch per SOP (N+1). */
async function loadDicomWebPerInstance(root) {
  const instance_list = await listDicomWeb(root);
  const allMetadata = (
    await Promise.all(
      instance_list.map(async ({ SOPInstanceUID }) =>
        readMetadata(`${root}/instances/${SOPInstanceUID}`),
      ),
    )
  ).flat();
  return dicomWebLoadResult(allMetadata, root);
}

const toIndexer = (opts) => {
  const { metadata, pyramids, series, little_endian } = opts;
  return (sel, level) => {
    return new DicomTIFFImage({
      little_endian,
      metadata,
      pyramids,
      series,
      level,
      ...sel,
    });
  };
};

const loadDicom = (meta) => {
  const { pyramids: rawPyramids, series, little_endian } = meta;
  const channelKeys = Object.keys(rawPyramids ?? {});
  if (channelKeys.length === 0) {
    throw new Error("No DICOMweb pyramid channels.");
  }
  // Viv `c` index keys, finest→coarsest levels, frame keys remapped for `c`.
  const pyramids = pyramidsForChannelIndex(rawPyramids);
  const primaryLevels = pyramids["0"];
  if (!Array.isArray(primaryLevels) || primaryLevels.length === 0) {
    throw new Error("DICOMweb primary pyramid has no levels.");
  }
  const finest = primaryLevels[0];
  const dtype = finest.bits === 8 ? "Uint8" : "Uint16";
  const metadata = {
    ID: "Image:0",
    AquisitionDate: "",
    Description: "",
    Pixels: {
      Channels: channelKeys.map((id, i) => ({
        ID: `Channel:0:${i}`,
        Name: `Channel ${id}`,
        SamplesPerPixel: 1,
      })),
      ID: "Pixels:0",
      DimensionOrder: "XYZCT",
      Type: dtype,
      SizeT: 1,
      SizeZ: 1,
      SizeC: channelKeys.length,
      SizeY: finest.height,
      SizeX: finest.width,
      PhysicalSizeX: 1,
      PhysicalSizeY: 1,
      PhysicalSizeXUnit: "µm",
      PhysicalSizeYUnit: "µm",
      PhysicalSizeZUnit: "µm",
      BigEndian: false,
      TiffData: channelKeys.map((_, i) => ({
        IFD: i,
        PlaneCount: 1,
        FirstT: 0,
        FirstC: i,
        FirstZ: 0,
        UUID: { FileName: "tmp.tif" },
      })),
    },
  };
  const pyramidIndexer = toIndexer({
    metadata,
    pyramids,
    series,
    little_endian,
  });
  const labels = ["t", "c", "z", "y", "x"];
  const planeMeta = {
    physicalSizes: {
      x: { size: 1, unit: "µm" },
      y: { size: 1, unit: "µm" },
    },
    photometricInterpretation: 1,
  };
  const data = primaryLevels.map(
    (levelRow, level) =>
      new DicomPixelSource(
        (sel) => pyramidIndexer(sel, level),
        dtype,
        levelRow.tileSize,
        [1, channelKeys.length, 1, levelRow.height, levelRow.width],
        labels,
        planeMeta,
      ),
  );
  return { data, metadata };
};

function createTileLayers(meta) {
  const { channelsVisible, colors, contrastLimits, selections } = meta.settings;
  const visible = channelsVisible.some((x) => x);
  const { imageID, pyramids, dicomLoader, rgbImage } = meta;
  const loaderPlanes = Array.isArray(dicomLoader)
    ? dicomLoader
    : (dicomLoader?.data ?? []);
  const primaryKey =
    pyramids["0"] != null ? "0" : Object.keys(pyramids || {})[0];
  // Raw pyramids are coarsest→finest; last level is full resolution.
  const primaryLevels = pyramids?.[primaryKey];
  if (!Array.isArray(primaryLevels) || primaryLevels.length === 0) {
    console.error("[minerva] dicom: no primary pyramid levels", imageID);
    return null;
  }
  const finest = primaryLevels[primaryLevels.length - 1];
  const { width, height } = finest;
  const minZoom = Math.round(-(primaryLevels.length - 1));
  if (rgbImage) {
    return new TileLayer({
      visible,
      id: "rgb_image",
      getTileData: async ({ index, signal }) => {
        const { x, y, z } = index;
        const source = loaderPlanes[Math.abs(-z)];
        if (!source) return null;
        try {
          return await source.getTile({
            x,
            y,
            selection: { z: 0, t: 0, c: 0 },
            signal,
          });
        } catch (e) {
          if (e !== "__minervaEmptyFramePath" && !(e instanceof AbortError)) {
            console.error(e);
          }
          return null;
        }
      },
      refinementStrategy: "best-available",
      tileSize: finest.tileSize || 1024,
      minZoom,
      maxZoom: 0,
      extent: [0, 0, width, height],
      renderSubLayers: (props) => {
        const { left, bottom, right, top } = props.tile.bbox;
        const { x, y, z } = props.tile.index;
        if (!props.data) return null;
        const { data, width: tw, height: th } = props.data;
        return new BitmapLayer(props, {
          image: new ImageData(data, tw, th),
          id: `rgb-${z}-${x}-${y}`,
          bounds: [left, bottom, right, top],
        });
      },
      pickable: true,
      onClick: () => {},
    });
  }
  if (!loaderPlanes[0]) {
    console.error(
      "[minerva] dicom: MultiscaleImageLayer skipped — empty loader planes",
      imageID,
    );
    return null;
  }
  return new MultiscaleImageLayer({
    visible,
    loader: loaderPlanes,
    refinementStrategy: "best-available",
    // Contrast limits in ID force layer recreate (avoids flash on group switch).
    id: `${imageID}-${contrastLimits.map(([l, u]) => `${l}-${u}`).join("-")}`,
    channelsVisible,
    colors,
    contrastLimits,
    selections,
  });
}

const listDicomWeb = async (series) => {
  const root = normalizeDicomWebSeriesUrl(series);
  return await readInstances(`${root}/instances/`);
};

/** Viv plane wrapper: shape must be tczyx so getImageSize() reads [height, width]. */
const toDicomPlane = (dicomPixelSource) => {
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

    async getTile(opts) {
      return dicomPixelSource.getTile(opts);
    }

    async getRaster(opts) {
      return dicomPixelSource.getRaster(opts);
    }

    onTileError(err) {
      dicomPixelSource.onTileError?.(err);
    }
  }
  return DicomPlane;
};

const parseDicomWeb = (meta) => {
  if (!meta?.pyramids) return null;
  const { data: sources, metadata } = loadDicom({
    ...meta,
    little_endian: meta.little_endian ?? true,
  });
  const samples = metadata.Pixels.Type === "Uint16" ? 1 : 3;
  return {
    metadata,
    data: sources.map((src) => {
      const Plane = toDicomPlane(src);
      return new Plane({
        metadata,
        series: meta.series,
        samples,
        dtype: src.dtype,
        tileSize: src.tileSize,
        shape: src.shape,
        labels: src.labels,
        meta: src.meta,
      });
    }),
  };
};

/** Series `/metadata` first; per-instance fallback if missing or incomplete. */
const loadDicomWeb = async (series) => {
  const root = normalizeDicomWebSeriesUrl(series);
  try {
    const instances = await readMetadata(root);
    const result = dicomWebLoadResult(instances, root);
    if (!pyramidsNeedInstanceMetadata(result.pyramids)) {
      return result;
    }
    console.warn(
      "[minerva] dicom: series /metadata frame maps incomplete; using per-instance metadata",
    );
    return loadDicomWebPerInstance(root);
  } catch (seriesErr) {
    console.warn(
      "[minerva] dicom: series /metadata failed; falling back to per-instance metadata",
      seriesErr,
    );
    return loadDicomWebPerInstance(root);
  }
};

const findDicomWeb = (series) => {
  return listDicomWeb(series);
};

export {
  loadDicomWeb,
  findDicomWeb,
  normalizeDicomWebSeriesUrl,
  isDicomWebSeriesUrl,
  isDicomWeb,
  createTileLayers,
  readInstances,
  readMetadata,
  computeImagePyramid,
  parseDicomWeb,
  loadDicom,
};
