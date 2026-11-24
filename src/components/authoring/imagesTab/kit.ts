/**
 * Channel state and actions for the author Images tab. It reads channel state
 * through {@link useChannelState} and changes it through
 * {@link channelActions}, so visibility, the 10-channel cap, H&E units and
 * group membership match the viewer and the legend.
 *
 * Visibility is session-only; what a story saves is group membership and
 * each row's style. A waypoint shows its whole group (`showGroup`).
 */
import * as React from "react";
import {
  applyGroupRowVisibilities,
  isGroupRowVisible,
  isMaskSourceRendered,
  isOwnStyleShown,
  isStackVisible,
  ownStyleKey,
  paintedIntensityLayers,
  type VivIntensityCapVis,
  viewerFilledVisibilities,
  visibilitiesForRgbUnit,
  vivIntensityCapExceeded,
  withGroupRowVisible,
} from "@/lib/imaging/channelCompositor";
import {
  isImageChannel,
  isMaskChannel,
  isRgbDisplaySource,
} from "@/lib/imaging/channelKind";
import { awaitGroupRowFits } from "@/lib/imaging/gmmScheduler";
import { makeGroupChannelRow } from "@/lib/imaging/groupRows";
import type { ImageChannelChip } from "@/lib/imaging/imageChannelOverview";
import { assignOwnStyleColor } from "@/lib/imaging/psudoPalette";
import { assignedDisplayHex } from "@/lib/imaging/sourceChannelStyle";
import { type ChannelRendering, useAppStore } from "@/lib/stores/appStore";
import type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
  Image,
} from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import {
  patchSourceChannelOnImages,
  uniqueImageDisplayLabels,
} from "@/lib/stores/storeUtils";
import { optimizeGroupColors } from "./colorTools";

/** Hex used for an H&E / packed-RGB unit (matches the chips and legend). */
export { RGB_UNIT_CHIP_HEX } from "@/components/shared/channel/ChannelChip";

type Membership = { group: ChannelGroup; row: ChannelGroupChannel };

export type ChannelState = {
  images: Image[];
  groups: ChannelGroup[];
  /** Every image's channels in document order, each with `imageId`. */
  sourceChannels: Channel[];
  activeGroupId: string | null;
  activeGroup: ChannelGroup | undefined;
  /** Filled with the viewer's rule, so "visible" here means what the viewer means. */
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
  /** Sources the viewer draws right now (≤10 intensity per image, rendered masks). */
  paintedIds: ReadonlySet<string>;
  /** Short, de-duplicated image names (no extension). */
  imageLabels: ReadonlyMap<string, string>;
  /** The in-flight color/contrast drag, for swatches (see `displayHex`). */
  channelRendering: ChannelRendering | null;
};

type Vis = {
  stack: Record<string, boolean>;
  rows: Record<string, boolean>;
};

function buildState(args: {
  images: Image[];
  groups: ChannelGroup[];
  activeGroupId: string | null;
  stack: Record<string, boolean>;
  rows: Record<string, boolean>;
  channelRendering: ChannelRendering | null;
}): ChannelState {
  const sourceChannels = flattenImageChannelsInDocumentOrder(args.images);
  const filled = viewerFilledVisibilities(
    sourceChannels,
    args.groups,
    args.stack,
    args.rows,
  );
  const activeGroup = args.activeGroupId
    ? args.groups.find((g) => g.id === args.activeGroupId)
    : undefined;
  const capVis: VivIntensityCapVis = {
    channels: sourceChannels,
    activeGroup,
    channelGroups: args.groups,
    stackVisibilities: filled.channelVisibilities,
    groupRowVisibilities: filled.channelGroupRowVisibilities,
  };
  const painted = new Set<string>();
  for (const im of args.images) {
    for (const layer of paintedIntensityLayers(im.id, capVis)) {
      painted.add(layer.sc.id);
    }
  }
  for (const sc of sourceChannels) {
    if (
      isMaskChannel(sc) &&
      isMaskSourceRendered({
        sc,
        channelGroups: args.groups,
        stackVisibilities: filled.channelVisibilities,
        groupRowVisibilities: filled.channelGroupRowVisibilities,
      })
    ) {
      painted.add(sc.id);
    }
  }
  return {
    images: args.images,
    groups: args.groups,
    sourceChannels,
    activeGroupId: args.activeGroupId,
    activeGroup,
    stackVisibilities: filled.channelVisibilities,
    groupRowVisibilities: filled.channelGroupRowVisibilities,
    paintedIds: painted,
    imageLabels: uniqueImageDisplayLabels(args.images),
    channelRendering: args.channelRendering,
  };
}

/** Channel state for rendering; re-renders on any image, group or visibility change. */
export function useChannelState(): ChannelState {
  const images = useDocumentStore((s) => s.images);
  const groups = useDocumentStore((s) => s.channelGroups);
  const activeGroupId = useAppStore((s) => s.activeChannelGroupId);
  const stack = useAppStore((s) => s.channelVisibilities);
  const rows = useAppStore((s) => s.channelGroupRowVisibilities);
  // Swatches follow a live color drag only; a contrast drag changes nothing
  // here, so it doesn't rebuild the tab.
  const channelRendering = useAppStore((s) =>
    s.channelRendering?.kind === "color" ? s.channelRendering : null,
  );
  return React.useMemo(
    () =>
      buildState({
        images,
        groups,
        activeGroupId,
        stack,
        rows,
        channelRendering,
      }),
    [images, groups, activeGroupId, stack, rows, channelRendering],
  );
}

/** The same state, read now (for event handlers). */
export function getChannelState(): ChannelState {
  const doc = useDocumentStore.getState();
  const app = useAppStore.getState();
  return buildState({
    images: doc.images,
    groups: doc.channelGroups,
    activeGroupId: app.activeChannelGroupId,
    stack: app.channelVisibilities,
    rows: app.channelGroupRowVisibilities,
    channelRendering: app.channelRendering,
  });
}

// ---------------------------------------------------------------------------
// Pure helpers

export function findChannel(
  state: ChannelState,
  sourceId: string,
): Channel | undefined {
  return findSourceChannel(state.sourceChannels, sourceId);
}

/** Channels of one image, document order. */
export function channelsOfImage(
  state: ChannelState,
  imageId: string,
): Channel[] {
  return state.sourceChannels.filter((sc) => sc.imageId === imageId);
}

/** True for an H&E / brightfield image: its planes act as one unit. */
export function isRgbImage(state: ChannelState, imageId: string): boolean {
  return isRgbDisplaySource(
    channelsOfImage(state, imageId).filter(isImageChannel),
  );
}

export { isImageChannel };

/** Every group row of `sourceId`, in group order. */
function membershipsOf(state: ChannelState, sourceId: string): Membership[] {
  const out: Membership[] = [];
  for (const group of state.groups) {
    const row = group.channels.find((gc) => gc.channelId === sourceId);
    if (row) out.push({ group, row });
  }
  return out;
}

export function rowInGroup(
  group: ChannelGroup | undefined,
  sourceId: string,
): ChannelGroupChannel | undefined {
  return group?.channels.find((gc) => gc.channelId === sourceId);
}

export function isRowVisible(state: ChannelState, rowId: string): boolean {
  return isGroupRowVisible(state.groupRowVisibilities, rowId);
}

/** The membership a toggle acts on: a visible row, else the active group's, else the first. */
function homeMembership(
  state: ChannelState,
  sourceId: string,
): Membership | null {
  const all = membershipsOf(state, sourceId);
  return (
    all.find((m) => isRowVisible(state, m.row.id)) ??
    all.find((m) => m.group.id === state.activeGroupId) ??
    all[0] ??
    null
  );
}

/** On by any route: a visible group row, or in its own style. */
export function isChannelShown(state: ChannelState, sourceId: string): boolean {
  return isShownViaRow(state, sourceId) || isShownOwnStyle(state, sourceId);
}

/** On through some group's visible row. */
export function isShownViaRow(state: ChannelState, sourceId: string): boolean {
  return membershipsOf(state, sourceId).some((m) =>
    isRowVisible(state, m.row.id),
  );
}

/**
 * On in its own style, outside any group: an ungrouped channel by its eye, a
 * grouped one by its own-style mark (see `setChannelShown`).
 */
export function isShownOwnStyle(
  state: ChannelState,
  sourceId: string,
): boolean {
  return membershipsOf(state, sourceId).length > 0
    ? isOwnStyleShown(state.stackVisibilities, sourceId)
    : isStackVisible(state.stackVisibilities, sourceId);
}

/**
 * Drawn in its own style: shown that way and not through a visible row (a row
 * wins, as in the viewer's compositor).
 */
export function isDrawnOwnStyle(
  state: ChannelState,
  sourceId: string,
): boolean {
  return !isShownViaRow(state, sourceId) && isShownOwnStyle(state, sourceId);
}

/** `stack` without the own-style marks of `ids`. */
function withoutOwnStyle(
  stack: Record<string, boolean>,
  ids: Iterable<string>,
): Record<string, boolean> {
  const out = { ...stack };
  for (const id of ids) delete out[ownStyleKey(id)];
  return out;
}

/** Actually drawn by the viewer now. */
export function isChannelPainted(
  state: ChannelState,
  sourceId: string,
): boolean {
  return state.paintedIds.has(sourceId);
}

/**
 * Swatch hex (no `#`) for a channel as seen through `row` (null: its own
 * ungrouped style), including a live drag on that row. Empty when the
 * channel has no color yet.
 */
export function displayHex(
  state: ChannelState,
  sourceId: string,
  row?: ChannelGroupChannel | null,
): string {
  const sc = findChannel(state, sourceId);
  if (!sc) return "";
  return (
    assignedDisplayHex(
      sc,
      state.sourceChannels,
      row ?? null,
      state.channelRendering,
    ) ?? ""
  );
}

/** Hex for the style the viewer draws (or would draw) this channel in. */
export function shownHex(state: ChannelState, sourceId: string): string {
  return displayHex(state, sourceId, homeMembership(state, sourceId)?.row);
}

/**
 * A chip for `ChannelEditor` (the full single-channel editor from
 * `shared/channel/ChannelEditorPopover`): contrast, color, mask display and
 * feature-table classes. With `groupId`, it edits that group's row;
 * without, the row it is drawn through, else its own style.
 */
export function editorChip(
  state: ChannelState,
  sourceId: string,
  groupId?: string | null,
): ImageChannelChip | null {
  const sc = findChannel(state, sourceId);
  if (!sc) return null;
  // Without a group: the row it is drawn through, else its own style (what a
  // tile shows it in).
  const pick = groupId
    ? membershipsOf(state, sourceId).find((m) => m.group.id === groupId)
    : isShownViaRow(state, sourceId)
      ? homeMembership(state, sourceId)
      : null;
  const visible = pick
    ? isRowVisible(state, pick.row.id)
    : isShownOwnStyle(state, sourceId);
  return {
    key: `kit:${pick?.group.id ?? "src"}:${sourceId}`,
    sourceId,
    visible,
    groupId: pick?.group.id ?? null,
    groupRowId: pick?.row.id,
  };
}

/** Would `next` make this image draw more than the viewer allows? */
function exceedsCap(state: ChannelState, imageId: string, next: Vis): boolean {
  return vivIntensityCapExceeded(imageId, {
    channels: state.sourceChannels,
    activeGroup: state.activeGroup,
    channelGroups: state.groups,
    stackVisibilities: next.stack,
    groupRowVisibilities: next.rows,
  });
}

/** Would `next` keep every image these sources are on within the limit? */
function fitsCap(
  state: ChannelState,
  sourceIds: Iterable<string>,
  next: Vis,
): boolean {
  const images = new Set<string>();
  for (const id of sourceIds) {
    const sc = findChannel(state, id);
    if (sc && isImageChannel(sc)) images.add(sc.imageId);
  }
  for (const imageId of images) {
    if (exceedsCap(state, imageId, next)) return false;
  }
  return true;
}

function commitVis(next: Vis) {
  const app = useAppStore.getState();
  app.setChannelGroupRowVisibilities(next.rows);
  app.setChannelVisibilities(next.stack);
}

function commitGroups(nextGroups: ChannelGroup[]) {
  useDocumentStore.getState().setChannelGroups(nextGroups);
  syncRowVisibilities(nextGroups);
}

function syncRowVisibilities(nextGroups: ChannelGroup[]) {
  const app = useAppStore.getState();
  app.setChannelGroupRowVisibilities(
    applyGroupRowVisibilities(
      nextGroups,
      app.channelGroupRowVisibilities,
      { kind: "sync" },
      app.activeChannelGroupId,
    ),
  );
}

/**
 * Commit groups after removing rows. A channel left in no group falls back
 * to its own style: it adopts the color it was drawn in when it has none, and
 * stays shown only if it was shown through one of its rows. Otherwise it
 * could be "on" but undrawn (no color) and still count toward the limit.
 */
function commitGroupsDroppingRows(
  before: ChannelState,
  nextGroups: ChannelGroup[],
) {
  const stillGrouped = new Set(
    nextGroups.flatMap((g) => g.channels.map((gc) => gc.channelId)),
  );
  const orphans = before.sourceChannels.filter(
    (sc) => !stillGrouped.has(sc.id) && membershipsOf(before, sc.id).length > 0,
  );
  const doc = useDocumentStore.getState();
  let images = doc.images;
  for (const sc of orphans) {
    const home = homeMembership(before, sc.id);
    if (!sc.color && home && isImageChannel(sc)) {
      images = patchSourceChannelOnImages(images, sc.id, {
        color: { ...home.row.color },
      });
    }
  }
  // One undo step for both the groups and the adopted colors.
  if (images !== doc.images) doc.setImagesAndChannelGroups(images, nextGroups);
  else doc.setChannelGroups(nextGroups);
  syncRowVisibilities(nextGroups);
  if (orphans.length === 0) return;
  const stack = { ...useAppStore.getState().channelVisibilities };
  for (const sc of orphans) {
    // Shown through a row or in its own style stays shown, now by its eye.
    stack[sc.id] =
      isShownViaRow(before, sc.id) ||
      isOwnStyleShown(before.stackVisibilities, sc.id);
    delete stack[ownStyleKey(sc.id)];
  }
  useAppStore.getState().setChannelVisibilities(stack);
}

/**
 * New rows keep the style the channel is drawn in now: its home row's, or
 * (drawn in its own style) the channel's own, which they start with.
 */
function adoptHomeStyle(state: ChannelState, rows: ChannelGroupChannel[]) {
  for (const row of rows) {
    const home = homeMembership(state, row.channelId);
    if (!home || isDrawnOwnStyle(state, row.channelId)) continue;
    row.color = { ...home.row.color };
    row.lowerLimit = home.row.lowerLimit;
    row.upperLimit = home.row.upperLimit;
    if (home.row.maskVisualization) {
      row.maskVisualization = home.row.maskVisualization;
    }
  }
}

/** Sources that join or leave a group together (all planes of an H&E image). */
function unitSourceIds(state: ChannelState, sourceId: string): string[] {
  const sc = findChannel(state, sourceId);
  if (!sc) return [];
  if (isImageChannel(sc) && isRgbImage(state, sc.imageId)) {
    return channelsOfImage(state, sc.imageId)
      .filter(isImageChannel)
      .map((c) => c.id);
  }
  return [sc.id];
}

// ---------------------------------------------------------------------------
// Actions. Each reads the stores when called, so it is safe in any handler.
// Visibility actions return false when the 10-channel limit blocks them.

/**
 * Would showing this channel pass the limit? Use it to grey out an "on"
 * control before the click (`channelActions.setChannelShown` refuses anyway).
 */
export function canShowChannel(state: ChannelState, sourceId: string): boolean {
  if (isChannelShown(state, sourceId)) return true;
  const next = showChannelVis(state, sourceId);
  return !next || fitsCap(state, unitSourceIds(state, sourceId), next);
}

function showChannelVis(state: ChannelState, sourceId: string): Vis | null {
  const sc = findChannel(state, sourceId);
  if (!sc) return null;
  const vis: Vis = {
    stack: state.stackVisibilities,
    rows: state.groupRowVisibilities,
  };
  const ids = unitSourceIds(state, sourceId);
  const grouped = membershipsOf(state, sourceId).length > 0;
  if (grouped && isImageChannel(sc)) {
    // Its own style, leaving its groups' rows (and colors) alone.
    const stack = { ...vis.stack };
    for (const id of ids) stack[ownStyleKey(id)] = true;
    return { stack, rows: vis.rows };
  }
  if (isImageChannel(sc) && isRgbImage(state, sc.imageId)) {
    const next = visibilitiesForRgbUnit({
      rgbChannels: channelsOfImage(state, sc.imageId),
      channelGroups: state.groups,
      groupRowVisibilities: vis.rows,
      stackVisibilities: vis.stack,
      visible: true,
    });
    return {
      stack: next.channelVisibilities,
      rows: next.channelGroupRowVisibilities,
    };
  }
  const home = homeMembership(state, sourceId);
  if (home) {
    return {
      stack: vis.stack,
      rows: withGroupRowVisible(vis.rows, state.groups, home.row.id, true),
    };
  }
  return { stack: { ...vis.stack, [sourceId]: true }, rows: vis.rows };
}

/** Some row of the group is on (its eye is open). */
export function isGroupShown(
  state: ChannelState,
  group: ChannelGroup,
): boolean {
  return group.channels.some((gc) => isRowVisible(state, gc.id));
}

/**
 * Every row of the group on. A channel's rows in other groups stay as they
 * are (the viewer draws one, the selected group's first), so hiding this
 * group again gives them back.
 */
function groupShownVis(state: ChannelState, group: ChannelGroup): Vis {
  const rows = { ...state.groupRowVisibilities };
  for (const gc of group.channels) rows[gc.id] = true;
  return {
    stack: withoutOwnStyle(
      state.stackVisibilities,
      group.channels.map((gc) => gc.channelId),
    ),
    rows,
  };
}

/** Would showing the whole group pass the limit? (A shown one always can hide.) */
export function canShowGroup(
  state: ChannelState,
  group: ChannelGroup,
): boolean {
  return (
    isGroupShown(state, group) ||
    fitsCap(
      state,
      group.channels.map((gc) => gc.channelId),
      groupShownVis(state, group),
    )
  );
}

export const channelActions = {
  /**
   * Show or hide a channel outside the selected group (the image lists). On:
   * in its own style, full strength, with a color psudo picks to stand apart
   * from what is on screen; a grouped channel's rows and their colors are left
   * alone. Off: every route. H&E images toggle as one unit (and keep their
   * colors). Masks show through their home group row.
   */
  setChannelShown(sourceId: string, shown: boolean): boolean {
    const state = getChannelState();
    const sc = findChannel(state, sourceId);
    if (!sc) return false;
    if (shown) {
      const next = showChannelVis(state, sourceId);
      if (!next || !fitsCap(state, unitSourceIds(state, sourceId), next)) {
        return false;
      }
      commitVis(next);
      if (isImageChannel(sc) && !isRgbImage(state, sc.imageId)) {
        void assignOwnStyleColor(sourceId);
      }
      return true;
    }
    const ids = unitSourceIds(state, sourceId);
    if (isImageChannel(sc) && isRgbImage(state, sc.imageId)) {
      const next = visibilitiesForRgbUnit({
        rgbChannels: channelsOfImage(state, sc.imageId),
        channelGroups: state.groups,
        groupRowVisibilities: state.groupRowVisibilities,
        stackVisibilities: state.stackVisibilities,
        visible: false,
      });
      commitVis({
        stack: withoutOwnStyle(next.channelVisibilities, ids),
        rows: next.channelGroupRowVisibilities,
      });
      return true;
    }
    const rows = { ...state.groupRowVisibilities };
    for (const m of membershipsOf(state, sourceId)) rows[m.row.id] = false;
    commitVis({
      stack: {
        ...withoutOwnStyle(state.stackVisibilities, ids),
        [sourceId]: false,
      },
      rows,
    });
    return true;
  },

  /** Show or hide one group's row of a channel (H&E: all planes in that group). */
  setRowShown(groupId: string, sourceId: string, shown: boolean): boolean {
    const state = getChannelState();
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return false;
    const ids = unitSourceIds(state, sourceId);
    let rows = { ...state.groupRowVisibilities };
    for (const id of ids) {
      const row = rowInGroup(group, id);
      if (!row) continue;
      rows = shown
        ? withGroupRowVisible(rows, state.groups, row.id, true)
        : { ...rows, [row.id]: false };
    }
    // Shown through the row now, not in its own style.
    const next = {
      stack: shown
        ? withoutOwnStyle(state.stackVisibilities, ids)
        : state.stackVisibilities,
      rows,
    };
    if (shown && !fitsCap(state, ids, next)) return false;
    commitVis(next);
    return true;
  },

  /**
   * Show every channel of a group, or hide them all, leaving other groups
   * and which group is selected alone. False when showing would pass the
   * limit.
   */
  setGroupShown(groupId: string, shown: boolean): boolean {
    const state = getChannelState();
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return false;
    if (shown) {
      const next = groupShownVis(state, group);
      const ids = group.channels.map((gc) => gc.channelId);
      if (!fitsCap(state, ids, next)) return false;
      commitVis(next);
      return true;
    }
    const rows = { ...state.groupRowVisibilities };
    for (const gc of group.channels) rows[gc.id] = false;
    commitVis({ stack: state.stackVisibilities, rows });
    return true;
  },

  /*
   * Toggles read the stores when clicked, not what the chip last rendered,
   * so a double-click's two clicks always undo each other.
   */

  /** Flip a channel's row in a group. True when it is now shown. */
  toggleRowShown(groupId: string, sourceId: string): boolean {
    const state = getChannelState();
    const row = rowInGroup(
      state.groups.find((g) => g.id === groupId),
      sourceId,
    );
    if (!row) return false;
    const show = !isRowVisible(state, row.id);
    return channelActions.setRowShown(groupId, sourceId, show) && show;
  },

  /** Flip a channel outside the selected group. True when it is now shown. */
  toggleChannelShown(sourceId: string): boolean {
    const show = !isChannelShown(getChannelState(), sourceId);
    return channelActions.setChannelShown(sourceId, show) && show;
  },

  /** Add a channel to a group, or remove it if it is in it. */
  toggleMembership(groupId: string, sourceId: string) {
    const group = getChannelState().groups.find((g) => g.id === groupId);
    if (rowInGroup(group, sourceId)) {
      channelActions.removeFromGroup(groupId, sourceId);
    } else {
      channelActions.addToGroup(groupId, sourceId);
    }
  },

  /** Rename a channel everywhere (it has one name across groups). */
  renameChannel(sourceId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const doc = useDocumentStore.getState();
    doc.setImages(
      patchSourceChannelOnImages(doc.images, sourceId, { name: trimmed }),
    );
  },

  /** Make a group active and show exactly it, as opening a waypoint does. */
  showGroup(groupId: string) {
    useAppStore.getState().showOnlyChannelGroup(groupId);
  },

  /**
   * Select no group; what is shown stays. Image channels then show and
   * edit their own styles. With `onlyIf`, only while that group is selected
   * (a delayed deselect must not undo a newer pick).
   */
  clearGroup(onlyIf?: string) {
    const app = useAppStore.getState();
    if (onlyIf && app.activeChannelGroupId !== onlyIf) return;
    app.clearActiveChannelGroup();
  },

  /**
   * Add a channel to a group (H&E: every plane of its image). The new row
   * starts in the color and contrast the channel is drawn in; a channel in no
   * group yet gets a color picked to stand apart from the group's others. It
   * is shown when the group is active or the channel is already on, unless
   * that would pass the limit.
   */
  addToGroup(groupId: string, sourceId: string) {
    const state = getChannelState();
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;
    const ids = unitSourceIds(state, sourceId).filter(
      (id) => !rowInGroup(group, id),
    );
    if (ids.length === 0) return;
    const wasShown = isChannelShown(state, sourceId);
    const newRows = ids.flatMap((id, i) => {
      const sc = findChannel(state, id);
      return sc
        ? [
            makeGroupChannelRow(
              sc,
              group.channels.length + i,
              state.sourceChannels,
            ),
          ]
        : [];
    });
    // Rows with no style to keep get an optimized color (below).
    const fresh = new Set(
      newRows
        .filter((row) => !homeMembership(state, row.channelId))
        .map((row) => row.id),
    );
    adoptHomeStyle(state, newRows);
    awaitGroupRowFits(newRows);
    const nextGroups = state.groups.map((g) =>
      g.id === groupId ? { ...g, channels: [...g.channels, ...newRows] } : g,
    );
    commitGroups(nextGroups);
    const show = wasShown || state.activeGroupId === groupId;
    const after = getChannelState();
    let rows = { ...after.groupRowVisibilities };
    for (const row of newRows) {
      rows = show
        ? withGroupRowVisible(rows, nextGroups, row.id, true)
        : { ...rows, [row.id]: false };
    }
    // Now drawn through its new row, not in its own style.
    const next = { stack: withoutOwnStyle(after.stackVisibilities, ids), rows };
    if (show && !fitsCap(after, ids, next)) {
      for (const row of newRows) rows[row.id] = false;
    }
    commitVis(next);
    if (fresh.size > 0) {
      const keep = nextGroups
        .find((g) => g.id === groupId)
        ?.channels.filter((gc) => !fresh.has(gc.id))
        .map((gc) => gc.id);
      void optimizeGroupColors(groupId, new Set(keep));
    }
  },

  /** Remove a channel from a group (H&E: every plane of its image). */
  removeFromGroup(groupId: string, sourceId: string) {
    const state = getChannelState();
    const ids = new Set(unitSourceIds(state, sourceId));
    commitGroupsDroppingRows(
      state,
      state.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              channels: g.channels.filter((gc) => !ids.has(gc.channelId)),
            }
          : g,
      ),
    );
  },

  /**
   * Create a group from what is drawn now (so it saves the current view, in
   * the styles shown) and make it the one being edited. Returns its id.
   */
  createGroupFromView(): string {
    const state = getChannelState();
    const ids = state.sourceChannels
      .filter((sc) => state.paintedIds.has(sc.id))
      .map((sc) => sc.id);
    const unique = [...new Set(ids.flatMap((id) => unitSourceIds(state, id)))];
    const rows = unique.flatMap((id, i) => {
      const sc = findChannel(state, id);
      return sc ? [makeGroupChannelRow(sc, i, state.sourceChannels)] : [];
    });
    adoptHomeStyle(state, rows);
    awaitGroupRowFits(rows);
    const group: ChannelGroup = {
      id: crypto.randomUUID(),
      name: `Group ${state.groups.length + 1}`,
      channels: rows,
    };
    const nextGroups = [...state.groups, group];
    commitGroups(nextGroups);
    useAppStore.getState().setActiveChannelGroup(group.id);
    if (rows.length > 0) {
      // The new group takes over showing its channels.
      const after = getChannelState();
      let nextRows = { ...after.groupRowVisibilities };
      const stack = { ...after.stackVisibilities };
      for (const row of rows) {
        const wasShown = isChannelShown(state, row.channelId);
        nextRows = wasShown
          ? withGroupRowVisible(nextRows, nextGroups, row.id, true)
          : { ...nextRows, [row.id]: false };
        if (wasShown) {
          stack[row.channelId] = false;
          delete stack[ownStyleKey(row.channelId)];
        }
      }
      commitVis({ stack, rows: nextRows });
    }
    return group.id;
  },

  renameGroup(groupId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const state = getChannelState();
    commitGroups(
      state.groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)),
    );
  },

  /** Delete a group; if it was active, the first remaining group is shown. */
  deleteGroup(groupId: string) {
    const state = getChannelState();
    const next = state.groups.filter((g) => g.id !== groupId);
    commitGroupsDroppingRows(state, next);
    if (state.activeGroupId === groupId) {
      if (next[0]) useAppStore.getState().showOnlyChannelGroup(next[0].id);
      else useAppStore.setState({ activeChannelGroupId: null });
    }
  },
};
