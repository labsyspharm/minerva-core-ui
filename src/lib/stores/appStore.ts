import type { OrthographicViewState } from "@deck.gl/core";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ConfigWaypoint } from "../authoring/config";
import { buildBrushHull } from "../shapes/brushHull";
import { polygonDifference, polygonUnion } from "../shapes/polygonClipping";
import { arrowLineDegeneratePolygon } from "../shapes/shapeGeometry";
import {
  type DragState,
  type DrawingState,
  ellipseToPolygon,
  type HoverState,
  type InteractionCoordinate,
  type LineShape,
  type OverlayLayer,
  type PointShape,
  type PolygonShape,
  type PolylineShape,
  rectangleToPolygon,
  type Shape,
  type ShapeGroup,
  type TextShape,
} from "../shapes/shapeModel";
import { mergeShapesAfterWaypointImport } from "../shapes/shapeWaypointImport";
import type { ViewportSize, ViewRect } from "../viewer/samViewport";
import type { Waypoint } from "./documentSchema";
import {
  documentShapes,
  documentWaypoints,
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "./documentStore";
import {
  type AuthoringWaypointExtra,
  configWaypointToWaypoint,
  hydrateConfigWaypoint,
  mergeShapesForWaypointPersist,
  type StoryShape,
  storyShapeToViewer,
  viewerShapesToStoryShapes,
  waypointToConfigWaypoint,
} from "./storeUtils";

function newShapeId(): string {
  return crypto.randomUUID();
}

/** Pixel size of the first stacked image as reported by `ImageViewer` (loader shape). */
export type ReferenceImagePixelSize = { width: number; height: number };

/**
 * Prefer live viewer geometry (first stacked loader); fall back to `document.images[0]`
 * when the viewer has not published yet (e.g. before mount).
 */
export function effectiveReferenceImagePixelSize(
  viewerPublished: ReferenceImagePixelSize | null | undefined,
  docWidth: number,
  docHeight: number,
): ReferenceImagePixelSize {
  if (
    viewerPublished &&
    viewerPublished.width > 0 &&
    viewerPublished.height > 0
  ) {
    return viewerPublished;
  }
  return { width: docWidth, height: docHeight };
}

function referenceImagePixelSizeForActions(
  get: () => AppStore,
): ReferenceImagePixelSize {
  const doc = useDocumentStore.getState();
  const im = doc.images[0];
  return effectiveReferenceImagePixelSize(
    get().viewerReferenceImagePixelSize,
    im?.sizeX ?? 0,
    im?.sizeY ?? 0,
  );
}

function authoringViewportForDoc(get: () => AppStore) {
  const v = get().viewerViewportSize;
  return { width: v?.width ?? 0, height: v?.height ?? 0 };
}

type BrushMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

/** Viewport-sized mask: one pixel per screen pixel. */
function ensureBrushMaskViewport(
  viewportWidth: number,
  viewportHeight: number,
  existing: BrushMask | null,
): BrushMask {
  if (
    existing &&
    existing.width === viewportWidth &&
    existing.height === viewportHeight
  )
    return existing;
  const w = Math.max(1, Math.round(viewportWidth));
  const h = Math.max(1, Math.round(viewportHeight));
  return { width: w, height: h, data: new Uint8Array(w * h) };
}

/** Paint circle in screen coords. sx,sy in [0, viewportW] x [0, viewportH]; row 0 = top. */
function paintCircleOnMaskScreen(
  mask: BrushMask,
  sx: number,
  sy: number,
  radiusPx: number,
): void {
  const { width, height, data } = mask;
  if (width <= 0 || height <= 0) return;
  const mx = Math.round(Math.max(0, Math.min(width - 1, sx)));
  const my = Math.round(Math.max(0, Math.min(height - 1, sy)));
  const r = Math.max(1, Math.round(radiusPx));
  const y0 = Math.max(0, my - r);
  const y1 = Math.min(height - 1, my + r);
  const x0 = Math.max(0, mx - r);
  const x1 = Math.min(width - 1, mx + r);
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - mx) ** 2 + (y - my) ** 2 <= r2) data[y * width + x] = 1;
    }
  }
}

type Point2 = [number, number];

function pointToSegmentDistance(p: Point2, a: Point2, b: Point2): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;
  const t =
    denom === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

function simplifyRdpOpen(points: Point2[], epsilon: number): Point2[] {
  if (points.length <= 2) return points;
  let maxDist = -1;
  let idx = -1;
  const a = points[0];
  const b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(points[i], a, b);
    if (d > maxDist) {
      maxDist = d;
      idx = i;
    }
  }
  if (maxDist <= epsilon || idx === -1) return [a, b];
  const left = simplifyRdpOpen(points.slice(0, idx + 1), epsilon);
  const right = simplifyRdpOpen(points.slice(idx), epsilon);
  return [...left.slice(0, -1), ...right];
}

function simplifyClosedPolygon(
  pointsClosed: Point2[],
  epsilon: number,
): Point2[] {
  if (pointsClosed.length < 4) return pointsClosed;
  const pts =
    pointsClosed[0][0] === pointsClosed[pointsClosed.length - 1][0] &&
    pointsClosed[0][1] === pointsClosed[pointsClosed.length - 1][1]
      ? pointsClosed.slice(0, -1)
      : [...pointsClosed];
  if (pts.length < 3) return pointsClosed;

  // Choose a stable cut: minX and maxX
  let minI = 0;
  let maxI = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] < pts[minI][0]) minI = i;
    if (pts[i][0] > pts[maxI][0]) maxI = i;
  }
  if (minI === maxI) {
    // fallback: minY/maxY
    minI = 0;
    maxI = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][1] < pts[minI][1]) minI = i;
      if (pts[i][1] > pts[maxI][1]) maxI = i;
    }
  }

  const n = pts.length;
  const forward = (from: number, to: number): Point2[] => {
    const out: Point2[] = [];
    let i = from;
    while (true) {
      out.push(pts[i]);
      if (i === to) break;
      i = (i + 1) % n;
    }
    return out;
  };

  const path1 = forward(minI, maxI);
  const path2 = forward(maxI, minI);
  const s1 = simplifyRdpOpen(path1, epsilon);
  const s2 = simplifyRdpOpen(path2, epsilon);
  const combined = [...s1, ...s2.slice(1, -1)];

  // Remove near-duplicates
  const cleaned: Point2[] = [];
  for (const p of combined) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > epsilon * 0.25)
      cleaned.push(p);
  }

  if (cleaned.length < 3) return pointsClosed;
  return [...cleaned, cleaned[0]];
}

function signedPolygonArea(points: Point2[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j][0] * points[i][1];
    area -= points[i][0] * points[j][1];
  }
  return area / 2;
}

function pointInPolygon2(p: Point2, polygon: Point2[]): boolean {
  const [px, py] = p;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonsOverlap(a: Point2[], b: Point2[]): boolean {
  if (a.length === 0 || b.length === 0) return false;

  // Quick reject: bounding boxes do not intersect
  const bbox = (poly: Point2[]) => {
    let minX = poly[0][0];
    let maxX = poly[0][0];
    let minY = poly[0][1];
    let maxY = poly[0][1];
    for (const [x, y] of poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY };
  };

  const ab = bbox(a);
  const bb = bbox(b);
  if (
    ab.maxX < bb.minX ||
    ab.minX > bb.maxX ||
    ab.maxY < bb.minY ||
    ab.minY > bb.maxY
  ) {
    return false;
  }

  // Check if any vertex of one polygon lies inside the other
  for (const pt of a) {
    if (pointInPolygon2(pt, b)) return true;
  }
  for (const pt of b) {
    if (pointInPolygon2(pt, a)) return true;
  }

  return false;
}

type IKey = string; // "ix,iy" where ix/iy are integer coordinates in half-pixel grid (x*2, y*2)
function ikey(ix: number, iy: number): IKey {
  return `${ix},${iy}`;
}
function parseIKey(k: IKey): Point2 {
  const [xs, ys] = k.split(",");
  return [Number.parseInt(xs, 10) / 2, Number.parseInt(ys, 10) / 2];
}
function edgeKey(a: IKey, b: IKey): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function addAdj(adj: Map<IKey, IKey[]>, a: IKey, b: IKey) {
  const la = adj.get(a);
  if (la) la.push(b);
  else adj.set(a, [b]);
  const lb = adj.get(b);
  if (lb) lb.push(a);
  else adj.set(b, [a]);
}

function maskToLoops(mask: BrushMask): Point2[][] {
  const { width: w, height: h, data } = mask;
  if (w < 2 || h < 2) return [];

  const adj = new Map<IKey, IKey[]>();

  // Marching squares edge midpoints in half-grid integer coords.
  const pt = (x2: number, y2: number): IKey => ikey(x2, y2);
  const edgePoint = (x: number, y: number, edge: 0 | 1 | 2 | 3): IKey => {
    // edges: 0=top,1=right,2=bottom,3=left
    switch (edge) {
      case 0:
        return pt(x * 2 + 1, y * 2);
      case 1:
        return pt((x + 1) * 2, y * 2 + 1);
      case 2:
        return pt(x * 2 + 1, (y + 1) * 2);
      case 3:
        return pt(x * 2, y * 2 + 1);
    }
  };

  const addSeg = (a: IKey, b: IKey) => {
    if (a === b) return;
    addAdj(adj, a, b);
  };

  // Build segment graph
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const tl = data[y * w + x] ? 1 : 0;
      const tr = data[y * w + (x + 1)] ? 1 : 0;
      const br = data[(y + 1) * w + (x + 1)] ? 1 : 0;
      const bl = data[(y + 1) * w + x] ? 1 : 0;
      const idx = (tl << 0) | (tr << 1) | (br << 2) | (bl << 3);

      // segments as pairs of edges
      let segs: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3][] = [];
      switch (idx) {
        case 0:
        case 15:
          segs = [];
          break;
        case 1:
          segs = [[3, 0]];
          break;
        case 2:
          segs = [[0, 1]];
          break;
        case 3:
          segs = [[3, 1]];
          break;
        case 4:
          segs = [[1, 2]];
          break;
        case 5:
          segs = [
            [3, 0],
            [1, 2],
          ];
          break;
        case 6:
          segs = [[0, 2]];
          break;
        case 7:
          segs = [[3, 2]];
          break;
        case 8:
          segs = [[2, 3]];
          break;
        case 9:
          segs = [[0, 2]];
          break;
        case 10:
          segs = [
            [0, 1],
            [2, 3],
          ];
          break;
        case 11:
          segs = [[1, 2]];
          break;
        case 12:
          segs = [[1, 3]];
          break;
        case 13:
          segs = [[0, 1]];
          break;
        case 14:
          segs = [[3, 0]];
          break;
      }

      for (const [e1, e2] of segs) {
        const a = edgePoint(x, y, e1);
        const b = edgePoint(x, y, e2);
        addSeg(a, b);
      }
    }
  }

  // Stitch loops by walking edges
  const visited = new Set<string>();
  const loops: Point2[][] = [];

  for (const [start, neighbors] of adj.entries()) {
    for (const n0 of neighbors) {
      const ek0 = edgeKey(start, n0);
      if (visited.has(ek0)) continue;

      const loopKeys: IKey[] = [start];
      let prev: IKey = start;
      let curr: IKey = n0;
      visited.add(ek0);

      while (true) {
        loopKeys.push(curr);
        const neigh = adj.get(curr) ?? [];
        // pick next neighbor with unvisited edge
        let next: IKey | null = null;
        for (const cand of neigh) {
          if (cand === prev) continue;
          const ek = edgeKey(curr, cand);
          if (!visited.has(ek)) {
            next = cand;
            visited.add(ek);
            break;
          }
        }
        if (!next) {
          // dead-end; give up
          break;
        }
        prev = curr;
        curr = next;
        if (curr === start) {
          loopKeys.push(start);
          break;
        }
        if (loopKeys.length > (w + h) * 8) break;
      }

      if (
        loopKeys.length >= 6 &&
        loopKeys[0] === loopKeys[loopKeys.length - 1]
      ) {
        loops.push(loopKeys.map(parseIKey));
      }
    }
  }

  return loops;
}

function loopScreenToWorld(
  loop: Point2[],
  bounds: [number, number, number, number],
  maskWidth: number,
  maskHeight: number,
): Point2[] {
  const [left, bottom, right, top] = bounds;
  const dx = right - left;
  const dy = bottom - top; // y-down world; bottom > top
  return loop.map(([x, y]) => [
    left + (x / maskWidth) * dx,
    top + (y / maskHeight) * dy,
  ]);
}

function maskToViewportPolygon(
  mask: BrushMask,
  bounds: [number, number, number, number],
): [number, number][] | null {
  const { width, height, data } = mask;
  if (!width || !height) return null;

  const [left, bottom, right, top] = bounds;
  const dx = right - left;
  const dy = bottom - top; // y-down world; bottom > top

  if (dx === 0 || dy === 0) return null;

  const w = width;
  const h = height;
  let hull: [number, number][] | null = null;

  for (let y = 0; y < h; y++) {
    let runStart = -1;
    const rowOffset = y * w;
    for (let x = 0; x <= w; x++) {
      const inside = x < w && data[rowOffset + x] !== 0;
      if (inside && runStart === -1) {
        runStart = x;
      } else if (!inside && runStart !== -1) {
        const x0t = runStart / w;
        const x1t = x / w;
        const y0t = y / h;
        const y1t = (y + 1) / h;

        const x0 = left + x0t * dx;
        const x1 = left + x1t * dx;
        const y0 = top + y0t * dy;
        const y1 = top + y1t * dy;

        const rect: [number, number][] = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
          [x0, y0],
        ];
        if (!hull) {
          hull = rect;
        } else {
          const union = polygonUnion(hull, rect);
          if (union && union.length >= 3) {
            hull = union;
          }
        }
        runStart = -1;
      }
    }
  }

  if (!hull || hull.length < 3) return null;

  // Smooth jagged edges by simplifying in world units, scaled to approximately
  // a few screen pixels so that pixel-level stair-steps are removed while
  // preserving the overall shape and topology.
  const pxToWorld = Math.max(
    Math.abs(dx) / Math.max(1, w),
    Math.abs(dy) / Math.max(1, h),
  );
  const epsilonWorld = pxToWorld * 1.0;
  const simplified = simplifyClosedPolygon(hull as Point2[], epsilonWorld);

  return simplified && simplified.length >= 3 ? simplified : hull;
}

function computeBrushPolygon(
  strokePoints: Point2[],
  precomputedHull: [number, number][] | undefined,
  mask: BrushMask | null,
  brushRadiusPx: number,
  viewportZoom: number,
  brushViewBounds: [number, number, number, number] | null,
): [number, number][] | null {
  if (precomputedHull && precomputedHull.length >= 3) {
    return precomputedHull;
  }

  if (mask && brushViewBounds) {
    const fromMask = maskToViewportPolygon(mask, brushViewBounds);
    if (fromMask && fromMask.length >= 3) {
      return fromMask;
    }
  }

  if (strokePoints.length > 0 && brushRadiusPx > 0) {
    const hull = buildBrushHull(strokePoints, brushRadiusPx, viewportZoom);
    if (hull && hull.length >= 3) {
      return hull;
    }
  }

  return null;
}
/**
 * **Ephemeral UI state**: shapes, brush, overlay layers, SAM2, viewer bridge ( Deck viewState ),
 * channel visibility mirrors, `activeStoryIndex`, etc.
 *
 * The durable **exhibit story** (channels, waypoints, shape registry, image pixel size, cached `story.json`)
 * lives in {@link useDocumentStore}. Story **actions** on this store (`setStories`, …) update the document.
 *
 * Durable story data validates as {@link DocumentData} (`validateDocumentData` / `DocumentDataSchema`).
 */
export interface AppStore {
  // State
  overlayLayers: OverlayLayer[];
  activeTool: string;
  currentInteraction: InteractionCoordinate | null;
  drawingState: DrawingState;
  dragState: DragState;
  hoverState: HoverState;
  /** Ephemeral viewer/canvas annotations; persisted story shapes live in `useDocumentStore.shapes`. */
  shapes: Shape[];
  shapeGroups: ShapeGroup[];
  hiddenShapeIds: Set<string>;
  globalColor: [number, number, number, number];
  viewportZoom: number; // Current viewport zoom level for line width scaling
  // Brush tool state
  brushRadiusPx: number;
  brushMask: BrushMask | null;
  brushMaskVersion: number;
  brushMaskMaxResolution: number;
  brushViewportWidth: number;
  brushViewportHeight: number;
  brushViewBounds: [number, number, number, number] | null;
  brushLastScreenCoord: [number, number] | null;
  selectedShapeId: string | null;
  brushEditTargetId: string | null;
  brushEditMode: "add" | "subtract" | null;

  activeStoryIndex: number | null;

  /** Ephemeral camera / UI-state per waypoint, keyed by waypoint id. */
  waypointAuthoring: Map<string, AuthoringWaypointExtra>;

  /**
   * Waypoint row index whose annotations panel is mounted (inline or master-detail).
   * When set, shape mutations persist here even if `activeStoryIndex` differs.
   */
  authoringWaypointShapesIndex: number | null;
  setAuthoringWaypointShapesIndex: (index: number | null) => void;

  activeChannelGroupId: string | null;

  /**
   * When set, ImageViewer applies this waypoint’s camera using **live** viewer
   * pixel size from its ResizeObserver (not `viewerViewportSize`, which lags on
   * author ↔ preview layout changes).
   */
  targetWaypointCamera: ConfigWaypoint | null;

  /** Authoring: viewer annotation pick/hover/drag only while a waypoint detail editor is open. */
  authoringWaypointEditorOpen: boolean;
  setAuthoringWaypointEditorOpen: (open: boolean) => void;

  /** Layers panel: selected annotation ids (multi-select) for copy / keyboard shortcuts. */
  layersPanelSelectedShapeIds: string[];
  setLayersPanelSelectedShapeIds: (ids: string[]) => void;
  /** Layers panel: selected group id (single-select) for copy/flash. */
  layersPanelSelectedGroupId: string | null;
  setLayersPanelSelectedGroupId: (id: string | null) => void;
  /** Layers panel: transient pulse/flash request (e.g. copy/paste feedback). */
  layersPanelSelectionFlash: {
    token: number;
    shapeIds: string[];
    groupId: string | null;
  } | null;
  flashLayersPanelSelection: (payload: {
    shapeIds: string[];
    groupId: string | null;
  }) => void;
  /** Layers panel: optional selection request for paste feedback. */
  layersPanelSelectionRequest: {
    token: number;
    shapeIds: string[];
    groupId: string | null;
  } | null;
  requestLayersPanelSelection: (payload: {
    shapeIds: string[];
    groupId: string | null;
  }) => void;

  // Actions
  setActiveTool: (tool: string) => void;
  setCurrentInteraction: (interaction: InteractionCoordinate | null) => void;
  addOverlayLayer: (layer: OverlayLayer) => void;
  removeOverlayLayer: (layerId: string) => void;
  clearOverlayLayers: () => void;
  updateDrawingState: (updates: Partial<DrawingState>) => void;
  resetDrawingState: () => void;
  handleLayerCreate: (layer: OverlayLayer | null) => void;
  handleToolChange: (tool: string) => void;
  handleOverlayInteraction: (
    type: "click" | "dragStart" | "drag" | "dragEnd" | "hover",
    coordinate: [number, number, number],
  ) => void;

  addShape: (shape: Shape) => void;
  addShapesBatch: (items: Shape[]) => void;
  removeShape: (shapeId: string) => void;
  updateShape: (shapeId: string, updates: Partial<Shape>) => void;
  clearShapes: () => void;
  finalizeRectangle: () => void;

  /** Replace all rows from exhibit-shaped waypoints (converts to store rows). */
  setStories: (configWaypoints: ConfigWaypoint[]) => void;
  setActiveStory: (index: number | null) => void;
  addStory: (configWaypoint: ConfigWaypoint) => void;
  updateStory: (index: number, updates: Partial<ConfigWaypoint>) => void;
  removeStory: (index: number) => void;
  reorderStories: (fromIndex: number, toIndex: number) => void;

  // SAM2 magic wand: image fetcher for visible viewport region (set by ImageViewer)
  sam2ImageFetcher:
    | ((viewRect: ViewRect) => Promise<{
        float32Array: Float32Array;
        shape: [number, number, number, number];
      }>)
    | null;
  setSam2ImageFetcher: (
    fetcher:
      | ((viewRect: ViewRect) => Promise<{
          float32Array: Float32Array;
          shape: [number, number, number, number];
        }>)
      | null,
  ) => void;
  sam2Processing: boolean;
  setSam2Processing: (v: boolean) => void;
  sam2DebugImages: { encoded: string; mask: string } | null;
  setSam2DebugImages: (v: { encoded: string; mask: string } | null) => void;
  // SAM2: current viewer state for computing visible region at click time
  sam2ViewState: OrthographicViewState | null;
  setSam2ViewState: (vs: OrthographicViewState) => void;
  sam2ViewportSize: ViewportSize | null;
  setSam2ViewportSize: (size: ViewportSize) => void;

  viewerViewState: OrthographicViewState | null;
  setViewerViewState: (vs: OrthographicViewState) => void;
  viewerViewportSize: ViewportSize | null;
  setViewerViewportSize: (size: ViewportSize) => void;
  /**
   * Reference stack pixel size from the viewer (first loader `shape`), or null when
   * the viewer is absent or has not loaded. Waypoint math should prefer this over
   * `document.images[0]` so it stays aligned with Deck.
   */
  viewerReferenceImagePixelSize: ReferenceImagePixelSize | null;
  setViewerReferenceImagePixelSize: (
    size: ReferenceImagePixelSize | null,
  ) => void;
  /** True when OME-TIFF / DICOM tile stack layers all report `isLoaded` (see ImageViewer). */
  viewerImageLayersLoaded: boolean;
  setViewerImageLayersLoaded: (loaded: boolean) => void;
  squareViewportThumbnailCapture: (() => string | null) | null;
  setSquareViewportThumbnailCapture: (
    capture: (() => string | null) | null,
  ) => void;
  captureSquareViewportThumbnail: () => string | null;

  // Waypoint viewstate editing (Save does not persist — deferred)
  editingViewstateWaypointIndex: number | null;
  setEditingViewstateWaypointIndex: (index: number | null) => void;

  // Channel group and channel actions
  setActiveChannelGroup: (channelGroupId: string) => void;
  setChannelVisibilities: (vis: Record<string, boolean>) => void;
  setGroupChannelLists: (l: Record<string, string[]>) => void;
  setGroupNames: (l: Record<string, string>) => void;
  channelVisibilities: Record<string, boolean>;
  groupChannelLists: Record<string, string[]>;
  groupNames: Record<string, string>;

  finalizeEllipse: () => void;
  finalizeLasso: (points: [number, number][]) => void;
  finalizeLine: (hasArrowHead?: boolean) => void;
  finalizePolyline: (points: [number, number][]) => void;
  createTextShape: (
    position: [number, number],
    text: string,
    fontSize?: number,
  ) => void;
  createPointShape: (position: [number, number], radius?: number) => void;
  updateTextShape: (
    shapeId: string,
    newText: string,
    fontSize?: number,
  ) => void;
  updateShapeText: (shapeId: string, newText: string) => void;
  updateShapeLabel: (shapeId: string, newLabel: string) => void;
  setGlobalColor: (color: [number, number, number, number]) => void;
  setViewportZoom: (zoom: number) => void;
  showSquareViewportOverlay: boolean;
  setShowSquareViewportOverlay: (show: boolean) => void;
  setBrushRadiusPx: (radius: number) => void;
  setBrushViewport: (
    width: number,
    height: number,
    bounds: [number, number, number, number] | null,
  ) => void;
  clearBrushMask: () => void;
  brushPaintStart: (screenCoord: [number, number]) => void;
  brushPaint: (screenCoord: [number, number]) => void;
  brushPaintEnd: () => void;
  startBrushEdit: (shapeId: string, mode: "add" | "subtract") => void;
  stopBrushEdit: () => void;
  setSelectedShape: (shapeId: string | null) => void;
  finalizeBrush: (
    strokePoints: [number, number][],
    precomputedHull?: [number, number][],
  ) => void;

  toggleShapeVisibility: (shapeId: string) => void;

  startDrag: (shapeId: string, offset: [number, number]) => void;
  updateDrag: (coordinate: [number, number, number]) => void;
  endDrag: () => void;
  resetDragState: () => void;

  setHoveredShape: (shapeId: string | null) => void;

  // Group actions
  createGroup: (name?: string) => void;
  deleteGroup: (groupId: string) => void;
  addShapeToGroup: (groupId: string, shapeId: string) => void;
  removeShapeFromGroup: (groupId: string, shapeId: string) => void;
  toggleGroupExpanded: (groupId: string) => void;

  // Import waypoint shapes actions
  importWaypointShapes: (
    story: Waypoint,
    clearExisting?: boolean,
    /** When passed (e.g. from React), used for resolution so effects track `shapes` explicitly. */
    shapeRegistry?: StoryShape[],
  ) => void;
  /** Persist shapes into `document.waypoints[index]` and `document.shapes`. */
  persistImportedShapesToStory: (storyIndex: number) => void;

  // Waypoint camera (resolved inside ImageViewer for correct viewport coupling)
  setTargetWaypointCamera: (waypoint: ConfigWaypoint | null) => void;
  clearTargetWaypointCamera: () => void;
}

/** Persist canvas shapes to the waypoint row that is actually being annotated. */
function maybePersistShapesAfterMutation(get: () => AppStore) {
  const doc = useDocumentStore.getState();
  const waypoints = documentWaypoints(doc);
  const { width: iw, height: ih } = referenceImagePixelSizeForActions(get);
  if (waypoints.length === 0 || iw <= 0 || ih <= 0) {
    return;
  }
  const state = get();
  const authoring = state.authoringWaypointShapesIndex;
  const active = state.activeStoryIndex;
  const resolved =
    authoring !== null ? authoring : active !== null ? active : null;
  if (resolved === null) {
    return;
  }
  if (resolved < 0 || resolved >= waypoints.length) {
    return;
  }
  get().persistImportedShapesToStory(resolved);
}

// Initial state for overlay store
const overlayInitialState = {
  overlayLayers: [],
  activeTool: "move",
  currentInteraction: null,
  drawingState: {
    isDrawing: false,
    dragStart: null,
    dragEnd: null,
  },
  dragState: {
    isDragging: false,
    draggedShapeId: null,
    dragOffset: null,
  },
  hoverState: {
    hoveredShapeId: null,
  },
  shapes: [],
  shapeGroups: [],
  hiddenShapeIds: new Set<string>(),
  globalColor: [255, 255, 255, 255],
  viewportZoom: 0, // Default zoom level
  showSquareViewportOverlay: false,
  brushRadiusPx: 30,
  brushMask: null as BrushMask | null,
  brushMaskVersion: 0,
  brushMaskMaxResolution: 1024,
  brushViewportWidth: 0,
  brushViewportHeight: 0,
  brushViewBounds: null as [number, number, number, number] | null,
  brushLastScreenCoord: null as [number, number] | null,
  selectedShapeId: null as string | null,
  brushEditTargetId: null as string | null,
  brushEditMode: null as "add" | "subtract" | null,
  activeStoryIndex: null,
  waypointAuthoring: new Map<string, AuthoringWaypointExtra>(),
  authoringWaypointShapesIndex: null as number | null,
  activeChannelGroupId: null, // No channel group initially
  channelVisibilities: {},
  groupChannelLists: {},
  groupNames: {},
  targetWaypointCamera: null,
  authoringWaypointEditorOpen: false,
  layersPanelSelectedShapeIds: [] as string[],
  layersPanelSelectedGroupId: null as string | null,
  layersPanelSelectionFlash: null,
  layersPanelSelectionRequest: null,
  sam2ImageFetcher: null,
  sam2Processing: false,
  sam2DebugImages: null,
  sam2ViewState: null,
  sam2ViewportSize: null,
  viewerViewState: null,
  viewerViewportSize: null,
  viewerReferenceImagePixelSize: null,
  viewerImageLayersLoaded: false,
  squareViewportThumbnailCapture: null,
  editingViewstateWaypointIndex: null,
};

// App store (non-serialized UI + authoring actions; document lives in `useDocumentStore`).
export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      ...overlayInitialState,

      setActiveTool: (tool: string) => {
        set({
          activeTool: tool,
          brushEditTargetId: null,
          brushEditMode: null,
        });
      },

      setCurrentInteraction: (interaction: InteractionCoordinate | null) => {
        set({ currentInteraction: interaction });
      },

      addOverlayLayer: (layer: OverlayLayer) => {
        set((state) => {
          const filtered = state.overlayLayers.filter(
            (l) => l && l.id !== layer.id,
          );
          return { overlayLayers: [...filtered, layer] };
        });
      },

      removeOverlayLayer: (layerId: string) => {
        set((state) => ({
          overlayLayers: state.overlayLayers.filter(
            (l) => l && l.id !== layerId,
          ),
        }));
      },

      clearOverlayLayers: () => {
        set({ overlayLayers: [] });
      },

      updateDrawingState: (updates: Partial<DrawingState>) => {
        set((state) => ({
          drawingState: { ...state.drawingState, ...updates },
        }));
      },

      resetDrawingState: () => {
        set({ drawingState: overlayInitialState.drawingState });
      },

      handleLayerCreate: (layer: OverlayLayer | null) => {
        if (layer === null) {
          get().removeOverlayLayer("drawing-layer");
          return;
        }
        get().addOverlayLayer(layer);
      },

      handleToolChange: (tool: string) => {
        set({
          activeTool: tool,
          brushEditTargetId: null,
          brushEditMode: null,
        });
        get().resetDrawingState();
        get().resetDragState();
        get().removeOverlayLayer("drawing-layer");
        get().removeOverlayLayer("drawing-arrow-preview");
      },

      handleOverlayInteraction: (
        type: "click" | "dragStart" | "drag" | "dragEnd" | "hover",
        coordinate: [number, number, number],
      ) => {
        const interaction: InteractionCoordinate = { type, coordinate };
        set({ currentInteraction: interaction });

        const { activeTool, drawingState, dragState } = get();
        const [x, y] = coordinate;

        if (activeTool === "move") {
          if (!get().authoringWaypointEditorOpen) {
            return;
          }
          const { hoverState } = get();

          switch (type) {
            case "hover":
              break;
            case "click":
              if (hoverState.hoveredShapeId) {
                get().setSelectedShape(hoverState.hoveredShapeId);
              }
              break;
            case "dragStart":
              if (hoverState.hoveredShapeId) {
                const annotation = get().shapes.find(
                  (a) => a.id === hoverState.hoveredShapeId,
                );
                if (annotation) {
                  let offset: [number, number] = [0, 0];
                  if (
                    annotation.type === "text" ||
                    annotation.type === "point"
                  ) {
                    offset = [
                      x - annotation.position[0],
                      y - annotation.position[1],
                    ];
                  } else {
                    const firstPoint = annotation.polygon[0];
                    offset = [x - firstPoint[0], y - firstPoint[1]];
                  }

                  get().startDrag(hoverState.hoveredShapeId, offset);
                }
              }
              break;
            case "drag":
              if (dragState.isDragging) {
                get().updateDrag(coordinate);
              }
              break;
            case "dragEnd":
              if (dragState.isDragging) {
                get().endDrag();
              }
              break;
          }
          return;
        }

        const usesDrawingState =
          activeTool === "rectangle" ||
          activeTool === "ellipse" ||
          activeTool === "arrow" ||
          activeTool === "line";
        if (usesDrawingState) {
          switch (type) {
            case "click":
            case "dragStart":
              get().updateDrawingState({
                isDrawing: true,
                dragStart: [x, y],
                dragEnd: [x, y],
              });
              break;
            case "drag":
              if (drawingState.isDrawing) {
                get().updateDrawingState({
                  dragEnd: [x, y],
                });
              }
              break;
            case "dragEnd":
              if (drawingState.isDrawing) {
                get().updateDrawingState({
                  dragEnd: [x, y],
                });
                if (activeTool === "rectangle") {
                  setTimeout(() => get().finalizeRectangle(), 0);
                } else if (activeTool === "ellipse") {
                  setTimeout(() => get().finalizeEllipse(), 0);
                } else if (activeTool === "arrow" || activeTool === "line") {
                  setTimeout(
                    () => get().finalizeLine(activeTool === "arrow"),
                    0,
                  );
                }
              }
              break;
          }
        }
      },

      addShape: (shape: Shape) => {
        set((state) => ({
          shapes: [...state.shapes, shape],
        }));
        maybePersistShapesAfterMutation(get);
      },

      addShapesBatch: (items: Shape[]) => {
        if (items.length === 0) return;
        set((state) => ({
          shapes: [...state.shapes, ...items],
        }));
        maybePersistShapesAfterMutation(get);
      },

      removeShape: (shapeId: string) => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenShapeIds);
          newHiddenLayers.delete(shapeId);
          const newSelected =
            state.selectedShapeId === shapeId ? null : state.selectedShapeId;

          const clearingBrushEdit =
            state.brushEditTargetId === shapeId
              ? {
                  brushEditTargetId: null as string | null,
                  brushEditMode: null as "add" | "subtract" | null,
                }
              : {};

          return {
            shapes: state.shapes.filter((a) => a.id !== shapeId),
            hiddenShapeIds: newHiddenLayers,
            selectedShapeId: newSelected,
            ...clearingBrushEdit,
          };
        });
        maybePersistShapesAfterMutation(get);
      },

      updateShape: (shapeId: string, updates: Partial<Shape>) => {
        set((state) => ({
          shapes: state.shapes.map((a) =>
            a.id === shapeId ? ({ ...a, ...updates } as Shape) : a,
          ),
        }));
      },

      clearShapes: () => {
        set({ shapes: [] });
      },

      finalizeRectangle: () => {
        const { drawingState } = get();
        if (
          drawingState.isDrawing &&
          drawingState.dragStart &&
          drawingState.dragEnd
        ) {
          const [startX, startY] = drawingState.dragStart;
          const [endX, endY] = drawingState.dragEnd;

          const annotation: PolygonShape = {
            id: newShapeId(),
            type: "polygon",
            polygon: rectangleToPolygon([startX, startY], [endX, endY]),
            style: {
              fillColor: [
                get().globalColor[0],
                get().globalColor[1],
                get().globalColor[2],
                50,
              ],
              lineColor: get().globalColor,
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${get().shapes.length + 1}`,
            },
          };

          get().addShape(annotation);
          get().resetDrawingState();
          get().removeOverlayLayer("drawing-layer");
        }
      },

      finalizeEllipse: () => {
        const { drawingState } = get();
        if (
          drawingState.isDrawing &&
          drawingState.dragStart &&
          drawingState.dragEnd
        ) {
          const [startX, startY] = drawingState.dragStart;
          const [endX, endY] = drawingState.dragEnd;

          const annotation: PolygonShape = {
            id: newShapeId(),
            type: "polygon",
            polygon: ellipseToPolygon([startX, startY], [endX, endY]),
            style: {
              fillColor: [
                get().globalColor[0],
                get().globalColor[1],
                get().globalColor[2],
                50,
              ],
              lineColor: get().globalColor,
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${get().shapes.length + 1}`,
            },
          };

          get().addShape(annotation);
          get().resetDrawingState();
          get().removeOverlayLayer("drawing-layer");
        }
      },

      finalizeLasso: (points: [number, number][]) => {
        if (points.length >= 3) {
          const annotation: PolygonShape = {
            id: newShapeId(),
            type: "polygon",
            polygon: points,
            style: {
              fillColor: [
                get().globalColor[0],
                get().globalColor[1],
                get().globalColor[2],
                50,
              ], // Use global color with low opacity
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${get().shapes.length + 1}`,
            },
          };

          get().addShape(annotation);
          get().removeOverlayLayer("drawing-layer");
        }
      },

      finalizePolyline: (points: [number, number][]) => {
        if (points.length >= 2) {
          const annotation: PolylineShape = {
            id: newShapeId(),
            type: "polyline",
            polygon: points,
            style: {
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${get().shapes.length + 1}`,
            },
          };

          get().addShape(annotation);
          get().removeOverlayLayer("drawing-layer");
        }
      },

      finalizeLine: (hasArrowHead: boolean = true) => {
        const { drawingState } = get();
        if (
          drawingState.isDrawing &&
          drawingState.dragStart &&
          drawingState.dragEnd
        ) {
          const [startX, startY] = drawingState.dragStart;
          const [endX, endY] = drawingState.dragEnd;
          const linePolygon = arrowLineDegeneratePolygon(
            [startX, startY],
            [endX, endY],
          );

          const annotation: LineShape = {
            id: newShapeId(),
            type: "line",
            polygon: linePolygon,
            hasArrowHead,
            style: {
              fillColor: [0, 0, 0, 0] as [number, number, number, number], // Transparent fill
              lineColor: get().globalColor,
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${get().shapes.length + 1}`,
            },
          };

          get().addShape(annotation);
          get().resetDrawingState();
          get().removeOverlayLayer("drawing-layer");
        }
      },

      createTextShape: (
        position: [number, number],
        text: string,
        fontSize: number = 14,
      ) => {
        if (!text.trim()) {
          return;
        }

        const annotation: TextShape = {
          id: newShapeId(),
          type: "text",
          position: position,
          text: text.trim(),
          style: {
            fontSize: fontSize,
            fontColor: get().globalColor, // Use global color
            backgroundColor: [0, 0, 0, 100], // Semi-transparent black background
            padding: 4,
          },
          metadata: {
            label: `Untitled ${get().shapes.length + 1}`,
          },
        };

        get().addShape(annotation);
      },

      createPointShape: (position: [number, number], radius: number = 5) => {
        const annotation: PointShape = {
          id: newShapeId(),
          type: "point",
          position: position,
          style: {
            fillColor: get().globalColor, // Use global color for fill
            strokeColor: [255, 255, 255, 255], // White stroke
            radius: radius,
          },
          metadata: {
            label: `Untitled ${get().shapes.length + 1}`,
          },
        };

        get().addShape(annotation);
      },

      updateTextShape: (
        shapeId: string,
        newText: string,
        fontSize?: number,
      ) => {
        if (!newText.trim()) {
          return;
        }

        const shapes = get().shapes;
        const annotation = shapes.find((a) => a.id === shapeId);

        if (!annotation || annotation.type !== "text") {
          return;
        }

        const updates: Partial<TextShape> = {
          text: newText.trim(),
        };

        if (fontSize !== undefined) {
          updates.style = {
            ...annotation.style,
            fontSize: fontSize,
          };
        }

        get().updateShape(shapeId, updates);
      },

      updateShapeText: (shapeId: string, newText: string) => {
        const shapes = get().shapes;
        const annotation = shapes.find((a) => a.id === shapeId);
        if (!annotation) return;
        if (annotation.type === "text") {
          get().updateTextShape(shapeId, newText);
          return;
        }
        const updates: Partial<Shape> = {
          text: newText.trim() || undefined,
        };

        get().updateShape(shapeId, updates);
      },

      updateShapeLabel: (shapeId: string, newLabel: string) => {
        const trimmed = newLabel.trim();

        set((state) => ({
          shapes: state.shapes.map((annotation) => {
            if (annotation.id !== shapeId) {
              return annotation;
            }

            const nextMetadata = {
              ...(annotation.metadata ?? {}),
              label: trimmed || undefined,
            };

            return {
              ...annotation,
              metadata: nextMetadata,
            } as Shape;
          }),
        }));
      },

      setGlobalColor: (color: [number, number, number, number]) => {
        set({ globalColor: color });
      },

      setViewportZoom: (zoom: number) => {
        set({ viewportZoom: zoom });
      },

      setShowSquareViewportOverlay: (show: boolean) => {
        set({ showSquareViewportOverlay: show });
      },

      setBrushRadiusPx: (radius: number) => {
        set({ brushRadiusPx: radius });
      },

      setBrushViewport: (
        width: number,
        height: number,
        bounds: [number, number, number, number] | null,
      ) => {
        set({
          brushViewportWidth: width,
          brushViewportHeight: height,
          brushViewBounds: bounds,
        });
      },

      clearBrushMask: () => {
        set({ brushMask: null, brushMaskVersion: 0 });
      },

      brushPaintStart: (screenCoord: [number, number]) => {
        const state = get();
        const { brushViewportWidth, brushViewportHeight, brushRadiusPx } =
          state;
        if (
          brushViewportWidth <= 0 ||
          brushViewportHeight <= 0 ||
          brushRadiusPx <= 0
        )
          return;
        const mask = ensureBrushMaskViewport(
          brushViewportWidth,
          brushViewportHeight,
          null,
        );
        paintCircleOnMaskScreen(
          mask,
          screenCoord[0],
          screenCoord[1],
          brushRadiusPx,
        );
        set({
          brushMask: mask,
          brushMaskVersion: 1,
          brushLastScreenCoord: screenCoord,
        });
      },

      brushPaint: (screenCoord: [number, number]) => {
        const state = get();
        const mask = state.brushMask;
        if (!mask) return;
        const { brushRadiusPx } = state;

        const [x2, y2] = screenCoord;
        const last = state.brushLastScreenCoord;

        if (!last) {
          // No previous point: just stamp once and record this coord.
          paintCircleOnMaskScreen(mask, x2, y2, brushRadiusPx);
          set({
            brushMask: { ...mask },
            brushMaskVersion: state.brushMaskVersion + 1,
            brushLastScreenCoord: screenCoord,
          });
          return;
        }

        const [x1, y1] = last;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);

        if (dist === 0) {
          paintCircleOnMaskScreen(mask, x2, y2, brushRadiusPx);
        } else {
          // Step at most half a brush radius in screen space to avoid gaps.
          const step = Math.max(1, brushRadiusPx * 0.5);
          const steps = Math.max(1, Math.ceil(dist / step));
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const sx = x1 + dx * t;
            const sy = y1 + dy * t;
            paintCircleOnMaskScreen(mask, sx, sy, brushRadiusPx);
          }
        }

        set({
          brushMask: { ...mask },
          brushMaskVersion: state.brushMaskVersion + 1,
          brushLastScreenCoord: screenCoord,
        });
      },

      brushPaintEnd: () => {
        const state = get();
        const mask = state.brushMask;
        const bounds = state.brushViewBounds;

        let hull: [number, number][] | undefined;
        if (mask && bounds) {
          const loops = maskToLoops(mask);
          const w = mask.width;
          const h = mask.height;
          const pxToWorld = Math.max(
            Math.abs(bounds[2] - bounds[0]) / Math.max(1, w),
            Math.abs(bounds[1] - bounds[3]) / Math.max(1, h),
          );
          const epsilonWorld = pxToWorld * 1.0;

          // Convert loops to world coords, simplify, and keep only outer
          // boundaries (positive signed area). Inner hole loops have
          // negative signed area and are discarded.
          const outerLoops: Point2[][] = [];
          for (const loop of loops) {
            const worldLoop = loopScreenToWorld(loop, bounds, w, h);
            const simplified = simplifyClosedPolygon(worldLoop, epsilonWorld);
            if (simplified.length < 4) continue;
            const area = signedPolygonArea(simplified);
            if (area > 0) {
              outerLoops.push(simplified);
            }
          }

          // If no outer loops matched with positive area, try negative
          // (winding direction depends on coordinate system orientation).
          if (outerLoops.length === 0) {
            for (const loop of loops) {
              const worldLoop = loopScreenToWorld(loop, bounds, w, h);
              const simplified = simplifyClosedPolygon(worldLoop, epsilonWorld);
              if (simplified.length < 4) continue;
              const area = signedPolygonArea(simplified);
              if (area < 0) {
                outerLoops.push(simplified);
              }
            }
          }

          if (outerLoops.length === 1) {
            hull = outerLoops[0] as [number, number][];
          } else if (outerLoops.length > 1) {
            // Union all outer boundary loops together.
            let accHull: [number, number][] | null = outerLoops[0] as [
              number,
              number,
            ][];
            for (let i = 1; i < outerLoops.length; i++) {
              const union = polygonUnion(
                accHull,
                outerLoops[i] as [number, number][],
              );
              if (union && union.length >= 4) accHull = union;
            }
            if (accHull && accHull.length >= 4) {
              hull = accHull;
            }
          }
        }

        // Delegate polygon creation / editing logic to finalizeBrush so that all
        // brush finalization paths share the same behavior.
        get().finalizeBrush([], hull);

        // Reset last screen coordinate for the next stroke.
        set({ brushLastScreenCoord: null });
      },

      startBrushEdit: (shapeId: string, mode: "add" | "subtract") => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenShapeIds);
          if (newHiddenLayers.has(shapeId)) {
            newHiddenLayers.delete(shapeId);
          }

          return {
            activeTool: "brush",
            brushEditTargetId: shapeId,
            brushEditMode: mode,
            hiddenShapeIds: newHiddenLayers,
            selectedShapeId: shapeId,
          };
        });
      },

      stopBrushEdit: () => {
        set({
          brushEditTargetId: null,
          brushEditMode: null,
        });
      },

      setSelectedShape: (shapeId: string | null) => {
        set({ selectedShapeId: shapeId });
      },

      finalizeBrush: (
        strokePoints: [number, number][],
        precomputedHull?: [number, number][],
      ) => {
        const state = get();
        const {
          brushRadiusPx,
          viewportZoom,
          brushMask,
          brushViewBounds,
          brushEditTargetId,
          brushEditMode,
          shapes: brushShapes,
          globalColor,
        } = state;

        const overlayPolygon = computeBrushPolygon(
          strokePoints,
          precomputedHull,
          brushMask,
          brushRadiusPx,
          viewportZoom,
          brushViewBounds,
        );

        if (!overlayPolygon || overlayPolygon.length < 3) {
          set({ brushMask: null, brushMaskVersion: 0 });
          return;
        }

        if (brushEditTargetId && brushEditMode) {
          const target = brushShapes.find((a) => a.id === brushEditTargetId);
          if (target && target.type === "polygon") {
            const basePolygon = target.polygon;
            const nextPolygon =
              brushEditMode === "add"
                ? (() => {
                    // If the brush stroke does not touch the original polygon at
                    // all, treat it as a no-op in add mode.
                    const touches = polygonsOverlap(
                      basePolygon as Point2[],
                      overlayPolygon as Point2[],
                    );
                    if (!touches) {
                      return basePolygon;
                    }
                    return polygonUnion(basePolygon, overlayPolygon);
                  })()
                : polygonDifference(basePolygon, overlayPolygon);

            if (
              nextPolygon &&
              nextPolygon.length >= 3 &&
              nextPolygon !== basePolygon
            ) {
              get().updateShape(brushEditTargetId, {
                polygon: nextPolygon,
              } as Partial<Shape>);
            }
          }
        } else {
          const annotation: PolygonShape = {
            id: newShapeId(),
            type: "polygon",
            polygon: overlayPolygon,
            style: {
              fillColor: [0, 0, 0, 0],
              lineColor: globalColor,
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${brushShapes.length + 1}`,
            },
          };
          get().addShape(annotation);
        }

        get().removeOverlayLayer("drawing-layer");
        // Clear mask after finalizing this brush annotation
        set({ brushMask: null, brushMaskVersion: 0 });
      },

      toggleShapeVisibility: (shapeId: string) => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenShapeIds);
          if (newHiddenLayers.has(shapeId)) {
            newHiddenLayers.delete(shapeId);
          } else {
            newHiddenLayers.add(shapeId);
          }
          return { hiddenShapeIds: newHiddenLayers };
        });
      },

      startDrag: (shapeId: string, offset: [number, number]) => {
        set({
          dragState: {
            isDragging: true,
            draggedShapeId: shapeId,
            dragOffset: offset,
          },
        });
      },

      updateDrag: (coordinate: [number, number, number]) => {
        const { dragState, shapes: dragShapes } = get();
        if (
          dragState.isDragging &&
          dragState.draggedShapeId &&
          dragState.dragOffset
        ) {
          const [x, y] = coordinate;
          const [offsetX, offsetY] = dragState.dragOffset;

          // Calculate new position based on drag offset
          const newX = x - offsetX;
          const newY = y - offsetY;

          // Find the annotation being dragged
          const annotation = dragShapes.find(
            (a) => a.id === dragState.draggedShapeId,
          );
          if (annotation) {
            if (annotation.type === "text" || annotation.type === "point") {
              const updatedAnnotation = {
                ...annotation,
                position: [newX, newY] as [number, number],
              };
              get().updateShape(dragState.draggedShapeId, updatedAnnotation);
            } else {
              const deltaX = newX - annotation.polygon[0][0];
              const deltaY = newY - annotation.polygon[0][1];
              const updatedPolygon = annotation.polygon.map(
                ([px, py]) => [px + deltaX, py + deltaY] as [number, number],
              );

              get().updateShape(dragState.draggedShapeId, {
                ...annotation,
                polygon: updatedPolygon,
              });
            }
          }
        }
      },

      endDrag: () => {
        set({
          dragState: {
            isDragging: false,
            draggedShapeId: null,
            dragOffset: null,
          },
        });
        maybePersistShapesAfterMutation(get);
      },

      resetDragState: () => {
        set({ dragState: overlayInitialState.dragState });
      },

      setHoveredShape: (shapeId: string | null) => {
        set({
          hoverState: {
            hoveredShapeId: shapeId,
          },
        });
      },

      setAuthoringWaypointEditorOpen: (open: boolean) => {
        if (open) {
          set({ authoringWaypointEditorOpen: true });
        } else {
          set({
            authoringWaypointEditorOpen: false,
            hoverState: overlayInitialState.hoverState,
            dragState: overlayInitialState.dragState,
          });
        }
      },

      setAuthoringWaypointShapesIndex: (index: number | null) => {
        set({ authoringWaypointShapesIndex: index });
      },

      setLayersPanelSelectedShapeIds: (ids: string[]) => {
        set({ layersPanelSelectedShapeIds: [...ids] });
      },

      setLayersPanelSelectedGroupId: (id: string | null) => {
        set({ layersPanelSelectedGroupId: id });
      },

      flashLayersPanelSelection: (payload) => {
        set({
          layersPanelSelectionFlash: {
            token: Date.now(),
            shapeIds: [...payload.shapeIds],
            groupId: payload.groupId,
          },
        });
      },

      requestLayersPanelSelection: (payload) => {
        set({
          layersPanelSelectionRequest: {
            token: Date.now(),
            shapeIds: [...payload.shapeIds],
            groupId: payload.groupId,
          },
        });
      },

      // Group actions
      createGroup: (name?: string) => {
        const groupCount = get().shapeGroups.length;
        const newGroup: ShapeGroup = {
          id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name || `Group ${groupCount + 1}`,
          shapeIds: [],
          isExpanded: true,
        };
        set((state) => ({
          shapeGroups: [...state.shapeGroups, newGroup],
        }));
      },

      deleteGroup: (groupId: string) => {
        set((state) => ({
          shapeGroups: state.shapeGroups.filter((g) => g.id !== groupId),
        }));
      },

      addShapeToGroup: (groupId: string, shapeId: string) => {
        set((state) => ({
          shapeGroups: state.shapeGroups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  shapeIds: [...group.shapeIds, shapeId],
                }
              : group,
          ),
        }));
      },

      removeShapeFromGroup: (groupId: string, shapeId: string) => {
        set((state) => ({
          shapeGroups: state.shapeGroups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  shapeIds: group.shapeIds.filter((id) => id !== shapeId),
                }
              : group,
          ),
        }));
      },

      toggleGroupExpanded: (groupId: string) => {
        set((state) => ({
          shapeGroups: state.shapeGroups.map((group) =>
            group.id === groupId
              ? { ...group, isExpanded: !group.isExpanded }
              : group,
          ),
        }));
      },

      setStories: (configWaypoints: ConfigWaypoint[]) => {
        const doc = useDocumentStore.getState();
        const { width: iw, height: ih } =
          referenceImagePixelSizeForActions(get);
        const vp = authoringViewportForDoc(get);
        const nextAuthoring = new Map<string, AuthoringWaypointExtra>();
        const waypoints = configWaypoints.map((w) => {
          const { waypoint, authoring } = configWaypointToWaypoint(
            hydrateConfigWaypoint(w, doc.channelGroups),
            iw,
            ih,
            vp.width,
            vp.height,
          );
          nextAuthoring.set(waypoint.id, authoring);
          return waypoint;
        });
        doc.setWaypoints(waypoints);
        set({ activeStoryIndex: null, waypointAuthoring: nextAuthoring });
      },

      setActiveStory: (index: number | null) => {
        set({ activeStoryIndex: index });
      },

      addStory: (configWaypoint: ConfigWaypoint) => {
        const doc = useDocumentStore.getState();
        const { width: iw, height: ih } =
          referenceImagePixelSizeForActions(get);
        const vp = authoringViewportForDoc(get);
        const { waypoint, authoring } = configWaypointToWaypoint(
          hydrateConfigWaypoint(configWaypoint, doc.channelGroups),
          iw,
          ih,
          vp.width,
          vp.height,
        );
        doc.setWaypoints([...doc.waypoints, waypoint]);
        set((s) => {
          const next = new Map(s.waypointAuthoring);
          next.set(waypoint.id, authoring);
          return { waypointAuthoring: next };
        });
      },

      updateStory: (index: number, updates: Partial<ConfigWaypoint>) => {
        const doc = useDocumentStore.getState();
        const wp = doc.waypoints[index];
        if (!wp) return;
        const vp = authoringViewportForDoc(get);
        const existingAuthoring = get().waypointAuthoring.get(wp.id);
        const asConfig = waypointToConfigWaypoint(wp, existingAuthoring);
        let merged: ConfigWaypoint = { ...asConfig, ...updates };
        const shouldDropLegacyViewKeys = Object.hasOwn(updates, "Bounds");
        if (shouldDropLegacyViewKeys) {
          const { Pan: _pan, Zoom: _zoom, ...withoutPanZoom } = merged;
          if (Object.hasOwn(updates, "ViewState")) {
            merged = withoutPanZoom as ConfigWaypoint;
          } else {
            const { ViewState: _vs, ...rest } = withoutPanZoom;
            merged = rest as ConfigWaypoint;
          }
        }
        const { width: iw, height: ih } =
          referenceImagePixelSizeForActions(get);
        const { waypoint: nextWp, authoring } = configWaypointToWaypoint(
          merged,
          iw,
          ih,
          vp.width,
          vp.height,
        );
        const waypoints = [...doc.waypoints];
        waypoints[index] = nextWp;
        doc.setWaypoints(waypoints);
        set((s) => {
          const next = new Map(s.waypointAuthoring);
          next.set(nextWp.id, authoring);
          return { waypointAuthoring: next };
        });
      },

      removeStory: (index: number) => {
        const doc = useDocumentStore.getState();
        const removedId = doc.waypoints[index]?.id;
        if (index >= 0 && index < doc.waypoints.length) {
          doc.setWaypoints(doc.waypoints.filter((_, i) => i !== index));
        }
        set((state) => {
          const next = new Map(state.waypointAuthoring);
          if (removedId) next.delete(removedId);
          return {
            waypointAuthoring: next,
            activeStoryIndex:
              state.activeStoryIndex === index
                ? null
                : state.activeStoryIndex && state.activeStoryIndex > index
                  ? state.activeStoryIndex - 1
                  : state.activeStoryIndex,
          };
        });
      },

      reorderStories: (fromIndex: number, toIndex: number) => {
        const doc = useDocumentStore.getState();
        const next = [...doc.waypoints];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        doc.setWaypoints(next);
        set((state) => {
          let newActiveStoryIndex = state.activeStoryIndex;
          if (state.activeStoryIndex !== null) {
            if (state.activeStoryIndex === fromIndex) {
              newActiveStoryIndex = toIndex;
            } else if (
              fromIndex < state.activeStoryIndex &&
              toIndex >= state.activeStoryIndex
            ) {
              newActiveStoryIndex = state.activeStoryIndex - 1;
            } else if (
              fromIndex > state.activeStoryIndex &&
              toIndex <= state.activeStoryIndex
            ) {
              newActiveStoryIndex = state.activeStoryIndex + 1;
            }
          }
          return { activeStoryIndex: newActiveStoryIndex };
        });
      },
      setGroupNames: (o: Record<string, string>) => {
        set({ groupNames: o });
      },

      setGroupChannelLists: (o: Record<string, string[]>) => {
        set({ groupChannelLists: o });
      },

      setSam2ImageFetcher: (fetcher) => {
        set({ sam2ImageFetcher: fetcher });
      },

      setSam2Processing: (v) => {
        set({ sam2Processing: v });
      },

      setSam2DebugImages: (v) => {
        set({ sam2DebugImages: v });
      },

      setSam2ViewState: (vs) => {
        set({ sam2ViewState: vs });
      },

      setSam2ViewportSize: (size) => {
        set({ sam2ViewportSize: size });
      },
      setViewerViewState: (vs) => {
        set({ viewerViewState: vs });
      },

      setViewerViewportSize: (size) => {
        set({ viewerViewportSize: size });
      },

      setViewerReferenceImagePixelSize: (size) => {
        set({ viewerReferenceImagePixelSize: size });
      },

      setViewerImageLayersLoaded: (loaded) => {
        set({ viewerImageLayersLoaded: loaded });
      },

      setSquareViewportThumbnailCapture: (capture) => {
        set({ squareViewportThumbnailCapture: capture });
      },

      captureSquareViewportThumbnail: () => {
        const capture = get().squareViewportThumbnailCapture;
        if (!capture) return null;
        return capture();
      },

      setEditingViewstateWaypointIndex: (index) => {
        set({ editingViewstateWaypointIndex: index });
      },

      setChannelVisibilities: (vis: Record<string, boolean>) => {
        set({ channelVisibilities: vis });
      },

      // Import waypoint shapes actions
      importWaypointShapes: (
        story: Waypoint,
        clearExisting: boolean = false,
        shapeRegistry?: StoryShape[],
      ) => {
        const doc0 = useDocumentStore.getState();
        const { width: imageWidth, height: imageHeight } =
          referenceImagePixelSizeForActions(get);
        const fromStore = documentShapes(doc0);
        const shapesForLookup =
          shapeRegistry === undefined
            ? fromStore
            : (() => {
                const merged = new Map(
                  fromStore.map((s) => [s.id, s] as const),
                );
                for (const s of shapeRegistry) {
                  merged.set(s.id, s);
                }
                return [...merged.values()];
              })();

        if (imageWidth === 0 || imageHeight === 0) {
          return;
        }

        const shapeIds = story.shapeIds ?? [];
        if (
          clearExisting &&
          shapeIds.length > 0 &&
          shapesForLookup.length === 0
        ) {
          // Registry not hydrated yet (e.g. ItemRegistry.Shapes after Stories); skip so we
          // don't clear imported overlays and re-import nothing.
          return;
        }

        const shapeById = new Map(shapesForLookup.map((s) => [s.id, s]));

        const newAnnotations: Shape[] = [];
        for (const id of shapeIds) {
          const sh = shapeById.get(id);
          if (sh)
            newAnnotations.push(
              storyShapeToViewer(sh, { imageWidth, imageHeight }),
            );
        }

        // Remove prior imported overlays when `clearExisting`; keep non-imported until
        // persist marks them (see `persistImportedShapesToStory`). Re-run when `Shapes`
        // updates to add missing ids.
        set((state) =>
          mergeShapesAfterWaypointImport(state, newAnnotations, clearExisting),
        );
      },

      persistImportedShapesToStory: (storyIndex: number) => {
        const state = get();
        const doc = useDocumentStore.getState();
        const waypoints = documentWaypoints(doc);
        const row = waypoints[storyIndex];
        const { width: iw, height: ih } =
          referenceImagePixelSizeForActions(get);
        if (!row || iw <= 0 || ih <= 0) {
          return;
        }
        const hadStored = (row.shapeIds?.length ?? 0) > 0;
        if (state.shapes.length === 0 && !hadStored) {
          return;
        }
        if (state.shapes.length === 0 && hadStored) {
          const prevShapesList = documentShapes(doc);
          const merged = mergeShapesForWaypointPersist({
            waypoints: waypoints,
            waypointIndex: storyIndex,
            prevShapes: prevShapesList,
            builtShapes: [],
            newShapeIdsOrdered: [],
          });
          if (JSON.stringify(merged) !== JSON.stringify(prevShapesList)) {
            useDocumentStore.getState().setShapes(merged);
          }
          get().updateStory(storyIndex, {
            shapeIds: [],
          });
          return;
        }
        const builtShapes = viewerShapesToStoryShapes(state.shapes);
        const newShapeIdsOrdered = builtShapes.map((s) => s.id);
        const prevShapesList = documentShapes(doc);
        const merged = mergeShapesForWaypointPersist({
          waypoints: waypoints,
          waypointIndex: storyIndex,
          prevShapes: prevShapesList,
          builtShapes,
          newShapeIdsOrdered,
        });
        const prevIds = JSON.stringify(row.shapeIds ?? []);
        const nextIds = JSON.stringify(newShapeIdsOrdered);
        const prevShapesJson = JSON.stringify(prevShapesList);
        const nextShapesJson = JSON.stringify(merged);
        if (prevIds === nextIds && prevShapesJson === nextShapesJson) {
          return;
        }
        useDocumentStore.getState().setShapes(merged);
        get().updateStory(storyIndex, {
          shapeIds: newShapeIdsOrdered,
        });
        const idSet = new Set(newShapeIdsOrdered);
        set((s) => ({
          shapes: s.shapes.map((shape) =>
            idSet.has(shape.id)
              ? ({
                  ...shape,
                  metadata: { ...shape.metadata, isImported: true },
                } as Shape)
              : shape,
          ),
        }));
      },

      setActiveChannelGroup: (channelGroupId: string) => {
        const doc = useDocumentStore.getState();
        const flat = flattenImageChannelsInDocumentOrder(doc.images);
        const group = doc.channelGroups.find((g) => g.id === channelGroupId);
        const names: string[] = [];
        if (group) {
          for (const gc of group.channels) {
            const sc = findSourceChannel(flat, gc.channelId);
            if (sc?.name) names.push(sc.name);
          }
        }
        set({
          activeChannelGroupId: channelGroupId,
          channelVisibilities: Object.fromEntries(names.map((n) => [n, true])),
        });
      },

      setTargetWaypointCamera: (waypoint) => {
        const next =
          waypoint === null ? null : ({ ...waypoint } as ConfigWaypoint);
        set({ targetWaypointCamera: next });
      },

      clearTargetWaypointCamera: () => {
        set({ targetWaypointCamera: null });
      },
    }),
    {
      name: "appStore",
    },
  ),
);
