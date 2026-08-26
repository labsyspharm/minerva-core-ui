import { useStore } from "zustand";
import { useAppStore } from "./appStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "./documentStore";

/** Mirror channel UI fields in `appStore` from the current document slices. */
export function syncAppStoreChannelMirrorsFromDocument(): void {
  const doc = useDocumentStore.getState();
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const groups = doc.channelGroups;

  const groupNames = Object.fromEntries(
    groups.map(({ name, id }) => [id, name]),
  );

  const namesInUse = new Set<string>();
  for (const g of groups) {
    for (const gc of g.channels) {
      const sc = findSourceChannel(sourceChannels, gc.channelId);
      if (sc?.name) namesInUse.add(sc.name);
    }
  }

  const prevVis = useAppStore.getState().channelVisibilities;
  const channelVisibilities = { ...prevVis };
  for (const name of namesInUse) {
    if (channelVisibilities[name] === undefined) {
      channelVisibilities[name] = true;
    }
  }

  const activeId = useAppStore.getState().activeChannelGroupId;
  const nextActiveId =
    activeId && groups.some((g) => g.id === activeId)
      ? activeId
      : (groups[0]?.id ?? null);

  useAppStore.setState({
    groupNames,
    channelVisibilities,
    activeChannelGroupId: nextActiveId,
  });
}

/** Drop stale authoring sidecars and clamp story indices after document undo/redo. */
export function syncAppStoreWaypointsFromDocument(): void {
  const doc = useDocumentStore.getState();
  const app = useAppStore.getState();
  const waypoints = doc.waypoints;
  const ids = new Set(waypoints.map((w) => w.id));

  const waypointAuthoring = new Map(app.waypointAuthoring);
  for (const id of waypointAuthoring.keys()) {
    if (!ids.has(id)) waypointAuthoring.delete(id);
  }

  let activeStoryIndex = app.activeStoryIndex;
  if (activeStoryIndex !== null && activeStoryIndex >= waypoints.length) {
    activeStoryIndex = waypoints.length > 0 ? waypoints.length - 1 : null;
  }

  let authoringWaypointShapesIndex = app.authoringWaypointShapesIndex;
  if (
    authoringWaypointShapesIndex !== null &&
    authoringWaypointShapesIndex >= waypoints.length
  ) {
    authoringWaypointShapesIndex =
      waypoints.length > 0 ? waypoints.length - 1 : null;
  }

  useAppStore.setState({
    waypointAuthoring,
    activeStoryIndex,
    authoringWaypointShapesIndex,
  });
}

/** Reload canvas shapes for the active authoring waypoint. */
export function syncAppStoreShapesFromDocument(): void {
  const doc = useDocumentStore.getState();
  const app = useAppStore.getState();
  const waypoints = doc.waypoints;

  useAppStore.setState({ shapes: [] });

  const idx = app.authoringWaypointShapesIndex ?? app.activeStoryIndex;
  if (idx === null || idx < 0 || idx >= waypoints.length) return;

  useAppStore.getState().importWaypointShapes(waypoints[idx], true);
}

/** Reconcile ephemeral UI state after the document store changes externally (undo/redo). */
export function syncAppStoreFromDocument(): void {
  useAppStore.getState().clearChannelRendering();
  syncAppStoreChannelMirrorsFromDocument();
  syncAppStoreWaypointsFromDocument();
  syncAppStoreShapesFromDocument();
}

export function documentUndo(): void {
  const { pastStates, undo } = useDocumentStore.temporal.getState();
  if (pastStates.length === 0) return;
  undo();
  syncAppStoreFromDocument();
}

export function documentRedo(): void {
  const { futureStates, redo } = useDocumentStore.temporal.getState();
  if (futureStates.length === 0) return;
  redo();
  syncAppStoreFromDocument();
}

export function useCanDocumentUndo(): boolean {
  return useStore(useDocumentStore.temporal, (s) => s.pastStates.length > 0);
}

export function useCanDocumentRedo(): boolean {
  return useStore(useDocumentStore.temporal, (s) => s.futureStates.length > 0);
}
