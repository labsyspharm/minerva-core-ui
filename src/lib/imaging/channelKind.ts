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
