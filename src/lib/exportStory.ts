import type { ConfigWaypoint } from "./config";
import type { StoryShape } from "./storyShapes";

export type PositionExport = {
  x: number;
  y: number;
  zoom: number;
};

export type WaypointExport = {
  id: string;
  name: string;
  content: string;
  group?: string;
  position: PositionExport;
  /** UUIDs referencing `shapes` in the root export object. */
  shapes: string[];
};

export type StoryExport = {
  version: "2";
  waypoints: WaypointExport[];
  shapes: StoryShape[];
};

function resolvePosition(waypoint: ConfigWaypoint): PositionExport | null {
  if (waypoint.Bounds) {
    return {
      x: (waypoint.Bounds.x0 + waypoint.Bounds.x1) / 2,
      y: (waypoint.Bounds.y0 + waypoint.Bounds.y1) / 2,
      zoom: 0,
    };
  }
  if (
    waypoint.ViewState &&
    typeof waypoint.ViewState.zoom === "number" &&
    Array.isArray(waypoint.ViewState.target) &&
    waypoint.ViewState.target.length >= 2
  ) {
    return {
      x: waypoint.ViewState.target[0],
      y: waypoint.ViewState.target[1],
      zoom: waypoint.ViewState.zoom,
    };
  }
  return null;
}

function resolvePositionWithFallback(
  waypoint: ConfigWaypoint,
  maxDim: number,
): PositionExport | null {
  const vs = resolvePosition(waypoint);
  if (vs) return vs;

  if (waypoint.Pan != null) {
    const x = waypoint.Pan[0] * maxDim;
    const y = waypoint.Pan[1] * maxDim;
    const zoom = waypoint.Zoom ?? 0;
    return { x, y, zoom };
  }

  return null;
}

export function exportStory(
  stories: ConfigWaypoint[],
  shapes: StoryShape[],
  imageWidth: number,
  imageHeight: number,
): StoryExport {
  const maxDim = Math.max(imageWidth, imageHeight);

  const waypoints: WaypointExport[] = stories.map((wp) => {
    const position = resolvePositionWithFallback(wp, maxDim) ?? {
      x: 0,
      y: 0,
      zoom: 0,
    };

    const result: WaypointExport = {
      id: wp.UUID,
      name: wp.Name,
      content: wp.Content,
      position,
      shapes: [...(wp.ShapeIds ?? [])],
    };

    if (wp.Group) result.group = wp.Group;

    return result;
  });

  return { version: "2", waypoints, shapes: [...shapes] };
}

export function downloadStoryJSON(
  stories: ConfigWaypoint[],
  shapes: StoryShape[],
  imageWidth: number,
  imageHeight: number,
): void {
  const data = exportStory(stories, shapes, imageWidth, imageHeight);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "story.json";
  a.click();
  URL.revokeObjectURL(url);
}
