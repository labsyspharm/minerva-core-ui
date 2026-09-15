import type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
} from "@/lib/stores/documentStore";
import {
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isMaskChannel,
  isRgbDisplaySource,
} from "./channelKind";
import { SELECTION_MASK_CHANNEL_KEY } from "./maskLayers";

/** Stack (All Channels) eye — layer overlay for ungrouped channels. */
export function isStackVisible(
  stackVisibilities: Record<string, boolean>,
  sourceChannelId: string,
): boolean {
  return stackVisibilities[sourceChannelId] !== false;
}

/** Per group-row eye. */
export function isGroupRowVisible(
  groupRowVisibilities: Record<string, boolean>,
  rowId: string,
): boolean {
  return groupRowVisibilities[rowId] !== false;
}

export type CompositedIntensityLayer = {
  sc: Channel;
  /** When set, use group row color/limits; when null, use source (stack overlay). */
  gc: ChannelGroupChannel | null;
};

/** True when any group-row eye for this source is on. */
export function isDisplayedViaGroupRow(
  sourceId: string,
  channelGroups: readonly ChannelGroup[],
  groupRowVisibilities: Record<string, boolean>,
): boolean {
  return channelGroups.some((g) =>
    g.channels.some(
      (gc) =>
        gc.channelId === sourceId &&
        isGroupRowVisible(groupRowVisibilities, gc.id),
    ),
  );
}

type CompositedLayersArgs = {
  onLoader: Channel[];
  activeGroup: ChannelGroup | undefined;
  channelGroups?: ChannelGroup[];
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
  hasVisibilityMap: boolean;
  requireColor?: boolean;
};

function sourceIdsInAnyGroup(channelGroups: ChannelGroup[]): Set<string> {
  return new Set(
    channelGroups.flatMap((g) => g.channels.map((gc) => gc.channelId)),
  );
}

export function sourceChannelInAnyGroup(
  channelGroups: ChannelGroup[],
  sourceId: string,
): boolean {
  return sourceIdsInAnyGroup(channelGroups).has(sourceId);
}

/** RGB / H&E already in a group — All Channels is the same catalog twice. */
export function isRgbDisplayFullyGrouped(
  channels: readonly Channel[],
  channelGroups: ChannelGroup[],
): boolean {
  const intensity = channels.filter(isImageChannel);
  if (intensity.length === 0 || !isRgbDisplaySource(channels)) return false;
  const groupedIds = sourceIdsInAnyGroup(channelGroups);
  return intensity.every((c) => groupedIds.has(c.id));
}

/** Flip every RGB / H&E plane together (stack eyes and group-row eyes). */
export function visibilitiesForRgbUnit(args: {
  rgbChannels: readonly Channel[];
  channelGroups: readonly ChannelGroup[];
  groupRowVisibilities: Record<string, boolean>;
  stackVisibilities: Record<string, boolean>;
  visible: boolean;
}): {
  channelGroupRowVisibilities: Record<string, boolean>;
  channelVisibilities: Record<string, boolean>;
} {
  const ids = new Set(args.rgbChannels.filter(isImageChannel).map((c) => c.id));
  const channelGroupRowVisibilities = { ...args.groupRowVisibilities };
  for (const group of args.channelGroups) {
    for (const gc of group.channels) {
      if (ids.has(gc.channelId)) {
        channelGroupRowVisibilities[gc.id] = args.visible;
      }
    }
  }
  const channelVisibilities = { ...args.stackVisibilities };
  for (const id of ids) channelVisibilities[id] = args.visible;
  return { channelGroupRowVisibilities, channelVisibilities };
}

/** Intensity layers sent to Viv (one OME channel per source; first visible group row wins, active group first). */
export function buildCompositedIntensityLayers(
  args: CompositedLayersArgs,
): CompositedIntensityLayer[] {
  const {
    onLoader,
    activeGroup,
    channelGroups = [],
    stackVisibilities,
    groupRowVisibilities,
    hasVisibilityMap,
    requireColor = true,
  } = args;

  const groupedIds = sourceIdsInAnyGroup(channelGroups);
  const rgbSource = isRgbDisplaySource(onLoader);

  if (rgbSource) {
    const intensity = onLoader.filter(isImageChannel);
    const unitOn = intensity.every((sc) =>
      groupedIds.has(sc.id)
        ? isDisplayedViaGroupRow(sc.id, channelGroups, groupRowVisibilities)
        : !hasVisibilityMap || isStackVisible(stackVisibilities, sc.id),
    );
    if (!unitOn) return [];
    const groupsInOrder = activeGroup
      ? [activeGroup, ...channelGroups.filter((g) => g.id !== activeGroup.id)]
      : channelGroups;
    return intensity.map((sc) => {
      let gc: ChannelGroupChannel | null = null;
      for (const group of groupsInOrder) {
        const row = group.channels.find(
          (r) =>
            r.channelId === sc.id &&
            isGroupRowVisible(groupRowVisibilities, r.id),
        );
        if (row) {
          gc = row;
          break;
        }
      }
      return { sc, gc };
    });
  }

  if (channelGroups.length === 0) {
    const layers = hasVisibilityMap
      ? onLoader.filter((sc) => isStackVisible(stackVisibilities, sc.id))
      : onLoader.slice(0, DEFAULT_VISIBLE_INTENSITY_CHANNELS);
    return layers
      .filter((sc) => !(requireColor && sc.samples !== 3 && !sc.color))
      .map((sc) => ({ sc, gc: null }));
  }

  const ordered: CompositedIntensityLayer[] = [];
  const usedSourceIds = new Set<string>();
  const groupsInOrder = activeGroup
    ? [activeGroup, ...channelGroups.filter((g) => g.id !== activeGroup.id)]
    : channelGroups;

  for (const group of groupsInOrder) {
    for (const gc of group.channels) {
      if (!isGroupRowVisible(groupRowVisibilities, gc.id)) continue;
      const sc = onLoader.find((c) => c.id === gc.channelId);
      if (!sc || usedSourceIds.has(sc.id)) continue;
      usedSourceIds.add(sc.id);
      ordered.push({ sc, gc });
    }
  }

  for (const sc of onLoader) {
    if (groupedIds.has(sc.id) || usedSourceIds.has(sc.id)) continue;
    if (!hasVisibilityMap || !isStackVisible(stackVisibilities, sc.id)) {
      continue;
    }
    if (requireColor && !rgbSource && sc.samples !== 3 && !sc.color) continue;
    usedSourceIds.add(sc.id);
    ordered.push({ sc, gc: null });
  }

  return ordered;
}

export function isMaskSourceRendered(args: {
  sc: Channel;
  channelGroups?: ChannelGroup[];
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
}): boolean {
  const {
    sc,
    channelGroups = [],
    stackVisibilities,
    groupRowVisibilities,
  } = args;
  return (
    isDisplayedViaGroupRow(sc.id, channelGroups, groupRowVisibilities) ||
    (!sourceChannelInAnyGroup(channelGroups, sc.id) &&
      isStackVisible(stackVisibilities, sc.id))
  );
}

export type VisibilityTransition =
  | { kind: "fresh" }
  | { kind: "appendMask"; newChannelIds: readonly string[] }
  | {
      kind: "appendIntensity";
      newChannelIds: readonly string[];
      newGroupRowIds: readonly string[];
    }
  | { kind: "remove" }
  | { kind: "sync" };

export function diffChannelIds(
  before: readonly Channel[],
  after: readonly Channel[],
): string[] {
  const beforeIds = new Set(before.map((sc) => sc.id));
  return after.filter((sc) => !beforeIds.has(sc.id)).map((sc) => sc.id);
}

export function diffGroupRowIds(
  before: readonly ChannelGroup[],
  after: readonly ChannelGroup[],
): string[] {
  const beforeIds = new Set(
    before.flatMap((g) => g.channels.map((gc) => gc.id)),
  );
  return after
    .flatMap((g) => g.channels.map((gc) => gc.id))
    .filter((id) => !beforeIds.has(id));
}

function preservedStackVisibilities(
  sourceChannels: Channel[],
  prev: Record<string, boolean>,
  preserveSelectionMask = false,
): Record<string, boolean> {
  const sourceIds = new Set(sourceChannels.map((sc) => sc.id));
  const out: Record<string, boolean> = {};
  for (const [key, visible] of Object.entries(prev)) {
    if (
      sourceIds.has(key) ||
      (preserveSelectionMask && key === SELECTION_MASK_CHANNEL_KEY)
    ) {
      out[key] = visible;
    }
  }
  return out;
}

function freshStackDefaults(
  sourceChannels: Channel[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  let intensitySeen = 0;
  for (const sc of sourceChannels) {
    if (isMaskChannel(sc)) {
      out[sc.id] = true;
      continue;
    }
    if (isImageChannel(sc)) {
      const show = intensitySeen < DEFAULT_VISIBLE_INTENSITY_CHANNELS;
      out[sc.id] = show;
      if (show) intensitySeen++;
      continue;
    }
    out[sc.id] = true;
  }
  return out;
}

/** Apply explicit stack (All Channels) visibility for import / remove / sync. */
export function applyStackVisibilities(
  sourceChannels: Channel[],
  prev: Record<string, boolean>,
  transition: VisibilityTransition,
): Record<string, boolean> {
  switch (transition.kind) {
    case "fresh":
      return freshStackDefaults(sourceChannels);
    case "remove":
      return preservedStackVisibilities(sourceChannels, prev);
    case "appendMask": {
      const out = preservedStackVisibilities(sourceChannels, prev, true);
      const newIds = new Set(transition.newChannelIds);
      for (const sc of sourceChannels) {
        if (newIds.has(sc.id) && isMaskChannel(sc)) out[sc.id] = true;
      }
      return out;
    }
    case "appendIntensity": {
      const out = preservedStackVisibilities(sourceChannels, prev, true);
      const newIds = new Set(transition.newChannelIds);
      for (const sc of sourceChannels) {
        if (newIds.has(sc.id)) out[sc.id] = false;
      }
      return out;
    }
    case "sync": {
      // Visibility is session-only. A restored document can inherit a non-empty
      // map containing only ids from the previously open story.
      if (!sourceChannels.some((sc) => prev[sc.id] !== undefined)) {
        return freshStackDefaults(sourceChannels);
      }
      const out = preservedStackVisibilities(sourceChannels, prev, true);
      for (const sc of sourceChannels) {
        if (out[sc.id] !== undefined) continue;
        out[sc.id] = isMaskChannel(sc);
      }
      return out;
    }
  }
}

/** Apply explicit group-row visibility for import / remove / sync. */
export function applyGroupRowVisibilities(
  channelGroups: ChannelGroup[],
  prev: Record<string, boolean>,
  transition: VisibilityTransition,
  stackVisibilities?: Record<string, boolean>,
): Record<string, boolean> {
  const rowIds = new Set(
    channelGroups.flatMap((g) => g.channels.map((gc) => gc.id)),
  );

  if (transition.kind === "remove") {
    const out: Record<string, boolean> = {};
    for (const [id, visible] of Object.entries(prev)) {
      if (rowIds.has(id)) out[id] = visible;
    }
    return out;
  }

  const out: Record<string, boolean> = {};
  if (transition.kind !== "fresh") {
    for (const [id, visible] of Object.entries(prev)) {
      if (rowIds.has(id)) out[id] = visible;
    }
  }

  const newRowIds =
    transition.kind === "appendIntensity"
      ? new Set(transition.newGroupRowIds)
      : null;

  for (const group of channelGroups) {
    for (const gc of group.channels) {
      if (out[gc.id] !== undefined) continue;
      if (transition.kind === "fresh") {
        out[gc.id] = stackVisibilities?.[gc.channelId] ?? false;
      } else if (newRowIds?.has(gc.id)) {
        out[gc.id] = false;
      } else {
        out[gc.id] = true;
      }
    }
  }
  return out;
}

export function applyVisibilityTransition(
  sourceChannels: Channel[],
  channelGroups: ChannelGroup[],
  stackVisibilities: Record<string, boolean>,
  groupRowVisibilities: Record<string, boolean>,
  transition: VisibilityTransition,
) {
  const channelVisibilities = applyStackVisibilities(
    sourceChannels,
    stackVisibilities,
    transition,
  );
  return {
    channelVisibilities,
    channelGroupRowVisibilities: applyGroupRowVisibilities(
      channelGroups,
      groupRowVisibilities,
      transition,
      channelVisibilities,
    ),
  };
}
