import type { TiffPixelSource } from "@hms-dbmi/viv";
import { getImageSize } from "@hms-dbmi/viv";
import {
  effectiveChannelKind,
  isRgbDisplaySource,
} from "@/lib/imaging/channelKind";
import type {
  ChannelGroup,
  Image,
  ImageChannel,
} from "@/lib/stores/documentSchema";
import {
  exportTransferForImage,
  folderLimitsForTransfer,
  type JpegExportTransfer,
} from "./cubeRootEncoding";
import { JPEG_PYRAMID_TILE_SIZE } from "./jpegPyramid";
import type { OmeLoaderEntry } from "./loaderEntries";

export type LoaderPlane = TiffPixelSource<string[]>;

export type OmeExportLevelSize = {
  width: number;
  height: number;
  tileSize: number;
};

/** Unsigned label dtypes supported by zlib mask OME-TIFF export. */
export type LabelDtype = "Uint8" | "Uint16" | "Uint32";

/** Max raw intensity for contrast mapping (8-bit vs everything else as 16-bit). */
export function dtypeMaxForChannel(sourceDataTypeId?: string): number {
  if (sourceDataTypeId === "Uint8" || sourceDataTypeId === "Int8") return 255;
  return 65535;
}

export function bitsPerSampleFromDtype(dtype: string): 8 | 16 | 32 {
  if (dtype === "Uint8" || dtype === "Int8") return 8;
  if (dtype === "Uint16" || dtype === "Int16") return 16;
  if (dtype === "Uint32" || dtype === "Int32") return 32;
  throw new Error(`Unsupported mask dtype ${dtype}`);
}

export function omeTypeFromDtype(dtype: string): string {
  switch (dtype) {
    case "Uint8":
      return "uint8";
    case "Uint16":
      return "uint16";
    case "Uint32":
      return "uint32";
    case "Int8":
      return "int8";
    case "Int16":
      return "int16";
    case "Int32":
      return "int32";
    default:
      throw new Error(`Unsupported mask dtype ${dtype}`);
  }
}

export function assertUnsignedLabelDtype(dtype: string): LabelDtype {
  if (dtype === "Uint8" || dtype === "Uint16" || dtype === "Uint32") {
    return dtype;
  }
  throw new Error(
    `Mask OME-TIFF export requires unsigned integer pixels (got ${dtype})`,
  );
}

export type OmePixelsMeta = {
  PhysicalSizeX?: number;
  PhysicalSizeY?: number;
  PhysicalSizeZ?: number;
  PhysicalSizeXUnit?: string;
  PhysicalSizeYUnit?: string;
  PhysicalSizeZUnit?: string;
};

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** OME Channel `Color` is signed big-endian RGBA packed into an int32. */
function omeColorInt(color: { r: number; g: number; b: number }): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint8(0, color.r & 0xff);
  view.setUint8(1, color.g & 0xff);
  view.setUint8(2, color.b & 0xff);
  view.setUint8(3, 255);
  return view.getInt32(0, false);
}

function optionalNumberAttr(name: string, value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return ` ${name}="${value}"`;
}

function optionalStringAttr(name: string, value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return ` ${name}="${escapeXmlAttr(value)}"`;
}

export type BuildOmeTiffXmlOpts = {
  imageName: string;
  channels: ReadonlyArray<Pick<ImageChannel, "id" | "name" | "color">>;
  width: number;
  height: number;
  fileName: string;
  pixelType: string;
  significantBits: number;
  pixels?: OmePixelsMeta | null;
};

/**
 * Minimal OME-XML for Viv `loadOmeTiff` / mask IFD0+SubIFD loaders
 * (single `<Image>`, planar `TiffData` IFDs).
 */
export function buildOmeTiffXml(opts: BuildOmeTiffXmlOpts): string {
  const {
    imageName,
    channels,
    width,
    height,
    fileName,
    pixelType,
    significantBits,
    pixels,
  } = opts;
  const sizeC = channels.length;

  const channelXml = channels
    .map((ch, i) => {
      const id = escapeXmlAttr(ch.id || `Channel:0:${i}`);
      const chName = escapeXmlAttr(ch.name?.trim() || `Channel ${i}`);
      const colorAttr =
        ch.color &&
        typeof ch.color.r === "number" &&
        typeof ch.color.g === "number" &&
        typeof ch.color.b === "number"
          ? ` Color="${omeColorInt({ r: ch.color.r, g: ch.color.g, b: ch.color.b })}"`
          : "";
      return `<Channel ID="${id}" Name="${chName}" SamplesPerPixel="1"${colorAttr}/>`;
    })
    .join("");

  const tiffDataXml = channels
    .map((_, i) => {
      const uuid = escapeXmlAttr(fileName);
      return (
        `<TiffData FirstC="${i}" FirstT="0" FirstZ="0" IFD="${i}" PlaneCount="1">` +
        `<UUID FileName="${uuid}">${uuid}</UUID>` +
        `</TiffData>`
      );
    })
    .join("");

  const physicalAttrs =
    optionalNumberAttr("PhysicalSizeX", pixels?.PhysicalSizeX) +
    optionalNumberAttr("PhysicalSizeY", pixels?.PhysicalSizeY) +
    optionalNumberAttr("PhysicalSizeZ", pixels?.PhysicalSizeZ) +
    optionalStringAttr("PhysicalSizeXUnit", pixels?.PhysicalSizeXUnit) +
    optionalStringAttr("PhysicalSizeYUnit", pixels?.PhysicalSizeYUnit) +
    optionalStringAttr("PhysicalSizeZUnit", pixels?.PhysicalSizeZUnit);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<OME xmlns="http://www.openmicroscopy.org/Schemas/OME/2016-06"` +
    ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` xsi:schemaLocation="http://www.openmicroscopy.org/Schemas/OME/2016-06 http://www.openmicroscopy.org/Schemas/OME/2016-06/ome.xsd">` +
    `<Image ID="Image:0" Name="${escapeXmlAttr(imageName)}">` +
    `<Pixels ID="Pixels:0" DimensionOrder="XYZCT" Type="${escapeXmlAttr(pixelType)}"` +
    ` SizeX="${width}" SizeY="${height}" SizeZ="1" SizeC="${sizeC}" SizeT="1"` +
    ` SignificantBits="${significantBits}" Interleaved="false" BigEndian="false"${physicalAttrs}>` +
    `${channelXml}${tiffDataXml}` +
    `</Pixels></Image></OME>`
  );
}

function omeTiffExportBaseName(image: Image): string {
  const raw =
    image.basename?.replace(/\.(ome\.)?(tif|tiff)$/i, "") ||
    image.id ||
    "image";
  return raw.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
}

export function omeTiffExportFileName(image: Image, used: Set<string>): string {
  const base = omeTiffExportBaseName(image);
  let name = `${base}.ome.tif`;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base}_${n}.ome.tif`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Prefer `basename.ome.tif`; use `_mask` when that name is already taken. */
export function omeTiffMaskExportFileName(
  image: Image,
  used: Set<string>,
): string {
  const base = omeTiffExportBaseName(image);
  for (const candidate of [`${base}.ome.tif`, `${base}_mask.ome.tif`]) {
    if (!used.has(candidate.toLowerCase())) {
      used.add(candidate.toLowerCase());
      return candidate;
    }
  }
  let n = 2;
  let name = `${base}_mask_${n}.ome.tif`;
  while (used.has(name.toLowerCase())) {
    n += 1;
    name = `${base}_mask_${n}.ome.tif`;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Unique channelIds referenced by any channel group. */
export function channelIdsFromGroups(
  channelGroups: ChannelGroup[],
): Set<string> {
  const ids = new Set<string>();
  for (const g of channelGroups) {
    for (const row of g.channels) {
      ids.add(row.channelId);
    }
  }
  return ids;
}

export function isRgbExportImage(image: Image): boolean {
  return isRgbDisplaySource(image.channels ?? []);
}

function channelsOfKind(
  image: Image,
  kind: "channel" | "mask",
): ImageChannel[] {
  return (image.channels ?? [])
    .filter((ch) => effectiveChannelKind(ch) === kind)
    .slice()
    .sort((a, b) => a.index - b.index);
}

function groupChannelsForOmeExport(
  image: Image,
  channelGroups: ChannelGroup[],
  kind: "channel" | "mask",
): ImageChannel[] {
  const wanted = channelIdsFromGroups(channelGroups);
  if (wanted.size === 0) return [];
  return channelsOfKind(image, kind).filter((ch) => wanted.has(ch.id));
}

/**
 * Intensity channels for JPEG OME-TIFF.
 * RGB: all intensity. IF: group rows when any exist, otherwise all intensity.
 */
export function groupIntensityChannelsForOmeExport(
  image: Image,
  channelGroups: ChannelGroup[],
): ImageChannel[] {
  const all = channelsOfKind(image, "channel");
  if (all.length === 0) return [];
  if (isRgbExportImage(image)) return all;
  const grouped = groupChannelsForOmeExport(image, channelGroups, "channel");
  return grouped.length > 0 ? grouped : all;
}

/** Mask channels: group rows, or all masks when that would otherwise drop the image. */
export function groupMaskChannelsForOmeExport(
  image: Image,
  channelGroups: ChannelGroup[],
): ImageChannel[] {
  const grouped = groupChannelsForOmeExport(image, channelGroups, "mask");
  if (grouped.length > 0) return grouped;
  const intensity = groupIntensityChannelsForOmeExport(image, channelGroups);
  return intensity.length === 0 ? channelsOfKind(image, "mask") : [];
}

/** Group-row contrast, else source limits, else 0…dtypeMax (RGB / ungrouped IF). */
export function contrastLimitsForExportedChannel(
  channel: ImageChannel,
  channelGroups: ChannelGroup[],
): { lowerLimit: number; upperLimit: number } {
  for (const g of channelGroups) {
    for (const row of g.channels) {
      if (row.channelId !== channel.id) continue;
      return { lowerLimit: row.lowerLimit, upperLimit: row.upperLimit };
    }
  }
  const max = dtypeMaxForChannel(channel.sourceDataTypeId);
  return {
    lowerLimit: channel.lowerLimit ?? 0,
    upperLimit: channel.upperLimit ?? max,
  };
}

export type JpegPyramidExportChannel = {
  channelId: string;
  sourceImageId: string;
  index: number;
  lowerLimit: number;
  upperLimit: number;
  transfer: JpegExportTransfer;
};

function imageOwningChannel(
  images: Image[],
  channelId: string,
): { image: Image; channel: ImageChannel } | null {
  for (const image of images) {
    const channel = (image.channels ?? []).find((ch) => ch.id === channelId);
    if (channel) return { image, channel };
  }
  return null;
}

/**
 * JPEG pyramid folders: group intensity (and mask) rows, plus RGB sources
 * that have no group row so they are not dropped.
 */
export function jpegPyramidExportChannels(
  images: Image[],
  channelGroups: ChannelGroup[],
  storyTransfer: JpegExportTransfer,
): JpegPyramidExportChannel[] {
  const out: JpegPyramidExportChannel[] = [];
  const seenGroupChannelIds = new Set<string>();

  for (const g of channelGroups) {
    for (const row of g.channels) {
      const loc = imageOwningChannel(images, row.channelId);
      if (!loc) continue;
      const transfer = exportTransferForImage(loc.image, storyTransfer);
      const limits = folderLimitsForTransfer(
        transfer,
        row.lowerLimit,
        row.upperLimit,
      );
      out.push({
        channelId: row.channelId,
        sourceImageId: loc.image.id,
        index: loc.channel.index,
        lowerLimit: limits.lowerLimit,
        upperLimit: limits.upperLimit,
        transfer,
      });
      seenGroupChannelIds.add(row.channelId);
    }
  }

  for (const image of images) {
    if (!isRgbExportImage(image)) continue;
    const transfer = exportTransferForImage(image, storyTransfer);
    for (const ch of groupIntensityChannelsForOmeExport(image, channelGroups)) {
      if (seenGroupChannelIds.has(ch.id)) continue;
      const lim = contrastLimitsForExportedChannel(ch, channelGroups);
      const limits = folderLimitsForTransfer(
        transfer,
        lim.lowerLimit,
        lim.upperLimit,
      );
      out.push({
        channelId: ch.id,
        sourceImageId: image.id,
        index: ch.index,
        lowerLimit: limits.lowerLimit,
        upperLimit: limits.upperLimit,
        transfer,
      });
    }
  }
  return out;
}

/** Shared used-name set so intensity + mask files never collide. */
export function allocateOmeTiffExportFileNames(
  intensityImages: Image[],
  maskImages: Image[],
): { intensityFileNames: string[]; maskFileNames: string[] } {
  const used = new Set<string>();
  return {
    intensityFileNames: intensityImages.map((im) =>
      omeTiffExportFileName(im, used),
    ),
    maskFileNames: maskImages.map((im) => omeTiffMaskExportFileName(im, used)),
  };
}

export function stitchOmeTiffExportImages(
  images: Image[],
  remappedById: Map<string, Image>,
  insertedAfter: Map<string, Image[]>,
  dropIds: Set<string>,
): Image[] {
  return images.flatMap((im) => {
    if (dropIds.has(im.id)) return insertedAfter.get(im.id) ?? [];
    const main = remappedById.get(im.id) ?? im;
    return [main, ...(insertedAfter.get(im.id) ?? [])];
  });
}

/** Remap exported channels to TIFF positions 0..k-1; point source at the relative file. */
export function remappedImageForOmeTiffExport(
  image: Image,
  exportedChannels: ImageChannel[],
  fileName: string,
): Image {
  return {
    ...image,
    sizeC: exportedChannels.length,
    channels: exportedChannels.map((ch, i) => ({ ...ch, index: i })),
    source: { kind: "url", url: fileName },
  };
}

export function planeLevels(loaderData: LoaderPlane[]): OmeExportLevelSize[] {
  return loaderData.map((plane) => {
    const { width, height } = getImageSize(plane);
    const tileSize =
      typeof plane.tileSize === "number" && plane.tileSize > 0
        ? plane.tileSize
        : JPEG_PYRAMID_TILE_SIZE;
    return { width, height, tileSize };
  });
}

export function tileCountForLevels(
  levels: readonly OmeExportLevelSize[],
  channelCount: number,
): number {
  let n = 0;
  for (const level of levels) {
    n +=
      Math.ceil(level.width / level.tileSize) *
      Math.ceil(level.height / level.tileSize) *
      channelCount;
  }
  return n;
}

export function loaderPlanesOrUndef(
  entry: OmeLoaderEntry,
): LoaderPlane[] | undefined {
  const data = entry.loader.data as LoaderPlane[] | undefined;
  return data?.length ? data : undefined;
}
