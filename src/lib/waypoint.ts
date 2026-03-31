// Types

import type { ConfigWaypoint } from "./config";
import type { Story } from "./exhibit";
// View state for deck.gl OrthographicView
export interface WaypointViewState {
  zoom: number;
  target: [number, number, number];
}

export interface WaypointBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Convert Minerva 1.5 (OpenSeadragon) waypoint coordinates to Minerva 2.0 (deck.gl) view state.
 *
 * Minerva 1.5 coordinates:
 * - Pan: [x, y] - normalized viewport coordinates (0-1 range)
 * - Zoom: number - OSD "viewport zoom" (1 = image fits viewport width)
 *
 * Minerva 2.0 (deck.gl OrthographicView) coordinates:
 * - target: [x, y, z] - image pixel coordinates
 * - zoom: number - log2 scale (0 = 1:1 pixel ratio, negative = zoomed out)
 *
 * Conversion formulas:
 * - Pan: targetX = panX * maxDimension, targetY = panY * maxDimension (where maxDimension = max(imageWidth, imageHeight))
 * - Zoom: deckZoom = Math.log2(viewportZoom * containerWidth / imageWidth)
 */
const convertWaypointToViewState = (
  pan: [number, number] | null | undefined,
  zoom: number | null | undefined,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
): WaypointViewState | null => {
  // Need at least pan or zoom to create a view state
  if (
    (pan === undefined || pan === null) &&
    (zoom === undefined || zoom === null)
  ) {
    return null;
  }

  // Default pan to center if not provided
  const panX = pan?.[0] ?? 0.5;
  const panY = pan?.[1] ?? 0.5;

  // Convert pan from normalized viewport coords (0-1) to image pixels
  // Coordinates are normalized relative to max dimension (same as overlays)
  const maxDimension = Math.max(imageWidth, imageHeight);
  const targetX = panX * maxDimension;
  const targetY = panY * maxDimension;

  // Convert zoom from OSD viewport zoom to deck.gl zoom
  // OSD viewport zoom 1 = image fits viewport width
  // deck.gl zoom is log2 scale where 0 = 1:1 pixel ratio
  let deckZoom: number;
  if (
    zoom !== undefined &&
    zoom !== null &&
    containerWidth > 0 &&
    imageWidth > 0
  ) {
    // viewportToImageZoom = viewportZoom * (containerWidth / imageWidth) * scale
    // where scale = 1 for standard setup (contentBounds.width = 1)
    const imageZoom = zoom * (containerWidth / imageWidth);
    // Pull back slightly so legacy waypoints don't feel over-zoomed
    deckZoom = Math.log2(imageZoom) - 0.3;
  } else if (zoom !== undefined && zoom !== null && containerWidth > 0) {
    // Image size not ready yet (e.g. initial config normalize): avoid log2(∞).
    deckZoom = Math.log2(Math.max(zoom, 1e-9));
  } else if (containerWidth > 0 && imageWidth > 0) {
    deckZoom = Math.log2(containerWidth / imageWidth);
  } else {
    deckZoom = 0;
  }

  return {
    zoom: deckZoom,
    target: [targetX, targetY, 0],
  };
};

const isWaypointViewState = (v: unknown): v is WaypointViewState => {
  if (!v || typeof v !== "object") return false;
  const vs = v as { zoom?: unknown; target?: unknown };
  return (
    typeof vs.zoom === "number" &&
    Array.isArray(vs.target) &&
    vs.target.length === 3 &&
    vs.target.every((n) => typeof n === "number")
  );
};

const isWaypointBounds = (v: unknown): v is WaypointBounds => {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.x0 === "number" &&
    typeof b.x1 === "number" &&
    typeof b.y0 === "number" &&
    typeof b.y1 === "number"
  );
};

const viewStateToBounds = (
  viewState: WaypointViewState,
  containerWidth: number,
  containerHeight: number,
): WaypointBounds | null => {
  if (containerWidth <= 0 || containerHeight <= 0) return null;
  const scale = 2 ** viewState.zoom;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const halfW = containerWidth / (2 * scale);
  const halfH = containerHeight / (2 * scale);
  const [x, y] = viewState.target;
  return {
    x0: x - halfW,
    x1: x + halfW,
    y0: y - halfH,
    y1: y + halfH,
  };
};

const boundsToViewState = (
  bounds: WaypointBounds,
  containerWidth: number,
  containerHeight: number,
): WaypointViewState | null => {
  if (containerWidth <= 0 || containerHeight <= 0) return null;
  const width = Math.max(1e-6, Math.abs(bounds.x1 - bounds.x0));
  const height = Math.max(1e-6, Math.abs(bounds.y1 - bounds.y0));
  const scaleX = containerWidth / width;
  const scaleY = containerHeight / height;
  const scale = Math.min(scaleX, scaleY);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    zoom: Math.log2(scale),
    target: [(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2, 0],
  };
};

/**
 * Canonical view state getter for waypoints.
 *
 * - Prefer Deck.gl `waypoint.ViewState` when present (exact camera; survives
 *   width-constrained bounds where many rectangles map to the same zoom/target).
 * - Else bounds-native `waypoint.Bounds` (fit rectangle to current viewport).
 * - Else legacy Minerva 1.5 `Pan`/`Zoom` conversion.
 */
const getWaypointViewState = (
  waypoint: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): WaypointViewState | null => {
  if (isWaypointViewState(waypoint.ViewState)) {
    return waypoint.ViewState;
  }
  if (isWaypointBounds(waypoint.Bounds)) {
    return boundsToViewState(waypoint.Bounds, containerWidth, containerHeight);
  }
  return convertWaypointToViewState(
    waypoint.Pan,
    waypoint.Zoom,
    imageWidth,
    imageHeight,
    containerWidth,
  );
};

const getWaypointBounds = (
  waypoint: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): WaypointBounds | null => {
  if (isWaypointViewState(waypoint.ViewState)) {
    return viewStateToBounds(
      waypoint.ViewState,
      containerWidth,
      containerHeight,
    );
  }
  if (isWaypointBounds(waypoint.Bounds)) {
    return waypoint.Bounds;
  }
  const legacy = convertWaypointToViewState(
    waypoint.Pan,
    waypoint.Zoom,
    imageWidth,
    imageHeight,
    containerWidth,
  );
  if (!legacy) return null;
  return viewStateToBounds(legacy, containerWidth, containerHeight);
};

const normalizeWaypointToBounds = (
  waypoint: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): ConfigWaypoint => {
  const bounds = getWaypointBounds(
    waypoint,
    imageWidth,
    imageHeight,
    containerWidth,
    containerHeight,
  );
  if (!bounds) return waypoint;
  const next: ConfigWaypoint = {
    ...waypoint,
    Bounds: bounds,
    Pan: undefined,
    Zoom: undefined,
  };
  if (!isWaypointViewState(waypoint.ViewState)) {
    next.ViewState = undefined;
  }
  return next;
};

const modulo = (i, n) => ((i % n) + n) % n;

const getWaypoints = (list: Story[], s: number) => {
  return list[s]?.waypoints || [];
};

const getWaypoint = (list: Story[], s: number, w: number) => {
  const waypoints = getWaypoints(list, s) || [];
  return waypoints[modulo(w, waypoints.length)];
};

export {
  getWaypoint,
  getWaypoints,
  convertWaypointToViewState,
  getWaypointViewState,
  getWaypointBounds,
  normalizeWaypointToBounds,
};
