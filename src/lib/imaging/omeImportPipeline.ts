import { extractChannels } from "@/lib/authoring/config";
import {
  isImageChannel,
  isRgbDisplaySource,
  resolveImageImportRole,
} from "@/lib/imaging/channelKind";
import { loadOmeLoaderForRole } from "@/lib/imaging/filesystem";
import type { DecodePool } from "@/lib/imaging/omeDecodePool";
import type { Loader } from "@/lib/imaging/viv";
import type { ConfigGroup } from "@/lib/legacy/exhibit";
import type { Image } from "@/lib/stores/documentSchema";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { flattenImageChannelsInDocumentOrder } from "@/lib/stores/documentStore";
import {
  applySourceChannelsToImages,
  rebindReplacementImageChannels,
  replaceImageRowInDocument,
} from "@/lib/stores/storeUtils";
import {
  mergeExtractedChannelsIntoImages,
  type OmeImageImportRole,
  prepareImportedSourceChannels,
} from "./omeImport";
import {
  applySharedImportPaletteToChannelGroups,
  applySharedImportPaletteToSourceChannels,
} from "./psudoPalette";
import { seedMaskSourceChannelStyles } from "./sourceChannelStyle";

const PACKED_RGB_IF_NAMES = new Set(["r", "g", "b"]);

/** Viv planar packed RGB names the planes R/G/B; IF import uses Channel 1/2/3. */
function namePackedRgbIfChannels(channels: Channel[]): Channel[] {
  const intensity = channels
    .filter(isImageChannel)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (intensity.length !== 3) return channels;
  if (
    !intensity.every((c) =>
      PACKED_RGB_IF_NAMES.has((c.name ?? "").trim().toLowerCase()),
    )
  ) {
    return channels;
  }
  const names = new Map(
    intensity.map((c, i) => [c.id, `Channel ${i + 1}`] as const),
  );
  return channels.map((c) => {
    const name = names.get(c.id);
    return name ? { ...c, name } : c;
  });
}

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
  /** Persist when import dialog asked RGB vs separate channels. */
  rgbDisplay?: boolean;
}): BuiltOmeImportSlice {
  const {
    loader,
    role,
    basename,
    sourceImageId,
    existingImages,
    relevantGroups = [],
    rgbDisplay,
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
  let extractedGroups = extracted.ChannelGroups;
  if (role === "intensity" && rgbDisplay === false) {
    sourceChannels = namePackedRgbIfChannels(sourceChannels);
    sourceChannels = sourceChannels.map((c, i) =>
      c.name === "H&E" ? { ...c, name: `Channel ${i + 1}` } : c,
    );
    extractedGroups = [];
  }
  if (role === "segmentation") {
    sourceChannels = seedMaskSourceChannelStyles(sourceChannels);
  }
  const taggedForRgb =
    rgbDisplay == null
      ? sourceChannels
      : sourceChannels.map((c) => ({ ...c, rgbDisplay }));
  const persistRgbDisplay =
    role === "intensity"
      ? (rgbDisplay ?? (isRgbDisplaySource(taggedForRgb) ? true : undefined))
      : undefined;
  const nextImages = mergeExtractedChannelsIntoImages(
    existingImages,
    sourceImageId,
    loader,
    basename,
    role,
    taggedForRgb,
    persistRgbDisplay,
  );
  if (
    role === "intensity" &&
    extractedGroups.length === 0 &&
    isRgbDisplaySource(taggedForRgb)
  ) {
    const intensity = sourceChannels.filter(isImageChannel);
    extractedGroups = [
      {
        id: crypto.randomUUID(),
        expanded: true,
        name: "Hematoxylin & Eosin",
        channels: intensity.map((channel) => ({
          id: crypto.randomUUID(),
          channelId: channel.id,
          color: { r: 204, g: 0, b: 255 },
          lowerLimit: 0,
          upperLimit: 255,
        })),
      },
    ];
  }
  return {
    sourceChannels: taggedForRgb,
    extractedGroups,
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
): Promise<Image[]> {
  const flat = flattenImageChannelsInDocumentOrder(images);
  const styled = await applySharedImportPaletteToSourceChannels(flat);
  return applySourceChannelsToImages(images, styled);
}

export type ReplaceOmeLocalImageResult =
  | {
      ok: true;
      oldImageId: string;
      newImageId: string;
      loader: Loader;
      basename: string;
      nextImages: Image[];
      oldLocalHandleKey?: string;
    }
  | { ok: false; reason: "missing" | "unsupported" | "error"; error?: string };

/**
 * Load a local OME-TIFF as a replacement for `imageId`: new image id, same
 * channel ids (by index). Caller persists the file handle and updates React
 * loader entries / channel store.
 */
export async function replaceOmeLocalImageInDocument(args: {
  images: Image[];
  imageId: string;
  handle: Handle.File;
  pool?: DecodePool;
}): Promise<ReplaceOmeLocalImageResult> {
  const { images, imageId, handle, pool } = args;
  const oldImage = images.find((im) => im.id === imageId);
  if (!oldImage) return { ok: false, reason: "missing" };
  if (
    oldImage.source?.kind === "jpeg" ||
    oldImage.source?.kind === "dicomWeb"
  ) {
    return { ok: false, reason: "unsupported" };
  }

  const oldLocalHandleKey =
    oldImage.source?.kind === "local" ? oldImage.source.handleKey : undefined;
  const file = await handle.getFile();
  const role = resolveImageImportRole({
    contentRole: oldImage.contentRole,
    channels: oldImage.channels ?? [],
  });
  const loader = await loadOmeLoaderForRole(role, {
    kind: "local",
    handle,
    pool,
    rgbDisplay: oldImage.rgbDisplay,
  });
  const newImageId = crypto.randomUUID();
  const withoutOld = images.filter((im) => im.id !== imageId);
  const slice = buildOmeImportSlice({
    loader,
    role,
    basename: file.name,
    sourceImageId: newImageId,
    existingImages: withoutOld,
  });
  const incoming = slice.nextImages.find((im) => im.id === newImageId);
  if (!incoming) {
    return {
      ok: false,
      reason: "error",
      error: "Replacement image was not created.",
    };
  }

  const rebound = rebindReplacementImageChannels(oldImage, incoming);
  if ("error" in rebound) {
    return { ok: false, reason: "error", error: rebound.error };
  }

  return {
    ok: true,
    oldImageId: imageId,
    newImageId,
    loader,
    basename: file.name,
    nextImages: replaceImageRowInDocument(images, imageId, rebound),
    oldLocalHandleKey,
  };
}
