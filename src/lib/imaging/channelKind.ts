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
  name?: string;
  index?: number;
  id?: string;
};

function isPlanarIntensityDtype(dtype: string | undefined): boolean {
  if (dtype == null || dtype === "") return false;
  return /uint/i.test(dtype);
}

/** Pseudocolor tints for planar R/G/B channels in the viewer and channel panel. */
export const PLANAR_RGB_DISPLAY_COLORS = [
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
] as const;

function planarRgbSlotFromName(name: string): 0 | 1 | 2 | null {
  const n = name.toLowerCase();
  if (n.endsWith("_r") || n.endsWith("-r") || n.endsWith("[r]") || n === "r") {
    return 0;
  }
  if (n.endsWith("_g") || n.endsWith("-g") || n.endsWith("[g]") || n === "g") {
    return 1;
  }
  if (n.endsWith("_b") || n.endsWith("-b") || n.endsWith("[b]") || n === "b") {
    return 2;
  }
  return null;
}

/**
 * True for interleaved RGB (SamplesPerPixel=3) or planar RGB (3×SPP=1, e.g. H&E HE_r/g/b).
 * These are shown as a single color image, not multiplex fluorescence.
 */
export function isRgbDisplaySource(
  channels: readonly RgbDisplayChannelFields[],
): boolean {
  const intensity = channels.filter(isImageChannel);
  if (intensity.length === 0) return false;
  if (intensity.length === 1 && intensity[0].samples === 3) return true;
  const planar = intensity.filter((c) => (c.samples ?? 1) === 1);
  if (planar.length !== 3) return false;
  if (planar.every((c) => planarRgbSlotFromName(c.name ?? "") != null)) {
    return true;
  }
  return planar.every((c) => isPlanarIntensityDtype(c.sourceDataTypeId));
}

/** 0 = red, 1 = green, 2 = blue within a planar RGB source triplet. */
export function planarRgbSlotIndex(
  channel: RgbDisplayChannelFields,
  allChannels: readonly RgbDisplayChannelFields[],
): number | null {
  if (!isRgbDisplayChannel(channel, allChannels)) return null;
  if (channel.samples === 3) return null;
  const byName = planarRgbSlotFromName(channel.name ?? "");
  if (byName != null) return byName;
  const onImage = allChannels
    .filter(
      (c) =>
        c.imageId === channel.imageId &&
        isImageChannel(c) &&
        (c.samples ?? 1) === 1,
    )
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (onImage.length !== 3) return null;
  const pos = onImage.findIndex(
    (c) =>
      (channel.id != null && c.id === channel.id) || c.index === channel.index,
  );
  return pos >= 0 && pos < 3 ? pos : null;
}

export function planarRgbDisplayColor(
  channel: RgbDisplayChannelFields,
  allChannels: readonly RgbDisplayChannelFields[],
): { r: number; g: number; b: number } | null {
  const slot = planarRgbSlotIndex(channel, allChannels);
  if (slot == null) return null;
  return PLANAR_RGB_DISPLAY_COLORS[slot];
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
