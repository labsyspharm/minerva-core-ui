/**
 * Public, JSON-serializable snapshot of a Minerva session.
 *
 * Read from the same Zustand stores the UI uses (`documentStore` + `appStore`),
 * so it describes whatever tree is mounted (CDN player, `<MinervaStory>`, or
 * the authoring shell). Coordinates are **image pixels** (level 0), never
 * Deck world units, so callers do not need to know about physical size.
 */

import {
  applyVisibilityTransition,
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import { isImageChannel } from "@/lib/imaging/channelKind";
import {
  effectiveWorldFrame,
  viewStateToPixels,
} from "@/lib/imaging/worldFrame";
import { useAppStore } from "@/lib/stores/appStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { viewStateToWorldBounds } from "@/lib/viewer/viewerViewport";

export type MinervaStatus = "idle" | "loading" | "ready" | "error";

/** Axis-aligned rectangle in image pixels (`x0,y0` = top-left). */
export type MinervaBounds = { x0: number; y0: number; x1: number; y1: number };

export type MinervaView = {
  /** Viewport center in image pixels. */
  target: [number, number];
  /** log2 screen-pixels per image-pixel (0 = 1:1, negative = zoomed out). */
  zoom: number;
  /** Visible region in image pixels. */
  bounds: MinervaBounds | null;
};

export type MinervaChannelState = {
  /** Group row id (unique per group). */
  id: string;
  /** Source image channel id (shared across groups). */
  channelId: string;
  name: string;
  visible: boolean;
  /** `#rrggbb` */
  color: string;
  lowerLimit: number;
  upperLimit: number;
};

export type MinervaChannelGroupState = {
  id: string;
  name: string;
  active: boolean;
  channels: MinervaChannelState[];
};

export type MinervaWaypointState = {
  id: string;
  index: number;
  title: string;
  /** Channel group the waypoint opens with, when set. */
  groupId: string | null;
};

/** Channels shown when the document has no channel groups. */
export type MinervaUngroupedChannelState = {
  channelId: string;
  name: string;
  visible: boolean;
};

export type MinervaState = {
  status: MinervaStatus;
  error: string | null;
  document: { id: string | null; title: string };
  image: { width: number; height: number } | null;
  waypoints: MinervaWaypointState[];
  activeWaypoint: { id: string; index: number } | null;
  channelGroups: MinervaChannelGroupState[];
  activeChannelGroupId: string | null;
  ungroupedChannels: MinervaUngroupedChannelState[];
  view: MinervaView | null;
};

const toHex = ({
  r = 0,
  g = 0,
  b = 0,
}: {
  r?: number;
  g?: number;
  b?: number;
}) =>
  `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

function readView(): MinervaView | null {
  const app = useAppStore.getState();
  const flat = app.viewerViewState;
  if (!flat || typeof flat.zoom !== "number" || !Array.isArray(flat.target)) {
    return null;
  }
  const im = useDocumentStore.getState().images[0];
  const frame = effectiveWorldFrame(
    app.viewerWorldFrame,
    im?.sizeX ?? 0,
    im?.sizeY ?? 0,
  );
  const px = viewStateToPixels(
    {
      zoom: flat.zoom,
      target: [flat.target[0] ?? 0, flat.target[1] ?? 0, 0],
    },
    frame,
  );
  const size = app.viewerViewportSize;
  return {
    target: [px.target[0], px.target[1]],
    zoom: px.zoom,
    bounds: size
      ? viewStateToWorldBounds(px.zoom, px.target, size.width, size.height)
      : null,
  };
}

/** Build a fresh snapshot from the live stores. */
export function readMinervaState(
  status: MinervaStatus,
  error: string | null = null,
): MinervaState {
  const doc = useDocumentStore.getState();
  const app = useAppStore.getState();
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const activeIndex = app.activeStoryIndex;
  const activeWp =
    activeIndex !== null ? doc.waypoints[activeIndex] : undefined;
  const firstImage = doc.images[0];

  const grouped = new Set(
    doc.channelGroups.flatMap((g) => g.channels.map((c) => c.channelId)),
  );
  // Same fill the renderer applies (viv.ts), so `visible` matches the screen.
  const visibility = applyVisibilityTransition(
    sourceChannels,
    doc.channelGroups,
    app.channelVisibilities,
    app.channelGroupRowVisibilities,
    Object.keys(app.channelVisibilities).length === 0
      ? { kind: "fresh" }
      : { kind: "sync" },
  );

  return {
    status,
    error,
    document: {
      id: doc.metadata.id ?? doc.activeStoryId ?? null,
      title: doc.metadata.title ?? "",
    },
    image: firstImage
      ? { width: firstImage.sizeX, height: firstImage.sizeY }
      : null,
    waypoints: doc.waypoints.map((wp, index) => ({
      id: wp.id,
      index,
      title: wp.title,
      groupId: wp.groupId ?? null,
    })),
    activeWaypoint:
      activeWp && activeIndex !== null
        ? { id: activeWp.id, index: activeIndex }
        : null,
    channelGroups: doc.channelGroups.map((g) => ({
      id: g.id,
      name: g.name,
      active: g.id === app.activeChannelGroupId,
      channels: g.channels.map((gc) => ({
        id: gc.id,
        channelId: gc.channelId,
        name: findSourceChannel(sourceChannels, gc.channelId)?.name ?? "",
        visible: isGroupRowVisible(
          visibility.channelGroupRowVisibilities,
          gc.id,
        ),
        color: toHex(gc.color),
        lowerLimit: gc.lowerLimit,
        upperLimit: gc.upperLimit,
      })),
    })),
    activeChannelGroupId: app.activeChannelGroupId,
    ungroupedChannels: sourceChannels
      .filter((sc) => isImageChannel(sc) && !grouped.has(sc.id))
      .map((sc) => ({
        channelId: sc.id,
        name: sc.name,
        visible: isStackVisible(visibility.channelVisibilities, sc.id),
      })),
    view: readView(),
  };
}

/**
 * Store slices the snapshot depends on. Used to skip recomputing (and
 * re-notifying) on the many app-store updates that do not affect it
 * (hover, drag, brush, SAM2, …).
 */
export function minervaStateDeps(): readonly unknown[] {
  const doc = useDocumentStore.getState();
  const app = useAppStore.getState();
  return [
    doc.metadata,
    doc.activeStoryId,
    doc.images,
    doc.waypoints,
    doc.channelGroups,
    app.activeStoryIndex,
    app.activeChannelGroupId,
    app.channelVisibilities,
    app.channelGroupRowVisibilities,
    app.viewerViewState,
    app.viewerViewportSize,
    app.viewerWorldFrame,
  ];
}
