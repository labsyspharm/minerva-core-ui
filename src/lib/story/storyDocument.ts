/** `ConfigWaypoint` ↔ story.json (`storyJsonModel`): mapping + `exportStoryDocument` / download. */

import type { ConfigWaypoint } from "../authoring/config";
import {
  getWaypointBounds,
  isWaypointBounds,
  type WaypointBounds,
} from "../waypoints/waypoint";
import {
  parseStoryDocument,
  type StoryDocument,
  type StoryShape,
  type StoryViewport,
  type StoryWaypoint,
} from "./storyJsonModel";

export type { StoryDocument, StoryViewport, StoryWaypoint };

/** Serialized waypoint row + `ConfigWaypoint` camera fields. */
export type StoreStoryWaypoint = StoryWaypoint &
  Pick<ConfigWaypoint, "State" | "ViewState" | "Pan" | "Zoom">;

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Normalize exhibit / legacy waypoint fields into current {@link ConfigWaypoint} shape. */
export function hydrateConfigWaypoint(
  wp: ConfigWaypoint,
  channelGroups: { id: string; Name: string }[],
): ConfigWaypoint {
  const anyWp = wp as ConfigWaypoint & {
    UUID?: string;
    ShapeIds?: string[];
    Group?: string;
  };
  const id = anyWp.id ?? anyWp.UUID ?? "";
  const shapeIds = anyWp.shapeIds ?? anyWp.ShapeIds ?? [];
  let groupId = anyWp.groupId;
  const legacyGroup = anyWp.Group;
  if (
    groupId === undefined &&
    legacyGroup !== undefined &&
    legacyGroup !== ""
  ) {
    groupId = UUID_LIKE.test(legacyGroup)
      ? legacyGroup
      : (channelGroups.find((g) => g.Name === legacyGroup)?.id ?? legacyGroup);
  }
  const next = {
    ...wp,
    id,
    shapeIds,
    ...(groupId !== undefined ? { groupId } : {}),
  } as ConfigWaypoint & Record<string, unknown>;
  delete next.UUID;
  delete next.ShapeIds;
  delete next.Group;
  return next as ConfigWaypoint;
}

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
    id: wp.id,
    title: wp.Name,
    content: wp.Content ?? "",
    viewport: boundsToStoryViewport(bounds),
    shapeIds: [...(wp.shapeIds ?? [])],
  };
  if (wp.groupId) {
    out.groupId = wp.groupId;
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
    id: s.id,
    Name: s.title,
    Content: s.content,
    State: s.State,
    Bounds: bounds,
    shapeIds: [...s.shapeIds],
    ViewState: s.ViewState,
    Pan: s.Pan,
    Zoom: s.Zoom,
  };
  if (s.groupId !== undefined) {
    out.groupId = s.groupId;
  }
  if (s.thumbnail !== undefined) {
    out.ThumbnailDataUrl = s.thumbnail;
  }
  return out;
}

/** Map store waypoint rows → exhibit `ConfigWaypoint` list (`ItemRegistry.Stories`). */
export function waypointsToConfigWaypoints(
  waypoints: StoreStoryWaypoint[],
): ConfigWaypoint[] {
  return waypoints.map(storeStoryWaypointToConfigWaypoint);
}

/** Merge `row` into `wp` when `row.id === wp.id`. */
export function applyStoryWaypointToConfig(
  wp: ConfigWaypoint,
  row: StoryWaypoint,
): ConfigWaypoint {
  if (row.id !== wp.id) {
    return wp;
  }
  const bounds = storyViewportToBounds(row.viewport);
  const next: ConfigWaypoint = {
    ...wp,
    Name: row.title,
    Content: row.content,
    Bounds: bounds,
    shapeIds: [...row.shapeIds],
    Pan: undefined,
    Zoom: undefined,
  };
  if (row.groupId !== undefined) {
    next.groupId = row.groupId;
  }
  if (row.thumbnail !== undefined) {
    next.ThumbnailDataUrl = row.thumbnail;
  } else {
    delete next.ThumbnailDataUrl;
  }
  return next;
}

/** Serializable `story.json`: strip store camera fields, Zod-parse. */
export function exportStoryDocument(
  waypointRows: StoreStoryWaypoint[],
  shapeList: StoryShape[],
): StoryDocument {
  return parseStoryDocument({
    version: "2",
    waypoints: waypointRows.map(({ State, ViewState, Pan, Zoom, ...w }) => ({
      ...w,
      shapeIds: [...w.shapeIds],
    })),
    shapes: [...shapeList],
  });
}

/** Trigger a browser download of `story.json`. */
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
