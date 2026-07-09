import type { MaskVisualization } from "@/lib/imaging/channelKind";
import {
  DEFAULT_MASK_VISUALIZATION,
  isMaskChannel,
  planarRgbDisplayColor,
} from "@/lib/imaging/channelKind";
import type { ChannelGroup, Color } from "@/lib/stores/documentSchema";
import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";

/** Shared import-time palette seeds (used before psudo optimization). */
export type RgbColor = { r: number; g: number; b: number };

/** Default hex seeds from `extractChannels` (before psudo). */
export const IMPORT_DEFAULT_SEED_HEX = [
  "0dabff",
  "c3ff00",
  "ff8b00",
  "ff00c7",
] as const;

export const IMPORT_DEFAULT_LOWER_LIMIT = 2 ** 5;
export const IMPORT_DEFAULT_UPPER_LIMIT = 2 ** 14;

export function hexToRgb(hex: string): RgbColor {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function defaultSeedColorForIndex(index: number): Color {
  return hexToRgb(
    IMPORT_DEFAULT_SEED_HEX[index % IMPORT_DEFAULT_SEED_HEX.length],
  );
}

export function effectiveSourceColor(
  channel: Channel,
  indexInList: number,
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
  return defaultSeedColorForIndex(indexInList);
}

/** Viewer / panel tint: planar RGB slot, then group row, then source defaults. */
export function effectiveDisplayColor(
  channel: Channel,
  allChannels: readonly Channel[],
  groupRow?: ChannelGroupChannel | null,
  indexInList = 0,
): Color {
  return (
    planarRgbDisplayColor(channel, allChannels) ??
    groupRow?.color ??
    effectiveSourceColor(channel, indexInList, allChannels)
  );
}

export function effectiveSourceLimits(channel: Channel): [number, number] {
  if (channel.gmmContrastLimits) {
    return [channel.gmmContrastLimits.lower, channel.gmmContrastLimits.upper];
  }
  const lo = channel.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT;
  const hi = channel.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT;
  return [lo, hi];
}

/** Resolved mask display mode from a source channel or group row. */
export function effectiveMaskVisualization(row: {
  maskVisualization?: string;
}): MaskVisualization {
  if (row.maskVisualization === "outline") return "outline";
  if (row.maskVisualization === "randomColors") return "randomColors";
  return DEFAULT_MASK_VISUALIZATION;
}

/**
 * Mask display for the viewer: group row wins when this source is in a group
 * (UI toggles there); otherwise use the source channel field.
 */
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

/** Default styles for mask source channels when not placed in a group row. */
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

/** Apply mask-specific defaults when importing a segmentation image. */
export function styleSourceChannelsForRole(
  channels: Channel[],
  role: "intensity" | "segmentation",
): Channel[] {
  return role === "segmentation"
    ? seedMaskSourceChannelStyles(channels)
    : channels;
}

/** Seed import defaults on flat source channels (no channel groups). */
export function seedDefaultSourceChannelStyles(
  sourceChannels: Channel[],
  palette?: readonly RgbColor[],
): Channel[] {
  let intensityIndex = 0;
  return sourceChannels.map((sc) => {
    if (sc.samples === 3) {
      return {
        ...sc,
        color: sc.color ?? { r: 204, g: 0, b: 255 },
        lowerLimit: sc.lowerLimit ?? 0,
        upperLimit: sc.upperLimit ?? 255,
      };
    }
    const planar = planarRgbDisplayColor(sc, sourceChannels);
    const idx = intensityIndex++;
    const fromPalette = palette?.[idx % (palette?.length ?? 1)];
    const color =
      sc.color ??
      planar ??
      (fromPalette
        ? { r: fromPalette.r, g: fromPalette.g, b: fromPalette.b }
        : defaultSeedColorForIndex(idx));
    return {
      ...sc,
      color,
      lowerLimit: sc.lowerLimit ?? IMPORT_DEFAULT_LOWER_LIMIT,
      upperLimit: sc.upperLimit ?? IMPORT_DEFAULT_UPPER_LIMIT,
      ...(isMaskChannel(sc)
        ? {
            maskVisualization:
              sc.maskVisualization ?? DEFAULT_MASK_VISUALIZATION,
          }
        : {}),
    };
  });
}
