/**
 * Color tools for the Images tab: per-group color locks, Optimize colors
 * (recolor a group's unlocked channels so they stay distinct) and Fit
 * contrast (re-fit one channel's automatic contrast). Locks and busy state
 * are session-only; a fit's busy state is the GMM scheduler's own.
 */
import { useSyncExternalStore } from "react";
import {
  isGmmEligible,
  isImageChannel,
  isRgbDisplayChannel,
} from "@/lib/imaging/channelKind";
import {
  getGmmPendingIds,
  refitGmm,
  subscribeGmmFit,
} from "@/lib/imaging/gmmScheduler";
import {
  applyOptimizedColorsToChannelGroup,
  isGroupEligibleForPsudoOptimize,
  optimizeChannelGroupWithLocks,
  setStackPalettePendingMany,
} from "@/lib/imaging/psudoPalette";
import { useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { applySourceChannelRange } from "@/lib/stores/storeUtils";

type ToolState = {
  /** Locked row ids, per group. */
  locks: ReadonlyMap<string, ReadonlySet<string>>;
  /** Groups being recolored. */
  optimizing: ReadonlySet<string>;
};

let tools: ToolState = {
  locks: new Map(),
  optimizing: new Set(),
};
const listeners = new Set<() => void>();

function update(patch: Partial<ToolState>) {
  tools = { ...tools, ...patch };
  for (const l of listeners) l();
}

function withId(set: ReadonlySet<string>, id: string, on: boolean) {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export function useColorTools(): ToolState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => tools,
    () => tools,
  );
}

const NO_LOCKS: ReadonlySet<string> = new Set();

/** A group's locked rows (rows since removed drop out). */
export function lockedRows(group: ChannelGroup): ReadonlySet<string> {
  const set = tools.locks.get(group.id);
  if (!set) return NO_LOCKS;
  return new Set(group.channels.map((gc) => gc.id).filter((id) => set.has(id)));
}

export function toggleLock(groupId: string, rowId: string) {
  const locks = new Map(tools.locks);
  const set = withId(
    locks.get(groupId) ?? NO_LOCKS,
    rowId,
    !locks.get(groupId)?.has(rowId),
  );
  if (set.size) locks.set(groupId, set);
  else locks.delete(groupId);
  update({ locks });
}

function sourceChannels(): Channel[] {
  return flattenImageChannelsInDocumentOrder(
    useDocumentStore.getState().images,
  );
}

/** Image channels whose swatches wait on the optimizer (not locked, not H&E or masks). */
function pendingIds(
  group: ChannelGroup,
  channels: Channel[],
  locked: ReadonlySet<string>,
): string[] {
  return group.channels.flatMap((gc) => {
    if (locked.has(gc.id)) return [];
    const sc = findSourceChannel(channels, gc.channelId);
    return sc &&
      isImageChannel(sc) &&
      sc.samples !== 3 &&
      !isRgbDisplayChannel(sc, channels)
      ? [sc.id]
      : [];
  });
}

/**
 * Recolor a group's channels so they stay distinct, keeping `locked` rows
 * (default: the group's locks) as they are. One undo step.
 */
export async function optimizeGroupColors(
  groupId: string,
  locked?: ReadonlySet<string>,
) {
  if (tools.optimizing.has(groupId)) return;
  const group = useDocumentStore
    .getState()
    .channelGroups.find((g) => g.id === groupId);
  const channels = sourceChannels();
  if (!group || !isGroupEligibleForPsudoOptimize(group, channels)) return;
  const keep = locked ?? lockedRows(group);
  const pending = pendingIds(group, channels, keep);
  update({ optimizing: withId(tools.optimizing, groupId, true) });
  setStackPalettePendingMany(pending, true);
  useAppStore.getState().clearChannelRendering();
  try {
    const colors = await optimizeChannelGroupWithLocks(group, channels, keep);
    const doc = useDocumentStore.getState();
    doc.setChannelGroups(
      applyOptimizedColorsToChannelGroup(doc.channelGroups, groupId, colors, {
        lockedChannelRowIds: keep,
      }),
    );
  } catch {
    // Colors stay as they were.
  } finally {
    setStackPalettePendingMany(pending, false);
    update({ optimizing: withId(tools.optimizing, groupId, false) });
  }
}

/** Contrast can be fit where the GMM fit applies (intensity, not 8-bit or H&E). */
export function canFitContrast(sourceId: string, channels: Channel[]): boolean {
  const sc = findSourceChannel(channels, sourceId);
  return Boolean(sc && isGmmEligible(sc, channels));
}

/** Whether a contrast fit for this channel is running (any caller's). */
export function useFitting(sourceId: string): boolean {
  return useSyncExternalStore(subscribeGmmFit, getGmmPendingIds).includes(
    sourceId,
  );
}

/**
 * Re-fit a channel's automatic contrast and apply it to the style being
 * edited: the row `rowId`, or (none) the channel's own style.
 */
export async function fitContrast(sourceId: string, rowId?: string) {
  if (getGmmPendingIds().includes(sourceId)) return;
  if (!canFitContrast(sourceId, sourceChannels())) return;
  useAppStore.getState().clearChannelRendering();
  try {
    const limits = await refitGmm(sourceId);
    if (!limits) return;
    const doc = useDocumentStore.getState();
    if (rowId) {
      doc.setChannelGroups(
        doc.channelGroups.map((g) => ({
          ...g,
          channels: g.channels.map((gc) =>
            gc.id === rowId
              ? { ...gc, lowerLimit: limits.lower, upperLimit: limits.upper }
              : gc,
          ),
        })),
      );
    } else {
      doc.setImages(
        applySourceChannelRange(
          doc.images,
          sourceId,
          limits.lower,
          limits.upper,
        ),
      );
    }
  } catch {
    // Contrast stays as it was.
  }
}
