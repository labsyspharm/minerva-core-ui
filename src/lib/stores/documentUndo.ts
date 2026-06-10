import * as React from "react";
import { useStore } from "zustand";
import { useAppStore } from "./appStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "./documentStore";

/** Optional hook for mirroring document slices into legacy `config.ItemRegistry`. */
let documentExternalSyncCallback: (() => void) | null = null;

export function setDocumentExternalSyncCallback(fn: (() => void) | null): void {
  documentExternalSyncCallback = fn;
}

export function clearDocumentHistory(): void {
  useDocumentStore.temporal.getState().clear();
}

/** Mirror channel UI fields in `appStore` from the current document slices. */
export function syncAppStoreChannelMirrorsFromDocument(): void {
  const doc = useDocumentStore.getState();
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const groups = doc.channelGroups;

  const groupNames = Object.fromEntries(
    groups.map(({ name, id }) => [id, name]),
  );
  const groupChannelLists = Object.fromEntries(
    groups.map(({ name, channels }) => [
      name,
      channels
        .map((gc) => findSourceChannel(sourceChannels, gc.channelId))
        .filter(Boolean)
        .map((sc) => sc?.name as string),
    ]),
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
    groupChannelLists,
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
  documentExternalSyncCallback?.();
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest(".ProseMirror")) return true;
  return false;
}

/** Global Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z for document undo/redo. */
export function useDocumentUndoKeyboard(): void {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        const can = useDocumentStore.temporal.getState().pastStates.length > 0;
        if (!can) return;
        event.preventDefault();
        documentUndo();
        return;
      }
      if (key === "z" && event.shiftKey) {
        const can =
          useDocumentStore.temporal.getState().futureStates.length > 0;
        if (!can) return;
        event.preventDefault();
        documentRedo();
        return;
      }
      if (key === "y") {
        const can =
          useDocumentStore.temporal.getState().futureStates.length > 0;
        if (!can) return;
        event.preventDefault();
        documentRedo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
