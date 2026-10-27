import {
  applyVisibilityTransition,
  buildCompositedIntensityLayers,
} from "@/lib/imaging/channelCompositor";
import { isImageChannel } from "@/lib/imaging/channelKind";
import {
  effectiveDisplayColor,
  effectiveSourceColor,
  effectiveSourceLimits,
} from "@/lib/imaging/sourceChannelStyle";
import type { ChannelRendering } from "@/lib/stores/appStore";
import type {
  ChannelGroup,
  Channel as SourceChannel,
} from "@/lib/stores/documentSchema";

/** kiln-render composites at most six channels per volume. */
export const MAX_VOLUME_CHANNELS = 6;

/** One displayed channel of a volume, in the same terms as a Viv layer. */
export type VolumeChannelLayer = {
  channelId: string;
  /** Source channel index in the file (Imaris `Channel N`). */
  sourceIndex: number;
  /** sRGB 0…255 */
  color: [number, number, number];
  /** Contrast limits in raw file units. */
  limits: [number, number];
};

type VolumeChannelInputs = {
  imageId: string;
  sourceChannels: SourceChannel[];
  channelGroups: ChannelGroup[];
  activeChannelGroupId: string | null;
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities: Record<string, boolean>;
  /** Live slider / color-picker preview, as for the 2D viewer. */
  channelRendering?: ChannelRendering | null;
};

/**
 * Channels the volume should show, using the same group / visibility rules
 * as the 2D viewer (`toSettings` in viv.ts), capped at six with the active
 * group's channels first.
 */
export function volumeChannelLayers(
  inputs: VolumeChannelInputs,
): VolumeChannelLayer[] {
  const {
    imageId,
    sourceChannels,
    channelGroups,
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
    channelRendering,
  } = inputs;
  const onImage = sourceChannels.filter(
    (sc) => sc.imageId === imageId && isImageChannel(sc),
  );
  const activeGroup = activeChannelGroupId
    ? channelGroups.find((g) => g.id === activeChannelGroupId)
    : undefined;
  const filled = applyVisibilityTransition(
    sourceChannels,
    channelGroups,
    channelVisibilities,
    channelGroupRowVisibilities,
    Object.keys(channelVisibilities).length === 0
      ? { kind: "fresh" }
      : { kind: "sync" },
  );
  const composited = buildCompositedIntensityLayers({
    onLoader: onImage,
    activeGroup,
    channelGroups,
    stackVisibilities: filled.channelVisibilities,
    groupRowVisibilities: filled.channelGroupRowVisibilities,
    hasVisibilityMap: true,
  });
  // Over the cap, the active group's channels win (2D shows up to ten).
  const inActive = new Set(activeGroup?.channels.map((r) => r.channelId) ?? []);
  const ranked = [
    ...composited.filter(({ sc }) => inActive.has(sc.id)),
    ...composited.filter(({ sc }) => !inActive.has(sc.id)),
  ];
  return ranked.slice(0, MAX_VOLUME_CHANNELS).map(({ sc, gc }) => {
    let limits: [number, number] = gc
      ? [gc.lowerLimit, gc.upperLimit]
      : effectiveSourceLimits(sc);
    const c = gc
      ? effectiveDisplayColor(sc, sourceChannels, gc)
      : effectiveSourceColor(sc, sourceChannels);
    let color: [number, number, number] = [c.r, c.g, c.b];
    if (channelRendering?.sourceChannelId === sc.id) {
      if (channelRendering.kind === "contrast") {
        limits = [channelRendering.lower, channelRendering.upper];
      } else {
        color = [channelRendering.r, channelRendering.g, channelRendering.b];
      }
    }
    return { channelId: sc.id, sourceIndex: sc.index, color, limits };
  });
}

/**
 * Raw contrast limits → kiln window (centre / width as fractions of the
 * channel's normalisation range, which is how bricks are stored).
 */
export function limitsToWindow(
  limits: [number, number],
  range: [number, number],
): { center: number; width: number } {
  const span = range[1] - range[0];
  if (!(span > 0)) return { center: 0.5, width: 1 };
  const lo = Math.min(limits[0], limits[1]);
  const hi = Math.max(limits[0], limits[1]);
  return {
    center: ((lo + hi) / 2 - range[0]) / span,
    width: Math.max(1e-4, (hi - lo) / span),
  };
}

/**
 * Source channels to stream. Keeps the loaded set when it already covers
 * what is shown (switching groups within it costs nothing); otherwise the
 * wanted channels in display order.
 */
export function channelsToLoad(
  wanted: readonly number[],
  loaded: readonly number[] | null,
): number[] {
  if (loaded && wanted.every((c) => loaded.includes(c))) return [...loaded];
  const unique = [...new Set(wanted)].slice(0, MAX_VOLUME_CHANNELS);
  return unique.length > 0 ? unique : [0];
}
