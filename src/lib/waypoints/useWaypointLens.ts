import { useMemo } from "react";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";

/** The lens the viewer should arm: whose group to draw, and how wide. */
export type ActiveLens = {
  groupId: string;
  groupName: string;
  /** Screen pixels. */
  radius: number;
};

/**
 * Playback arms the lens of the waypoint on screen. Authoring arms it only
 * while that waypoint is open in the editor, so moving around the story
 * without editing a lens waypoint does not load the lens group's tiles.
 */
export function useWaypointLens(playback: boolean): ActiveLens | null {
  const activeStoryIndex = useAppStore((s) => s.activeStoryIndex);
  const editorOpen = useAppStore((s) => s.authoringWaypointEditorOpen);
  const openWaypointId = useAppStore((s) => s.openWaypointId);
  const waypoints = useDocumentStore((s) => s.waypoints);
  const channelGroups = useDocumentStore((s) => s.channelGroups);

  const waypoint = playback
    ? activeStoryIndex == null
      ? undefined
      : waypoints[activeStoryIndex]
    : editorOpen && openWaypointId
      ? waypoints.find((w) => w.id === openWaypointId)
      : undefined;
  const lens = waypoint?.lens;
  const group = lens
    ? channelGroups.find((g) => g.id === lens.groupId)
    : undefined;

  const groupId = group?.id;
  const groupName = group?.name;
  const radius = lens?.radius;
  return useMemo(
    () =>
      groupId && radius
        ? { groupId, groupName: groupName ?? "", radius }
        : null,
    [groupId, groupName, radius],
  );
}
