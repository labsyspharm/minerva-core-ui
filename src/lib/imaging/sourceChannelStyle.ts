import type { MaskVisualization } from "@/lib/imaging/channelKind";
import {
  DEFAULT_MASK_VISUALIZATION,
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isMaskChannel,
} from "@/lib/imaging/channelKind";
import type { RgbColor } from "@/lib/imaging/psudoPalette";
import {
  hexToRgb,
  IMPORT_DEFAULT_LOWER_LIMIT,
  IMPORT_DEFAULT_SEED_HEX,
  IMPORT_DEFAULT_UPPER_LIMIT,
} from "@/lib/imaging/psudoPalette";
import type { ChannelGroup, Color } from "@/lib/stores/documentSchema";
import type { Channel } from "@/lib/stores/documentStore";

function defaultSeedColorForIndex(index: number): Color {
  return hexToRgb(
    IMPORT_DEFAULT_SEED_HEX[index % IMPORT_DEFAULT_SEED_HEX.length],
  );
}

export function effectiveSourceColor(
  channel: Channel,
  indexInList: number,
): Color {
  if (channel.color) return channel.color;
  if (channel.samples === 3) {
    return { r: 204, g: 0, b: 255 };
  }
  return defaultSeedColorForIndex(indexInList);
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
    const idx = intensityIndex++;
    const fromPalette = palette?.[idx % (palette?.length ?? 1)];
    const color =
      sc.color ??
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

/**
 * Default visibility map for a new import: first `DEFAULT_VISIBLE_INTENSITY_CHANNELS`
 * intensity channels on, masks on, rest off. Existing entries in `prev` win so
 * user toggles survive a re-import / append.
 */
export function defaultVisibilitiesForSources(
  sourceChannels: Channel[],
  prev: Record<string, boolean> = {},
): Record<string, boolean> {
  const sourceIds = new Set(sourceChannels.map((sc) => sc.id));
  const prevVisibility = (sc: Channel): boolean | undefined => {
    if (prev[sc.id] !== undefined) return prev[sc.id];
    if (prev[sc.name] !== undefined) return prev[sc.name];
    return undefined;
  };
  const hasHiddenSource = sourceChannels.some(
    (sc) => prevVisibility(sc) === false,
  );
  const visibleIntensityCount = sourceChannels.filter(
    (sc) => isImageChannel(sc) && prevVisibility(sc) !== false,
  ).length;

  // Old sessions/import paths may have persisted every channel as visible. That
  // is indistinguishable from an unseeded default, so reset it to the first four.
  // If any current source is explicitly hidden, preserve the user's choices.
  const shouldPreserveExisting =
    hasHiddenSource ||
    visibleIntensityCount <= DEFAULT_VISIBLE_INTENSITY_CHANNELS;

  const out: Record<string, boolean> = {};
  for (const [key, visible] of Object.entries(prev)) {
    if (sourceIds.has(key)) continue;
    if (sourceChannels.some((sc) => sc.name === key)) continue;
    out[key] = visible;
  }
  let intensitySeen = 0;
  for (const sc of sourceChannels) {
    const existing = prevVisibility(sc);
    if (existing !== undefined && shouldPreserveExisting) {
      if (existing !== false && isImageChannel(sc)) intensitySeen++;
      out[sc.id] = existing;
      continue;
    }
    if (isMaskChannel(sc)) {
      out[sc.id] = true;
      continue;
    }
    if (isImageChannel(sc)) {
      const shouldShow = intensitySeen < DEFAULT_VISIBLE_INTENSITY_CHANNELS;
      out[sc.id] = shouldShow;
      if (shouldShow) intensitySeen++;
    } else {
      out[sc.id] = true;
    }
  }
  return out;
}
