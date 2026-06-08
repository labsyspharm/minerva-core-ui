import type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
} from "@/lib/stores/documentStore";
import { DEFAULT_VISIBLE_INTENSITY_CHANNELS } from "./channelKind";

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

type CompositedLayersArgs = {
  onLoader: Channel[];
  activeGroup: ChannelGroup | undefined;
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
  hasVisibilityMap: boolean;
};

/** Intensity layers sent to Viv (one OME channel per source; stack style wins over group). */
export function buildCompositedIntensityLayers(
  args: CompositedLayersArgs,
): CompositedIntensityLayer[] {
  const {
    onLoader,
    activeGroup,
    stackVisibilities,
    groupRowVisibilities,
    hasVisibilityMap,
  } = args;

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
    const stackOn =
      !hasVisibilityMap || isStackVisible(stackVisibilities, sc.id);
    if (!rowOn && !stackOn) continue;
    if (rowOn) ordered.push({ sc, gc });
    if (stackOn) ordered.push({ sc, gc: null });
  }

  for (const sc of onLoader) {
    const inGroup = activeGroup.channels.some((gc) => gc.channelId === sc.id);
    if (inGroup) continue;
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
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
}): boolean {
  const { sc, activeGroup, stackVisibilities, groupRowVisibilities } = args;
  const stackOn = isStackVisible(stackVisibilities, sc.id);
  if (!activeGroup) return stackOn;
  const rows = activeGroup.channels.filter((gc) => gc.channelId === sc.id);
  if (rows.length === 0) return stackOn;
  const rowOn = rows.some((gc) =>
    isGroupRowVisible(groupRowVisibilities, gc.id),
  );
  return rowOn || stackOn;
}
