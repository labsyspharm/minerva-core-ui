import type { ConfigWaypoint } from "@/lib/authoring/config";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { hydrateConfigWaypoint } from "@/lib/stores/storeUtils";

/**
 * When the story has no waypoints yet, add a single default row so image import (OME ROIs,
 * DICOM viewing, etc.) has a waypoint to attach content to.
 */
export function ensureDefaultWaypointForImageImport(): void {
  const doc = useDocumentStore.getState();
  if (doc.waypoints.length > 0) return;

  const groupId = doc.channelGroups[0]?.id;
  const raw: ConfigWaypoint = {
    id: crypto.randomUUID(),
    State: { Expanded: true },
    Name: "Waypoint 1",
    Content: "",
    shapeIds: [],
    ...(groupId !== undefined ? { groupId } : {}),
  };
  const app = useAppStore.getState();
  app.addStory(hydrateConfigWaypoint(raw, doc.channelGroups));
  app.setActiveStory(0);
}
