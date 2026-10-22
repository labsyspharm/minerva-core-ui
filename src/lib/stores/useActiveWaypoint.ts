import { useAppStore } from "./appStore";
import type { Waypoint } from "./documentSchema";
import { useDocumentStore } from "./documentStore";

/** The waypoint on screen, or undefined when none is selected. */
export function useActiveWaypoint(): Waypoint | undefined {
  const activeStoryIndex = useAppStore((s) => s.activeStoryIndex);
  return useDocumentStore((s) =>
    activeStoryIndex == null ? undefined : s.waypoints[activeStoryIndex],
  );
}
