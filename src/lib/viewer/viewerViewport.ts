import type { Deck, OrthographicViewState } from "@deck.gl/core";
import { useAppStore } from "@/lib/stores/appStore";

export type ViewerBounds = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

export type ViewerViewportSnapshot = {
  viewState: OrthographicViewState;
  viewportSize: { width: number; height: number };
};

/** Set by ImageViewer so waypoint save reads React viewState + viewport, not a stale Zustand copy. */
let viewerLiveSnapshotReader: (() => ViewerViewportSnapshot | null) | null =
  null;

/**
 * Read the camera Deck is actually rendering (viewport position + zoom).
 * React `viewState` can lag one frame behind Deck during pan/zoom; overwrite/jump
 * must use this when available.
 */
export const getViewerViewportSnapshotFromDeck = (
  deck: Deck | null | undefined,
): ViewerViewportSnapshot | null => {
  if (!deck?.isInitialized) return null;
  const vps = deck.getViewports();
  const vp = vps.find((v) => v.id === "ortho") ?? vps[0];
  if (!vp || vp.width <= 0 || vp.height <= 0) return null;
  const pos = vp.position;
  const z = vp.zoom;
  if (!Number.isFinite(z) || !Array.isArray(pos) || pos.length < 2) return null;
  const viewState = {
    zoom: z,
    target: [pos[0], pos[1], pos[2] ?? 0] as [number, number, number],
  } as OrthographicViewState;
  return {
    viewState,
    viewportSize: { width: vp.width, height: vp.height },
  };
};

export const registerViewerLiveSnapshotReader = (
  reader: (() => ViewerViewportSnapshot | null) | null,
) => {
  viewerLiveSnapshotReader = reader;
};

const orthographicZoomToNumber = (
  zoom: OrthographicViewState["zoom"],
): number | null => {
  if (typeof zoom === "number") return zoom;
  if (Array.isArray(zoom) && typeof zoom[0] === "number") return zoom[0];
  return null;
};

const getViewerViewportSnapshotFromStore =
  (): ViewerViewportSnapshot | null => {
    const live = viewerLiveSnapshotReader?.();
    if (live) {
      const z = orthographicZoomToNumber(live.viewState.zoom);
      if (
        z !== null &&
        Array.isArray(live.viewState.target) &&
        live.viewState.target.length >= 3 &&
        live.viewportSize.width > 0 &&
        live.viewportSize.height > 0
      ) {
        return live;
      }
    }
    const { viewerViewState, viewerViewportSize } = useAppStore.getState();
    if (!viewerViewState || !viewerViewportSize) return null;
    if (viewerViewportSize.width <= 0 || viewerViewportSize.height <= 0)
      return null;
    return {
      viewState: viewerViewState,
      viewportSize: viewerViewportSize,
    };
  };

const getViewerBoundsFromSnapshot = (
  snapshot: ViewerViewportSnapshot,
): ViewerBounds | null => {
  const zoom = orthographicZoomToNumber(snapshot.viewState.zoom);
  if (zoom === null) return null;
  const scale = 2 ** zoom;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const [x, y] = snapshot.viewState.target;
  const halfW = snapshot.viewportSize.width / (2 * scale);
  const halfH = snapshot.viewportSize.height / (2 * scale);
  return {
    x0: x - halfW,
    x1: x + halfW,
    y0: y - halfH,
    y1: y + halfH,
  };
};

const getViewerBoundsFromStore = (): ViewerBounds | null => {
  const snapshot = getViewerViewportSnapshotFromStore();
  if (!snapshot) return null;
  return getViewerBoundsFromSnapshot(snapshot);
};

export {
  orthographicZoomToNumber,
  getViewerViewportSnapshotFromStore,
  getViewerBoundsFromSnapshot,
  getViewerBoundsFromStore,
};
