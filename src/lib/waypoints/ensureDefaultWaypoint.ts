import type { ConfigWaypoint } from "@/lib/authoring/config";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";

/**
 * Add and activate "Waypoint 1" when the story has none. Needs an image: the new
 * view is sized from it (with none it would be a degenerate 1×1).
 */
export function ensureDefaultWaypoint(): void {
  const doc = useDocumentStore.getState();
  if (doc.waypoints.length > 0 || doc.images.length === 0) return;

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
  app.addStory(raw);
  app.setActiveStory(0);
}
