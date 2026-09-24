import {
  type ImageChannel,
  type ImageChannelKind,
  type MaskVisualization,
  MaskVisualizationSchema,
} from "@/lib/stores/documentSchema";

export type { ImageChannelKind, MaskVisualization };

export const DEFAULT_MASK_VISUALIZATION: MaskVisualization = {
  style: "full",
  color: "random",
  opacity: 1,
};

/** Enable random colors with a new seed (also used to re-roll while active). */
export function withReseededRandomColors(
  value: MaskVisualization,
): MaskVisualization {
  let colorSeed = 1 + Math.floor(Math.random() * 0xffffff);
  if (colorSeed === value.colorSeed) {
    colorSeed = colorSeed >= 0xffffff ? 1 : colorSeed + 1;
  }
  return { ...value, color: "random", colorSeed };
}

/** Coerce persisted/legacy viz; falls back to default when invalid. */
export function normalizeMaskVisualization(value: unknown): MaskVisualization {
  const parsed = MaskVisualizationSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_MASK_VISUALIZATION;
}

/** Intensity channels on by default at import; matches default group slot count. */
export const DEFAULT_VISIBLE_INTENSITY_CHANNELS = 5;

/** Viv `XRLayer` shader cap (10 in Viv 0.22). Extra on-channels are not drawn. */
export const MAX_VIV_INTENSITY_CHANNELS = 10;

export const VIEWER_INTENSITY_LIMIT_HINT = `Max ${MAX_VIV_INTENSITY_CHANNELS} channels`;

/** Document image role for import (`mixed` maps to intensity). */
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
  /** Image-level import override, copied onto flattened channels. */
  rgbDisplay?: boolean;
};

/** True for OME/Viv uint8 type ids (`Uint8`, `uint8`, `int8`). */
export function isUint8Dtype(dtype: string | undefined): boolean {
  if (dtype == null || dtype === "") return false;
  return /^u?int8$/i.test(dtype.trim());
}

/** Full-scale intensity for contrast / histogram (8-bit vs 16-bit). */
export function sourceDtypeMax(sourceDataTypeId?: string): number {
  return isUint8Dtype(sourceDataTypeId) ? 255 : 65535;
}

/** Pseudocolor tints for planar R/G/B channels in the viewer and channel panel. */
const PLANAR_RGB_DISPLAY_COLORS = [
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
 * True for interleaved RGB (SamplesPerPixel=3), named planar RGB (HE_r/g/b),
 * or unnamed 3×uint8 planar (typical H&E). Import may set `rgbDisplay` to
 * override packed and planar cases (`false` = independent IF channels).
 */
export function isRgbDisplaySource(
  channels: readonly RgbDisplayChannelFields[],
): boolean {
  const intensity = channels.filter(isImageChannel);
  if (intensity.length === 0) return false;
  const override = intensity.find((c) => c.rgbDisplay != null)?.rgbDisplay;
  if (intensity.length === 1 && intensity[0].samples === 3) {
    return override !== false;
  }
  const planar = intensity.filter((c) => (c.samples ?? 1) === 1);
  if (planar.length !== 3) return false;
  if (override != null) return override;
  if (planar.every((c) => planarRgbSlotFromName(c.name ?? "") != null)) {
    return true;
  }
  return planar.every((c) => isUint8Dtype(c.sourceDataTypeId));
}

/** Apply image-level `rgbDisplay` onto channel fields for {@link isRgbDisplaySource}. */
export function isRgbDisplayImage(image: {
  channels?: readonly RgbDisplayChannelFields[] | null;
  rgbDisplay?: boolean;
}): boolean {
  const channels = image.channels ?? [];
  if (image.rgbDisplay == null) return isRgbDisplaySource(channels);
  return isRgbDisplaySource(
    channels.map((c) => ({ ...c, rgbDisplay: image.rgbDisplay })),
  );
}

/** 0 = red, 1 = green, 2 = blue within a planar RGB source triplet. */
function planarRgbSlotIndex(
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

/** Packed RGB, planar H&E, and 8-bit (full 0–255 window) are not GMM channels. */
export function isGmmEligible(
  channel: RgbDisplayChannelFields,
  allChannels: readonly RgbDisplayChannelFields[],
): boolean {
  return (
    isImageChannel(channel) &&
    channel.samples !== 3 &&
    !isRgbDisplayChannel(channel, allChannels) &&
    !isUint8Dtype(channel.sourceDataTypeId)
  );
}

/** Whether histogram / contrast controls should be hidden for this channel. */
export function isRgbDisplayChannel(
  channel: RgbDisplayChannelFields,
  allChannels: readonly RgbDisplayChannelFields[],
): boolean {
  if (!isImageChannel(channel)) return false;
  if (channel.imageId != null) {
    return isRgbDisplaySource(
      allChannels.filter((c) => c.imageId === channel.imageId),
    );
  }
  return isRgbDisplaySource([channel]);
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
