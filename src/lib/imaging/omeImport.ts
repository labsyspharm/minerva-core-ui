import { resolveImageContentRole } from "@/lib/imaging/channelKind";
import type { Loader } from "@/lib/imaging/viv";
import type { Image } from "@/lib/stores/documentSchema";
import type { Channel } from "@/lib/stores/documentStore";
import { flattenImageChannelsInDocumentOrder } from "@/lib/stores/documentStore";
import {
  applyLoaderPixelSizeToImage,
  applySourceChannelsToImages,
  setImageBasename,
  setImageContentRole,
  uniquifyMaskChannelNames,
} from "@/lib/stores/storeUtils";

export type OmeImageImportRole = "intensity" | "segmentation";

/** Segmentation import must not reuse the intensity file basename. */
export function maskBasenameClashesWithIntensity(
  images: Image[],
  basename: string,
): boolean {
  const key = basename.trim().toLowerCase();
  if (!key) return false;
  return images.some((im) => {
    const role = resolveImageContentRole({
      contentRole: im.contentRole,
      channels: im.channels ?? [],
    });
    if (role === "segmentation") return false;
    return im.basename.trim().toLowerCase() === key;
  });
}

export function prepareImportedSourceChannels(
  sourceChannels: Channel[],
  role: OmeImageImportRole,
  basename: string,
  existingImages: Image[],
): Channel[] {
  if (role !== "segmentation") return sourceChannels;
  return uniquifyMaskChannelNames(
    sourceChannels,
    basename,
    new Set(
      flattenImageChannelsInDocumentOrder(existingImages).map((c) => c.name),
    ),
  );
}

/** Attach extracted channels, pixel size, basename, and content role to the document. */
export function mergeExtractedChannelsIntoImages(
  images: Image[],
  sourceImageId: string,
  loader: Loader,
  basename: string,
  role: OmeImageImportRole,
  sourceChannels: Channel[],
): Image[] {
  let next = applySourceChannelsToImages(images, sourceChannels);
  next = applyLoaderPixelSizeToImage(next, sourceImageId, loader);
  next = setImageBasename(next, sourceImageId, basename);
  next = setImageContentRole(next, sourceImageId, role);
  return next;
}
