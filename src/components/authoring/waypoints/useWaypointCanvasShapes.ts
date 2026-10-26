import * as React from "react";
import { effectiveWorldFrame } from "@/lib/imaging/worldFrame";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";

/**
 * Keep the canvas showing a waypoint's annotations on every author tab, not only Story: the
 * waypoint open in the Story tab, else the active row, else the first. Leaving the Story tab
 * saves canvas edits back to that waypoint.
 */
export function useWaypointCanvasShapes(storyTabOpen: boolean): void {
  const waypoints = useDocumentStore((s) => s.waypoints);
  const shapes = useDocumentStore((s) => s.shapes);
  const docImageWidth = useDocumentStore((s) => s.images[0]?.sizeX ?? 0);
  const docImageHeight = useDocumentStore((s) => s.images[0]?.sizeY ?? 0);
  const viewerWorldFrame = useAppStore((s) => s.viewerWorldFrame);
  const activeStoryIndex = useAppStore((s) => s.activeStoryIndex);
  const openWaypointId = useAppStore((s) => s.openWaypointId);
  const importWaypointShapes = useAppStore((s) => s.importWaypointShapes);
  const frame = effectiveWorldFrame(
    viewerWorldFrame,
    docImageWidth,
    docImageHeight,
  );
  const imageWidth = frame.pixelWidth;
  const imageHeight = frame.pixelHeight;

  /**
   * Last waypoint id we ran import for (persist this before switching). An id, not an index:
   * deleting or reordering rows shifts indices, and the canvas must not save into a neighbor.
   */
  const previousImportStoryIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (waypoints.length === 0) {
      // The last waypoint was deleted: its shapes leave the canvas with it.
      if (previousImportStoryIdRef.current !== null) {
        previousImportStoryIdRef.current = null;
        useAppStore.getState().clearShapes();
      }
      return;
    }
    if (imageWidth === 0 || imageHeight === 0) return;

    const openIndex = waypoints.findIndex((w) => w.id === openWaypointId);
    const storyIndex = openIndex >= 0 ? openIndex : (activeStoryIndex ?? 0);
    const story = waypoints[storyIndex];
    if (!story) {
      useAppStore.getState().clearShapes();
      return;
    }

    const prevId = previousImportStoryIdRef.current;
    const store = useAppStore.getState();
    if (prevId !== null && prevId !== story.id) {
      // A deleted waypoint has nothing left to save.
      const prevIndex = waypoints.findIndex((w) => w.id === prevId);
      if (prevIndex >= 0) store.persistImportedShapesToStory(prevIndex);
    }
    previousImportStoryIdRef.current = story.id;

    importWaypointShapes(story, true, shapes);
  }, [
    waypoints,
    activeStoryIndex,
    openWaypointId,
    imageWidth,
    imageHeight,
    shapes,
    importWaypointShapes,
  ]);

  // Leaving the Story tab (or the editor from it) saves canvas edits to their waypoint.
  React.useEffect(() => {
    if (!storyTabOpen) return;
    return () => {
      const doc = useDocumentStore.getState();
      const prevId = previousImportStoryIdRef.current;
      const p = doc.waypoints.findIndex((w) => w.id === prevId);
      if (p < 0) return;
      const st = useAppStore.getState();
      const im = doc.images[0];
      const f = effectiveWorldFrame(
        st.viewerWorldFrame,
        im?.sizeX ?? 0,
        im?.sizeY ?? 0,
      );
      if (f.worldWidth > 0 && f.worldHeight > 0) {
        st.persistImportedShapesToStory(p);
      }
    };
  }, [storyTabOpen]);
}
