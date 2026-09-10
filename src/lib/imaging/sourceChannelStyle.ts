import type { MaskVisualization } from "@/lib/imaging/channelKind";
import {
  DEFAULT_MASK_VISUALIZATION,
  isImageChannel,
  isMaskChannel,
  normalizeMaskVisualization,
  planarRgbDisplayColor,
} from "@/lib/imaging/channelKind";
import type { ChannelGroup, Color } from "@/lib/stores/documentSchema";
import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";

export type RgbColor = { r: number; g: number; b: number };

export const IMPORT_DEFAULT_SEED_HEX = [
  "0dabff",
  "c3ff00",
  "ff8b00",
  "ff00c7",
] as const;

export const IMPORT_DEFAULT_LOWER_LIMIT = 2 ** 5;
export const IMPORT_DEFAULT_UPPER_LIMIT = 2 ** 14;

export function looksLikeImportDefaultLimits(
  lower: number,
  upper: number,
): boolean {
  if (
    lower === IMPORT_DEFAULT_LOWER_LIMIT &&
    upper === IMPORT_DEFAULT_UPPER_LIMIT
  ) {
    return true;
  }
  if (lower === 0 && upper === 65535) return true;
  if (lower === 0 && upper === 255) return true;
  return false;
}

export function hexToRgb(hex: string): RgbColor {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function rgbToHex(color: {
  r?: number;
  g?: number;
  b?: number;
}): string {
  return [color.r ?? 0, color.g ?? 0, color.b ?? 0]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function looksLikeImportDefaultSeedColor(color: {
  r?: number;
  g?: number;
  b?: number;
}): boolean {
  return (IMPORT_DEFAULT_SEED_HEX as readonly string[]).includes(
    rgbToHex(color),
  );
}

const UNASSIGNED_STACK_COLOR: Color = { r: 160, g: 160, b: 160 };

export function effectiveSourceColor(
  channel: Channel,
  allChannels?: readonly Channel[],
): Color {
  if (channel.color) return channel.color;
  if (allChannels) {
    const planar = planarRgbDisplayColor(channel, allChannels);
    if (planar) return planar;
  }
  if (channel.samples === 3) {
    return { r: 204, g: 0, b: 255 };
  }
  return UNASSIGNED_STACK_COLOR;
}

export function effectiveDisplayColor(
  channel: Channel,
  allChannels: readonly Channel[],
  groupRow?: ChannelGroupChannel | null,
): Color {
  return (
    planarRgbDisplayColor(channel, allChannels) ??
    groupRow?.color ??
    effectiveSourceColor(channel, allChannels)
  );
}

/** Hex for a color swatch, or undefined when the channel has no color yet. */
export function assignedDisplayHex(
  channel: Channel,
  allChannels: readonly Channel[],
  groupRow?: ChannelGroupChannel | null,
): string | undefined {
  if (
    !channel.color &&
    !groupRow?.color &&
    !planarRgbDisplayColor(channel, allChannels)
  ) {
    return undefined;
  }
  return rgbToHex(effectiveDisplayColor(channel, allChannels, groupRow));
}

export function effectiveSourceLimits(channel: Channel): [number, number] {
  if (channel.gmmContrastLimits) {
    return [channel.gmmContrastLimits.lower, channel.gmmContrastLimits.upper];
  }
  const lo = channel.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT;
  const hi = channel.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT;
  return [lo, hi];
}

export function effectiveMaskVisualization(row: {
  maskVisualization?: unknown;
}): MaskVisualization {
  return normalizeMaskVisualization(row.maskVisualization);
}

export function effectiveMaskVisualizationForSource(
  sc: Channel,
  channelGroups: ChannelGroup[],
  activeChannelGroupId?: string | null,
): MaskVisualization {
  const groups = activeChannelGroupId
    ? [
        channelGroups.find((g) => g.id === activeChannelGroupId),
        ...channelGroups.filter((g) => g.id !== activeChannelGroupId),
      ]
    : channelGroups;
  for (const g of groups) {
    if (!g) continue;
    const row = g.channels.find((gc) => gc.channelId === sc.id);
    if (row) return effectiveMaskVisualization(row);
  }
  return effectiveMaskVisualization(sc);
}

export function seedMaskSourceChannelStyles(channels: Channel[]): Channel[] {
  return channels.map((sc) => ({
    ...sc,
    color: sc.color ?? { r: 136, g: 136, b: 136 },
    lowerLimit: sc.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT,
    upperLimit: sc.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT,
    ...(isMaskChannel(sc)
      ? {
          maskVisualization: sc.maskVisualization ?? DEFAULT_MASK_VISUALIZATION,
        }
      : {}),
  }));
}

export function seedDefaultSourceChannelStyles(
  sourceChannels: Channel[],
  palette?: readonly RgbColor[],
): Channel[] {
  let paletteIndex = 0;
  return sourceChannels.map((sc) => {
    if (sc.samples === 3) {
      return {
        ...sc,
        color: sc.color ?? { r: 204, g: 0, b: 255 },
        lowerLimit: sc.lowerLimit ?? 0,
        upperLimit: sc.upperLimit ?? 255,
      };
    }
    if (isMaskChannel(sc)) {
      return {
        ...sc,
        color: sc.color ?? { r: 136, g: 136, b: 136 },
        lowerLimit: sc.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT,
        upperLimit: sc.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT,
        maskVisualization: sc.maskVisualization ?? DEFAULT_MASK_VISUALIZATION,
      };
    }
    const planar = planarRgbDisplayColor(sc, sourceChannels);
    if (planar) {
      return {
        ...sc,
        color: sc.color ?? planar,
        lowerLimit: sc.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT,
        upperLimit: sc.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT,
      };
    }
    if (sc.color) {
      return {
        ...sc,
        color: sc.color,
        lowerLimit: sc.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT,
        upperLimit: sc.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT,
      };
    }
    const fromPalette =
      isImageChannel(sc) && palette && paletteIndex < palette.length
        ? palette[paletteIndex++]
        : undefined;
    return {
      ...sc,
      ...(fromPalette
        ? { color: { r: fromPalette.r, g: fromPalette.g, b: fromPalette.b } }
        : {}),
      lowerLimit: sc.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT,
      upperLimit: sc.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT,
    };
  });
}
