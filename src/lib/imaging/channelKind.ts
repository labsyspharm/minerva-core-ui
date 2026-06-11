import type { ImageChannel } from "@/lib/stores/documentSchema";

/** Intensity / pseudocolor imagery (`channel`) vs label / segmentation (`mask`). */
export type ImageChannelKind = "channel" | "mask";

/** How a mask layer is drawn in the viewer. */
export type MaskVisualization = "outline" | "randomColors";

export const DEFAULT_MASK_VISUALIZATION: MaskVisualization = "outline";

/** Intensity channels on by default at import; matches default group slot count. */
export const DEFAULT_VISIBLE_INTENSITY_CHANNELS = 4;

/** Document image role for import dedupe (`mixed` maps to intensity). */
export function resolveImageImportRole(image: {
  contentRole?: "intensity" | "segmentation";
  channels: Pick<ImageChannel, "kind">[];
}): "intensity" | "segmentation" {
  const role = resolveImageContentRole(image);
  return role === "segmentation" ? "segmentation" : "intensity";
}

/** Normalize persisted / legacy `kind` values. */
function normalizeChannelKind(
  kind: string | undefined,
): ImageChannelKind | undefined {
  if (kind === "field") return "channel";
  if (kind === "channel" || kind === "mask") return kind;
  return undefined;
}

/**
 * Resolved role for one source channel (OME index). Uses persisted `kind` only;
 * defaults to `channel` when unset — not inferred from the display name.
 */
export function effectiveChannelKind(channel: {
  kind?: string;
}): ImageChannelKind {
  return normalizeChannelKind(channel.kind) ?? "channel";
}

export function isMaskChannel(channel: { kind?: string }): boolean {
  return effectiveChannelKind(channel) === "mask";
}

/** Pseudocolor intensity channel (not a label mask). */
export function isImageChannel(channel: { kind?: string }): boolean {
  return effectiveChannelKind(channel) === "channel";
}

type RgbDisplayChannelFields = {
  kind?: string;
  samples?: number;
  sourceDataTypeId?: string;
  imageId?: string;
};

/**
 * True for interleaved RGB (SamplesPerPixel=3) or planar uint8 RGB (3×SPP=1).
 * These are shown as a single color image, not multiplex fluorescence.
 */
export function isRgbDisplaySource(
  channels: readonly RgbDisplayChannelFields[],
): boolean {
  const intensity = channels.filter(isImageChannel);
  if (intensity.length === 0) return false;
  if (intensity.length === 1 && intensity[0].samples === 3) return true;
  return (
    intensity.length === 3 &&
    intensity.every(
      (c) =>
        (c.samples ?? 1) === 1 &&
        (c.sourceDataTypeId === "Uint8" || c.sourceDataTypeId === "uint8"),
    )
  );
}

/** Whether histogram / contrast controls should be hidden for this channel. */
export function isRgbDisplayChannel(
  channel: RgbDisplayChannelFields,
  allChannels: readonly RgbDisplayChannelFields[],
): boolean {
  if (!isImageChannel(channel)) return false;
  if (channel.samples === 3) return true;
  if (channel.imageId == null) return false;
  const onImage = allChannels.filter((c) => c.imageId === channel.imageId);
  return isRgbDisplaySource(onImage);
}

/** Document-level role inferred from persisted channel kinds on one image row. */
export type ImageSourceRole = "intensity" | "segmentation" | "mixed";

/** Prefer persisted {@link Image.contentRole}, else infer from channel kinds. */
export function resolveImageContentRole(image: {
  contentRole?: "intensity" | "segmentation";
  channels: Pick<ImageChannel, "kind">[];
}): ImageSourceRole | null {
  if (image.contentRole === "segmentation") return "segmentation";
  if (image.contentRole === "intensity") return "intensity";
  return imageSourceRole(image);
}

export function imageSourceRole(image: {
  channels: Pick<ImageChannel, "kind">[];
}): ImageSourceRole | null {
  if (image.channels.length === 0) return null;
  let sawChannel = false;
  let sawMask = false;
  for (const ch of image.channels) {
    if (effectiveChannelKind(ch) === "mask") sawMask = true;
    else sawChannel = true;
  }
  if (sawMask && sawChannel) return "mixed";
  if (sawMask) return "segmentation";
  return "intensity";
}
