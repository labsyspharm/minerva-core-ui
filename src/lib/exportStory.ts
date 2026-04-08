/**
 * `story.json` serialization: types aligned with `schema/story.schema.json`, plus
 * mapping between **`ConfigWaypoint`** (exhibit: `Name`, `Bounds`, `ShapeIds`, …)
 * and the serialized row (`title`, viewport corners, `shapes` UUID list, …).
 *
 * The overlay store keeps a live **`storyDocument`**; `syncStoryDocument` rebuilds
 * it from store **`stories`** (narrative rows) + **`Shapes`** + image and viewer size.
 * JSON **`waypoints`** are those rows’ serializable fields.
 *
 * `STORY_JSON_VERSION` must match the schema `version` field; change it when the
 * exported JSON shape changes.
 */

import type { ConfigWaypoint } from "./config";
import type { StoryPoint, StoryShape } from "./storyShapes";
import {
  getWaypointBounds,
  isWaypointBounds,
  type WaypointBounds,
} from "./waypoint";

/** Canonical `version` string in `story.json`; keep in sync with `schema/story.schema.json`. */
export const STORY_JSON_VERSION = "1" as const;

export type StoryViewport = {
  upperLeft: StoryPoint;
  lowerRight: StoryPoint;
};

/** One waypoint row in `story.json`; maps to / from {@link ConfigWaypoint} fields. */
export type StoryWaypoint = {
  id: string;
  title: string;
  content: string;
  /** Opaque string (often channel group name in the app). */
  group?: string;
  /** Image data URL; 64×64 capture uses JPEG (see `waypointThumbnail.ts`). */
  thumbnail?: string;
  viewport: StoryViewport;
  shapes: string[];
};

/** Store row: serialized fields plus runtime / exhibit camera and UI state. */
export type StoreStoryWaypoint = StoryWaypoint &
  Pick<ConfigWaypoint, "State" | "ViewState" | "Pan" | "Zoom">;

export type StoryDocument = {
  version: typeof STORY_JSON_VERSION;
  waypoints: StoryWaypoint[];
  shapes: StoryShape[];
};

export function boundsToStoryViewport(b: WaypointBounds): StoryViewport {
  const minX = Math.min(b.x0, b.x1);
  const maxX = Math.max(b.x0, b.x1);
  const minY = Math.min(b.y0, b.y1);
  const maxY = Math.max(b.y0, b.y1);
  return {
    upperLeft: { x: minX, y: minY },
    lowerRight: { x: maxX, y: maxY },
  };
}

export function storyViewportToBounds(v: StoryViewport): WaypointBounds {
  const x0 = Math.min(v.upperLeft.x, v.lowerRight.x);
  const x1 = Math.max(v.upperLeft.x, v.lowerRight.x);
  const y0 = Math.min(v.upperLeft.y, v.lowerRight.y);
  const y1 = Math.max(v.upperLeft.y, v.lowerRight.y);
  return { x0, x1, y0, y1 };
}

export function configWaypointToStoryWaypoint(
  wp: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): StoryWaypoint {
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

  const out: StoryWaypoint = {
    id: wp.UUID,
    title: wp.Name,
    content: wp.Content ?? "",
    viewport: boundsToStoryViewport(bounds),
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

export function configWaypointToStoreStoryWaypoint(
  wp: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): StoreStoryWaypoint {
  const row = configWaypointToStoryWaypoint(
    wp,
    imageWidth,
    imageHeight,
    containerWidth,
    containerHeight,
  );
  return {
    ...row,
    State: wp.State,
    ViewState: wp.ViewState,
    Pan: wp.Pan,
    Zoom: wp.Zoom,
  };
}

export function storeStoryWaypointToConfigWaypoint(
  s: StoreStoryWaypoint,
): ConfigWaypoint {
  const bounds = storyViewportToBounds(s.viewport);
  const out: ConfigWaypoint = {
    UUID: s.id,
    Name: s.title,
    Content: s.content,
    State: s.State,
    Bounds: bounds,
    ShapeIds: [...s.shapes],
    ViewState: s.ViewState,
    Pan: s.Pan,
    Zoom: s.Zoom,
  };
  if (s.group !== undefined) {
    out.Group = s.group;
  }
  if (s.thumbnail !== undefined) {
    out.ThumbnailDataUrl = s.thumbnail;
  }
  return out;
}

export function storiesToConfigWaypoints(
  stories: StoreStoryWaypoint[],
): ConfigWaypoint[] {
  return stories.map(storeStoryWaypointToConfigWaypoint);
}

/** Apply exported waypoint fields onto {@link ConfigWaypoint} (same `UUID` as `id`). */
export function applyStoryWaypointToConfig(
  wp: ConfigWaypoint,
  row: StoryWaypoint,
): ConfigWaypoint {
  if (row.id !== wp.UUID) {
    return wp;
  }
  const bounds = storyViewportToBounds(row.viewport);
  const next: ConfigWaypoint = {
    ...wp,
    Name: row.title,
    Content: row.content,
    Bounds: bounds,
    ShapeIds: [...row.shapes],
    Pan: undefined,
    Zoom: undefined,
  };
  if (row.group !== undefined) {
    next.Group = row.group;
  }
  if (row.thumbnail !== undefined) {
    next.ThumbnailDataUrl = row.thumbnail;
  } else {
    delete next.ThumbnailDataUrl;
  }
  return next;
}

export function exportStoryDocument(
  stories: StoreStoryWaypoint[],
  shapes: StoryShape[],
  imageWidth: number,
  imageHeight: number,
  viewerViewportSize: { width: number; height: number } | null,
): StoryDocument {
  const cw = viewerViewportSize?.width ?? 0;
  const ch = viewerViewportSize?.height ?? 0;
  const waypoints = stories.map((s) => {
    const wp = storeStoryWaypointToConfigWaypoint(s);
    return configWaypointToStoryWaypoint(wp, imageWidth, imageHeight, cw, ch);
  });
  return {
    version: STORY_JSON_VERSION,
    waypoints,
    shapes: shapes.map((shape) => shape),
  };
}

/** Download a `story.json` blob (e.g. after `syncStoryDocument`). */
export function downloadStoryDocument(
  doc: StoryDocument,
  filename = "story.json",
): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
