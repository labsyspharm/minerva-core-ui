import type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
} from "@/lib/stores/documentStore";
import {
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isMaskChannel,
} from "./channelKind";
import { SELECTION_MASK_CHANNEL_KEY } from "./maskLayers";

/** Stack (All Channels) eye — layer overlay on the active group composite. */
export function isStackVisible(
  stackVisibilities: Record<string, boolean>,
  sourceChannelId: string,
): boolean {
  return stackVisibilities[sourceChannelId] !== false;
}

/** Per group-row eye — member of the active group look. */
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

/** Sort key for All Channels: stack-on or on in the active group (top of list). */
export function isShownFirstInAllChannelsList(
  sc: Channel,
  stackVisibilities: Record<string, boolean>,
  activeGroup: ChannelGroup | undefined,
  groupRowVisibilities: Record<string, boolean>,
): boolean {
  if (isStackVisible(stackVisibilities, sc.id)) return true;
  if (!activeGroup) return false;
  return activeGroup.channels.some(
    (gc) =>
      gc.channelId === sc.id && isGroupRowVisible(groupRowVisibilities, gc.id),
  );
}

function activeGroupRowForSource(
  activeGroup: ChannelGroup | undefined,
  sourceId: string,
): ChannelGroupChannel | undefined {
  return activeGroup?.channels.find((gc) => gc.channelId === sourceId);
}

/** True when the active group row eye is on for this source channel. */
export function isDisplayedViaActiveGroup(
  sourceId: string,
  activeGroup: ChannelGroup | undefined,
  groupRowVisibilities: Record<string, boolean>,
): boolean {
  const row = activeGroupRowForSource(activeGroup, sourceId);
  return row != null && isGroupRowVisible(groupRowVisibilities, row.id);
}

type CompositedLayersArgs = {
  onLoader: Channel[];
  activeGroup: ChannelGroup | undefined;
  channelGroups?: ChannelGroup[];
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
  hasVisibilityMap: boolean;
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

function isUngroupedStackVisible(
  sourceId: string,
  groupedIds: Set<string>,
  stackVisibilities: Record<string, boolean>,
  hasVisibilityMap: boolean,
): boolean {
  if (groupedIds.has(sourceId)) return false;
  return !hasVisibilityMap || isStackVisible(stackVisibilities, sourceId);
}

/** Intensity layers sent to Viv (one OME channel per source; stack style wins over group). */
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
  } = args;

  const groupedIds = sourceIdsInAnyGroup(channelGroups);

  if (!activeGroup) {
    const layers = hasVisibilityMap
      ? onLoader.filter((sc) => isStackVisible(stackVisibilities, sc.id))
      : onLoader.slice(0, DEFAULT_VISIBLE_INTENSITY_CHANNELS);
    return layers.map((sc) => ({ sc, gc: null }));
  }

  const ordered: CompositedIntensityLayer[] = [];

  for (const gc of activeGroup.channels) {
    const sc = onLoader.find((c) => c.id === gc.channelId);
    if (!sc) continue;
    const rowOn = isGroupRowVisible(groupRowVisibilities, gc.id);
    // Group members render via row styling only — stack overlay is for ungrouped channels.
    const stackOn = isUngroupedStackVisible(
      sc.id,
      groupedIds,
      stackVisibilities,
      hasVisibilityMap,
    );
    if (!rowOn && !stackOn) continue;
    if (rowOn) ordered.push({ sc, gc });
    else if (stackOn) ordered.push({ sc, gc: null });
  }

  for (const sc of onLoader) {
    if (groupedIds.has(sc.id)) continue;
    const inActiveGroup = activeGroup.channels.some(
      (gc) => gc.channelId === sc.id,
    );
    if (inActiveGroup) continue;
    if (hasVisibilityMap && !isStackVisible(stackVisibilities, sc.id)) {
      continue;
    }
    if (!hasVisibilityMap) continue;
    ordered.push({ sc, gc: null });
  }

  return ordered;
}

export function isMaskSourceRendered(args: {
  sc: Channel;
  activeGroup: ChannelGroup | undefined;
  channelGroups?: ChannelGroup[];
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
}): boolean {
  const {
    sc,
    activeGroup,
    channelGroups = [],
    stackVisibilities,
    groupRowVisibilities,
  } = args;
  const groupedIds = sourceIdsInAnyGroup(channelGroups);
  const stackOn = isUngroupedStackVisible(
    sc.id,
    groupedIds,
    stackVisibilities,
    true,
  );
  if (!activeGroup) return isStackVisible(stackVisibilities, sc.id);
  const rows = activeGroup.channels.filter((gc) => gc.channelId === sc.id);
  if (rows.length === 0) return stackOn;
  const rowOn = rows.some((gc) =>
    isGroupRowVisible(groupRowVisibilities, gc.id),
  );
  return rowOn || stackOn;
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
      const out = preservedStackVisibilities(sourceChannels, prev, true);
      let intensitySeen = sourceChannels.filter(
        (sc) => isImageChannel(sc) && out[sc.id] === true,
      ).length;
      for (const sc of sourceChannels) {
        if (out[sc.id] !== undefined) continue;
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

/**
 * @deprecated Use {@link applyStackVisibilities} with an explicit transition.
 * Kept for UI fallbacks when no visibility map exists yet.
 */
export function defaultVisibilitiesForSources(
  sourceChannels: Channel[],
  prev: Record<string, boolean> = {},
  _channelGroups: ChannelGroup[] = [],
): Record<string, boolean> {
  void _channelGroups;
  if (Object.keys(prev).length === 0) {
    return applyStackVisibilities(sourceChannels, prev, { kind: "fresh" });
  }
  return applyStackVisibilities(sourceChannels, prev, { kind: "sync" });
}

/** Source channel ids composited on first paint (matches viewer layer build). */
export function initialPaintSourceChannelIds(args: {
  sourceChannels: Channel[];
  channelGroups?: ChannelGroup[];
  stackVisibilities?: Record<string, boolean>;
  groupRowVisibilities?: Record<string, boolean>;
  activeGroupId?: string | null;
}): Set<string> {
  const channelGroups = args.channelGroups ?? [];
  const stackVisibilities =
    args.stackVisibilities ??
    defaultVisibilitiesForSources(args.sourceChannels, {}, channelGroups);
  const onLoader = args.sourceChannels.filter(isImageChannel);
  const activeGroup =
    channelGroups.length === 0
      ? undefined
      : (channelGroups.find((g) => g.id === args.activeGroupId) ??
        channelGroups[0]);
  const layers = buildCompositedIntensityLayers({
    onLoader,
    activeGroup,
    channelGroups,
    stackVisibilities,
    groupRowVisibilities: args.groupRowVisibilities ?? {},
    hasVisibilityMap: true,
  });
  return new Set(layers.map((l) => l.sc.id));
}
