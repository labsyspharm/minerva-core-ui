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

export function activeGroupRowForSource(
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

/**
 * Default visibility map for a new import: first `DEFAULT_VISIBLE_INTENSITY_CHANNELS`
 * intensity channels on, masks on, rest off. Existing entries in `prev` win so
 * user toggles survive a re-import / append.
 */
export function defaultVisibilitiesForSources(
  sourceChannels: Channel[],
  prev: Record<string, boolean> = {},
  channelGroups: ChannelGroup[] = [],
): Record<string, boolean> {
  const sourceIds = new Set(sourceChannels.map((sc) => sc.id));
  const hasDocumentGroups = channelGroups.length > 0;
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

  const shouldPreserveExisting =
    hasHiddenSource ||
    (!hasDocumentGroups &&
      visibleIntensityCount <= DEFAULT_VISIBLE_INTENSITY_CHANNELS);

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
      if (hasDocumentGroups) {
        out[sc.id] = false;
        continue;
      }
      const shouldShow = intensitySeen < DEFAULT_VISIBLE_INTENSITY_CHANNELS;
      out[sc.id] = shouldShow;
      if (shouldShow) intensitySeen++;
    } else {
      out[sc.id] = true;
    }
  }
  return out;
}
