/**
 * `story.json` serialization: types aligned with `schema/story.schema.json`, plus
 * mapping between **`ConfigWaypoint`** (UI / exhibit: `Name`, `Bounds`, `ShapeIds`, …)
 * and the flatter exported shape (`title`, `viewport` corners, `shapes` UUID list, …).
 *
 * `STORY_JSON_VERSION` must match the schema `version` field; change it when the
 * exported JSON shape changes.
 */

import type { ConfigWaypoint } from "./config";
import type { StoryShape } from "./storyShapes";
import {
  getWaypointBounds,
  isWaypointBounds,
  type WaypointBounds,
} from "./waypoint";

/** Canonical `version` string in `story.json`; keep in sync with `schema/story.schema.json`. */
export const STORY_JSON_VERSION = "1" as const;

export type StoryWirePoint = { x: number; y: number };

export type StoryWireViewport = {
  upperLeft: StoryWirePoint;
  lowerRight: StoryWirePoint;
};

/** One waypoint row in `story.json`; maps to {@link ConfigWaypoint}. */
export type StoryWireWaypoint = {
  id: string;
  title: string;
  content: string;
  /** Opaque string (often channel group name in the app). */
  group?: string;
  /** Image data URL; 64×64 capture uses JPEG (see `waypointThumbnail.ts`). */
  thumbnail?: string;
  viewport: StoryWireViewport;
  shapes: string[];
};

export type StoryWireDocument = {
  version: typeof STORY_JSON_VERSION;
  waypoints: StoryWireWaypoint[];
  shapes: StoryShape[];
};

export function boundsToWireViewport(b: WaypointBounds): StoryWireViewport {
  const minX = Math.min(b.x0, b.x1);
  const maxX = Math.max(b.x0, b.x1);
  const minY = Math.min(b.y0, b.y1);
  const maxY = Math.max(b.y0, b.y1);
  return {
    upperLeft: { x: minX, y: minY },
    lowerRight: { x: maxX, y: maxY },
  };
}

export function wireViewportToBounds(v: StoryWireViewport): WaypointBounds {
  const x0 = Math.min(v.upperLeft.x, v.lowerRight.x);
  const x1 = Math.max(v.upperLeft.x, v.lowerRight.x);
  const y0 = Math.min(v.upperLeft.y, v.lowerRight.y);
  const y1 = Math.max(v.upperLeft.y, v.lowerRight.y);
  return { x0, x1, y0, y1 };
}

export function configWaypointToWire(
  wp: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): StoryWireWaypoint {
  let bounds: WaypointBounds | null = null;
  if (isWaypointBounds(wp.Bounds)) {
    bounds = wp.Bounds;
  } else if (
    imageWidth > 0 &&
    imageHeight > 0 &&
    containerWidth > 0 &&
    containerHeight > 0
  ) {
    bounds = getWaypointBounds(
      wp,
      imageWidth,
      imageHeight,
      containerWidth,
      containerHeight,
    );
  }
  if (!bounds && imageWidth > 0 && imageHeight > 0) {
    bounds = { x0: 0, y0: 0, x1: imageWidth, y1: imageHeight };
  }
  if (!bounds) {
    bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };
  }

  const out: StoryWireWaypoint = {
    id: wp.UUID,
    title: wp.Name,
    content: wp.Content ?? "",
    viewport: boundsToWireViewport(bounds),
    shapes: [...(wp.ShapeIds ?? [])],
  };
  if (wp.Group) {
    out.group = wp.Group;
  }
  if (wp.ThumbnailDataUrl) {
    out.thumbnail = wp.ThumbnailDataUrl;
  }
  return out;
}

/** Apply exported waypoint fields onto {@link ConfigWaypoint} (same `UUID` as `id`). */
export function applyWireWaypointToConfig(
  wp: ConfigWaypoint,
  wire: StoryWireWaypoint,
): ConfigWaypoint {
  if (wire.id !== wp.UUID) {
    return wp;
  }
  const bounds = wireViewportToBounds(wire.viewport);
  const next: ConfigWaypoint = {
    ...wp,
    Name: wire.title,
    Content: wire.content,
    Bounds: bounds,
    ShapeIds: [...wire.shapes],
    Pan: undefined,
    Zoom: undefined,
  };
  if (wire.group !== undefined) {
    next.Group = wire.group;
  }
  if (wire.thumbnail !== undefined) {
    next.ThumbnailDataUrl = wire.thumbnail;
  } else {
    delete next.ThumbnailDataUrl;
  }
  return next;
}

export function exportStoryDocument(
  stories: ConfigWaypoint[],
  shapes: StoryShape[],
  imageWidth: number,
  imageHeight: number,
  viewerViewportSize: { width: number; height: number } | null,
): StoryWireDocument {
  const cw = viewerViewportSize?.width ?? 0;
  const ch = viewerViewportSize?.height ?? 0;
  const waypoints = stories.map((s) =>
    configWaypointToWire(s, imageWidth, imageHeight, cw, ch),
  );
  return {
    version: STORY_JSON_VERSION,
    waypoints,
    shapes: shapes.map((s) => s),
  };
}

export function downloadStoryJSON(
  stories: ConfigWaypoint[],
  shapes: StoryShape[],
  imageWidth: number,
  imageHeight: number,
  viewerViewportSize: { width: number; height: number } | null,
  filename = "story.json",
): void {
  const data = exportStoryDocument(
    stories,
    shapes,
    imageWidth,
    imageHeight,
    viewerViewportSize,
  );
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
