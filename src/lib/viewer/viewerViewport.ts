import type { Deck, OrthographicViewState } from "@deck.gl/core";
import { TransitionInterpolator } from "@deck.gl/core";
import { lerp } from "@math.gl/core";
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

export function viewStateToWorldBounds(
  zoom: number,
  target: readonly number[],
  width: number,
  height: number,
): ViewerBounds | null {
  if (width <= 0 || height <= 0) return null;
  const scale = 2 ** zoom;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const halfW = width / (2 * scale);
  const halfH = height / (2 * scale);
  const x = target[0] ?? 0;
  const y = target[1] ?? 0;
  return {
    x0: x - halfW,
    x1: x + halfW,
    y0: y - halfH,
    y1: y + halfH,
  };
}

export function worldBoundsToViewState(
  bounds: ViewerBounds,
  width: number,
  height: number,
): { zoom: number; target: [number, number, number] } | null {
  if (width <= 0 || height <= 0) return null;
  const worldW = Math.max(1e-6, Math.abs(bounds.x1 - bounds.x0));
  const worldH = Math.max(1e-6, Math.abs(bounds.y1 - bounds.y0));
  const scale = Math.min(width / worldW, height / worldH);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    zoom: Math.log2(scale),
    target: [(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2, 0],
  };
}

const getViewerBoundsFromSnapshot = (
  snapshot: ViewerViewportSnapshot,
): ViewerBounds | null => {
  const zoom = orthographicZoomToNumber(snapshot.viewState.zoom);
  if (zoom === null) return null;
  return viewStateToWorldBounds(
    zoom,
    snapshot.viewState.target,
    snapshot.viewportSize.width,
    snapshot.viewportSize.height,
  );
};

const getViewerBoundsFromStore = (): ViewerBounds | null => {
  const snapshot = getViewerViewportSnapshotFromStore();
  if (!snapshot) return null;
  return getViewerBoundsFromSnapshot(snapshot);
};

/** Deck may nest ortho state or expose zoom as a number / [zoomX, zoomY]. */
export type OrthoCamProps = {
  target?: [number, number, number] | number[];
  zoom?: number | [number, number];
  zoomX?: number;
  zoomY?: number;
  width?: number;
  height?: number;
  ortho?: OrthoCamProps;
};

export function withOrthoZoom(vs: {
  zoom: number;
  target: [number, number, number];
}): OrthographicViewState {
  return {
    zoom: vs.zoom,
    zoomX: vs.zoom,
    zoomY: vs.zoom,
    target: vs.target,
  } as OrthographicViewState;
}

/** Prefer zoomX (ortho controller), then scalar / pair zoom. */
export function orthographicZoomOf(props: OrthoCamProps): number | null {
  if (typeof props.zoomX === "number") return props.zoomX;
  return orthographicZoomToNumber(props.zoom);
}

/** Normalize Deck view state to flat `{ zoom, target }`. */
export function toFlatViewState(
  v: OrthoCamProps | null | undefined,
): { zoom: number; target: [number, number, number] } | null {
  const inner = v?.ortho ?? v;
  if (!inner || !Array.isArray(inner.target) || inner.target.length < 3) {
    return null;
  }
  const zoom = orthographicZoomOf(inner);
  if (zoom === null) return null;
  return {
    zoom,
    target: inner.target.slice(0, 3) as [number, number, number],
  };
}

type BoundsProps = ViewerBounds & { width: number; height: number };

/**
 * Independent lerp of log-zoom and world target reads as "zoom then pan".
 * Morph the visible world rectangle with one shared `t` and derive both.
 */
export class OrthographicBoundsInterpolator extends TransitionInterpolator {
  constructor() {
    super({
      compare: ["target", "zoomX", "zoomY"],
      extract: ["target", "zoom", "zoomX", "zoomY", "width", "height"],
      required: ["target"],
    });
  }

  initializeProps(startProps: OrthoCamProps, endProps: OrthoCamProps) {
    return {
      start: this.#asBoundsProps(startProps),
      end: this.#asBoundsProps(endProps),
    };
  }

  #asBoundsProps(props: OrthoCamProps): BoundsProps {
    const width = Math.max(1, props.width ?? 1);
    const height = Math.max(1, props.height ?? 1);
    const zoom = orthographicZoomOf(props) ?? 0;
    const bounds = viewStateToWorldBounds(
      zoom,
      props.target ?? [0, 0, 0],
      width,
      height,
    );
    return {
      width,
      height,
      x0: bounds?.x0 ?? 0,
      x1: bounds?.x1 ?? 0,
      y0: bounds?.y0 ?? 0,
      y1: bounds?.y1 ?? 0,
    };
  }

  interpolateProps(start: BoundsProps, end: BoundsProps, t: number) {
    const bounds: ViewerBounds = {
      x0: lerp(start.x0, end.x0, t),
      x1: lerp(start.x1, end.x1, t),
      y0: lerp(start.y0, end.y0, t),
      y1: lerp(start.y1, end.y1, t),
    };
    const width = end.width || start.width;
    const height = end.height || start.height;
    const vs = worldBoundsToViewState(bounds, width, height);
    const zoom = vs?.zoom ?? 0;
    const target = vs?.target ?? [0, 0, 0];
    return { target, zoom, zoomX: zoom, zoomY: zoom };
  }
}

export const WAYPOINT_TRANSITION_INTERPOLATOR =
  new OrthographicBoundsInterpolator();

export {
  orthographicZoomToNumber,
  getViewerViewportSnapshotFromStore,
  getViewerBoundsFromSnapshot,
  getViewerBoundsFromStore,
};
