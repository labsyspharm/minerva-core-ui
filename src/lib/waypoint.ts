// Types
import type { Story } from "./exhibit";
import type { HashState } from "./hashUtil";

type WS = {
  s: HashState["s"];
  w: HashState["w"];
};

// View state for deck.gl OrthographicView
export interface WaypointViewState {
  zoom: number;
  target: [number, number, number];
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
 * - Pan: targetX = panX * imageWidth, targetY = panY * imageHeight
 * - Zoom: deckZoom = Math.log2(viewportZoom * containerWidth / imageWidth)
 */
const convertWaypointToViewState = (
  pan: [number, number] | null | undefined,
  zoom: number | null | undefined,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number
): WaypointViewState | null => {
  // Need at least pan or zoom to create a view state
  if ((pan === undefined || pan === null) && (zoom === undefined || zoom === null)) {
    return null;
  }

  // Default pan to center if not provided
  const panX = pan?.[0] ?? 0.5;
  const panY = pan?.[1] ?? 0.5;

  // Convert pan from normalized viewport coords (0-1) to image pixels
  const targetX = panX * imageWidth;
  const targetY = panY * imageHeight;

  // Convert zoom from OSD viewport zoom to deck.gl zoom
  // OSD viewport zoom 1 = image fits viewport width
  // deck.gl zoom is log2 scale where 0 = 1:1 pixel ratio
  let deckZoom: number;
  if (zoom !== undefined && zoom !== null && containerWidth > 0 && imageWidth > 0) {
    // viewportToImageZoom = viewportZoom * (containerWidth / imageWidth) * scale
    // where scale = 1 for standard setup (contentBounds.width = 1)
    const imageZoom = zoom * (containerWidth / imageWidth);
    deckZoom = Math.log2(imageZoom);
  } else {
    // Default to showing full image (use a reasonable default)
    // This will be overridden if zoom is provided
    deckZoom = Math.log2(containerWidth / imageWidth);
  }

  return {
    zoom: deckZoom,
    target: [targetX, targetY, 0]
  };
};

const modulo = (i, n) => ((i % n) + n) % n;

const getWaypoints = (list: Story[], s: number) => {
  return list[s]?.waypoints || [];
};

const getWaypoint = (list: Story[], s: number, w: number) => {
  const waypoints = getWaypoints(list, s) || [];
  return waypoints[modulo(w, waypoints.length)];
};

const handleWaypoint = (list: Story[], { w, s }: WS) => {
  const sLen = list.length;
  const sPrev = modulo(s - 1, sLen);
  const sNext = modulo(s + 1, sLen);
  const wLenNow = getWaypoints(list, s).length;
  const wLenPrev = getWaypoints(list, sPrev).length;
  return (diff) => {
    const wDiff = w + diff;
    const wLen = diff < 0 ? wLenPrev : wLenNow;
    const wNew = modulo(wDiff, wLen);
    const sNew = wNew === wDiff ? s : diff < 0 ? sPrev : sNext;
    const { g } = getWaypoint(list, sNew, wNew);
    return { g, w: wNew, s: sNew };
  };
};

export { getWaypoint, getWaypoints, handleWaypoint, convertWaypointToViewState };
