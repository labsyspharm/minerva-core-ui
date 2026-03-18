import type { ConfigWaypoint } from "./config";

// ── Export types (match story.schema.json) ──────────────────────────────────

export type PositionExport = {
  x: number;
  y: number;
  zoom: number;
};

export type ArrowExport = {
  x: number;
  y: number;
  angle: number;
  text: string;
  hide_arrow: boolean;
};

export type OverlayExport = {
  x: number;
  y: number;
  width: number;
  height: number;
  group?: string;
};

export type WaypointExport = {
  id: string;
  name: string;
  content: string;
  group?: string;
  position: PositionExport;
  arrows: ArrowExport[];
  overlays: OverlayExport[];
};

export type StoryExport = {
  version: "1";
  waypoints: WaypointExport[];
};

// ── Conversion helpers ──────────────────────────────────────────────────────

function resolvePosition(waypoint: ConfigWaypoint): PositionExport | null {
  // Prefer deck.gl-native ViewState
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
  // Fall back to legacy Pan/Zoom — caller must denormalize if needed,
  // but Pan is already in [0,1] relative to maxDim so we skip conversion
  // here and return null; the caller handles the maxDim multiplication.
  return null;
}

function resolvePositionWithFallback(
  waypoint: ConfigWaypoint,
  maxDim: number,
): PositionExport | null {
  const vs = resolvePosition(waypoint);
  if (vs) return vs;

  // Legacy Pan/Zoom → pixel coords
  if (waypoint.Pan != null) {
    const x = waypoint.Pan[0] * maxDim;
    const y = waypoint.Pan[1] * maxDim;
    // Zoom cannot be converted without containerWidth; store raw value as-is.
    const zoom = waypoint.Zoom ?? 0;
    return { x, y, zoom };
  }

  return null;
}

// ── Main export function ────────────────────────────────────────────────────

export function exportStory(
  stories: ConfigWaypoint[],
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

    const arrows: ArrowExport[] = (wp.Arrows ?? []).map((a) => ({
      x: a.Point[0] * maxDim,
      y: a.Point[1] * maxDim,
      angle: a.Angle,
      text: a.Text,
      hide_arrow: a.HideArrow,
    }));

    const overlays: OverlayExport[] = (wp.Overlays ?? []).map((o) => ({
      x: o.x * maxDim,
      y: o.y * maxDim,
      width: o.width * maxDim,
      height: o.height * maxDim,
      ...(o.Group ? { group: o.Group } : {}),
    }));

    const result: WaypointExport = {
      id: wp.UUID,
      name: wp.Name,
      content: wp.Content,
      position,
      arrows,
      overlays,
    };

    if (wp.Group) result.group = wp.Group;

    return result;
  });

  return { version: "1", waypoints };
}

// ── Download helper ─────────────────────────────────────────────────────────

export function downloadStoryJSON(
  stories: ConfigWaypoint[],
  imageWidth: number,
  imageHeight: number,
): void {
  const data = exportStory(stories, imageWidth, imageHeight);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "story.json";
  a.click();
  URL.revokeObjectURL(url);
}
