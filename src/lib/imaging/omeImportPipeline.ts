import { extractChannels } from "@/lib/authoring/config";
import type { Loader } from "@/lib/imaging/viv";
import type { ConfigGroup } from "@/lib/legacy/exhibit";
import type { Image } from "@/lib/stores/documentSchema";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { flattenImageChannelsInDocumentOrder } from "@/lib/stores/documentStore";
import { applySourceChannelsToImages } from "@/lib/stores/storeUtils";
import {
  mergeExtractedChannelsIntoImages,
  type OmeImageImportRole,
  prepareImportedSourceChannels,
} from "./omeImport";
import {
  applySharedImportPaletteToChannelGroups,
  applySharedImportPaletteToSourceChannels,
} from "./pseudoPalette";
import { styleSourceChannelsForRole } from "./sourceChannelStyle";

export type BuiltOmeImportSlice = {
  sourceChannels: Channel[];
  /** Groups extracted from the loader (may be empty for flat imports). */
  extractedGroups: ChannelGroup[];
  nextImages: Image[];
};

/**
 * Pure core for one OME image: extract channels, prepare names/styles, merge
 * into the image list. Callers own loader creation, palette, sources/handles,
 * store writes, and ROI attach.
 */
export function buildOmeImportSlice(args: {
  loader: Loader;
  role: OmeImageImportRole;
  basename: string;
  sourceImageId: string;
  existingImages: Image[];
  relevantGroups?: ConfigGroup[];
}): BuiltOmeImportSlice {
  const {
    loader,
    role,
    basename,
    sourceImageId,
    existingImages,
    relevantGroups = [],
  } = args;
  const defaultKind = role === "segmentation" ? "mask" : "channel";
  const extracted = extractChannels(
    loader,
    "Colorimetric",
    relevantGroups,
    sourceImageId,
    defaultKind,
  );
  let sourceChannels = prepareImportedSourceChannels(
    extracted.SourceChannels,
    role,
    basename,
    existingImages,
  );
  if (role === "segmentation") {
    sourceChannels = styleSourceChannelsForRole(sourceChannels, role);
  }
  const nextImages = mergeExtractedChannelsIntoImages(
    existingImages,
    sourceImageId,
    loader,
    basename,
    role,
    sourceChannels,
  );
  return {
    sourceChannels,
    extractedGroups: extracted.ChannelGroups,
    nextImages,
  };
}

/**
 * After appending intensity groups onto an existing group list, re-run the
 * shared palette across the merged document channel set.
 */
export async function finalizeAppendedIntensityGroups(args: {
  mergedGroups: ChannelGroup[];
  newIntensityGroups: ChannelGroup[];
  nextImages: Image[];
}): Promise<ChannelGroup[]> {
  const { mergedGroups, newIntensityGroups, nextImages } = args;
  if (newIntensityGroups.length === 0) return mergedGroups;
  const withNew = [...mergedGroups, ...newIntensityGroups];
  const flat = flattenImageChannelsInDocumentOrder(nextImages);
  return applySharedImportPaletteToChannelGroups(withNew, flat);
}

/** Re-apply source-channel palette into images (fresh replace, no groups). */
export async function applyPaletteToFlatImportImages(
  images: Image[],
  sourceChannels: Channel[],
): Promise<Image[]> {
  const styled = await applySharedImportPaletteToSourceChannels(sourceChannels);
  return applySourceChannelsToImages(images, styled);
}

/** Palette for a replace-import that already has extracted groups. */
export async function applyPaletteToGroupedImport(
  groups: ChannelGroup[],
  sourceChannels: Channel[],
): Promise<ChannelGroup[]> {
  return applySharedImportPaletteToChannelGroups(groups, sourceChannels);
}
