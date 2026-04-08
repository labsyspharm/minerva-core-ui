import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { documentStore } from "./document-store";

export type { ConfigGroup } from "./document-store";

import type { OrthographicViewState } from "@deck.gl/core";
import { arrowLineDegeneratePolygon } from "./annotationGeometry";
import { mergeAnnotationsAfterWaypointImport } from "./annotationWaypointImport";
import { buildBrushHull } from "./brushHull";
import type { ConfigWaypoint } from "./config";
import type { DocumentStore } from "./document-store";
import {
  configWaypointToStoreStoryWaypoint,
  downloadStoryDocument,
  exportStoryDocument,
  STORY_JSON_VERSION,
  type StoreStoryWaypoint,
  type StoryDocument,
  storeStoryWaypointToConfigWaypoint,
} from "./exportStory";

export type {
  StoreStoryWaypoint,
  StoryDocument,
  StoryWaypoint,
} from "./exportStory";

import { polygonDifference, polygonUnion } from "./polygonClipping";
import type { ViewportSize, ViewRect } from "./samViewport";
import {
  annotationsToShapes,
  mergeShapesForWaypointPersist,
  type StoryShape,
  shapeToAnnotation,
} from "./storyShapes";

function newAnnotationId(): string {
  return crypto.randomUUID();
}

// Types for the overlay store
export interface OverlayLayer {
  id: string;
}

type BrushMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

// Legacy image-aligned brush helpers (kept for reference, currently unused).
// function ensureBrushMask(...) { ... }
// function paintCircleOnMask(...) { ... }

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

// Legacy utility, no longer used.
// function polygonArea(poly: Point2[]): number { ... }

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

// New annotation types - all using polygon coordinates internally
type ColorRGBA = [number, number, number, number];

/** Shared optional metadata on annotations (labels, import provenance). */
export type AnnotationCommonMetadata = {
  createdAt?: Date;
  label?: string;
  description?: string;
  isImported?: boolean;
};

export interface PolygonAnnotation {
  id: string;
  type: "polygon";
  polygon: [number, number][]; // Keep as polygon coordinates
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: AnnotationCommonMetadata;
}

export interface LineAnnotation {
  id: string;
  type: "line";
  polygon: [number, number][]; // Simple line as degenerate polygon for stroke-based rendering
  hasArrowHead?: boolean; // When true (default), render as arrow icon; when false, render as plain stroke
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: AnnotationCommonMetadata;
}

export interface PolylineAnnotation {
  id: string;
  type: "polyline";
  polygon: [number, number][]; // Polyline points as polygon coordinates
  style: {
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: AnnotationCommonMetadata;
}

export interface TextAnnotation {
  id: string;
  type: "text";
  position: [number, number]; // Text position
  text: string; // The text content
  style: {
    fontSize: number;
    fontColor: [number, number, number, number];
    backgroundColor?: [number, number, number, number];
    padding?: number;
  };
  metadata?: AnnotationCommonMetadata;
}

export interface PointAnnotation {
  id: string;
  type: "point";
  position: [number, number]; // Point position
  style: {
    fillColor: [number, number, number, number];
    strokeColor: [number, number, number, number];
    radius: number; // Point radius in pixels
  };
  text?: string; // Optional text content to display within the shape
  metadata?: AnnotationCommonMetadata;
}

export type Annotation = (
  | PolygonAnnotation
  | LineAnnotation
  | PolylineAnnotation
  | TextAnnotation
  | PointAnnotation
) & {
  color?: [number, number, number, number];
};

// Annotation Group interface
export interface AnnotationGroup {
  id: string;
  name: string;
  annotationIds: string[]; // IDs of annotations in this group
  isExpanded: boolean; // Whether the group is expanded in the UI
  metadata?: {
    createdAt?: Date;
    color?: [number, number, number, number]; // Optional group color
  };
}

// Helper functions to convert shapes to polygon coordinates
export const rectangleToPolygon = (
  start: [number, number],
  end: [number, number],
): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);

  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY], // Close the polygon
  ];
};

// Helper function to convert bounding box to ellipse polygon
export const ellipseToPolygon = (
  start: [number, number],
  end: [number, number],
  segments: number = 64,
): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  // Calculate center and radii
  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const radiusX = Math.abs(endX - startX) / 2;
  const radiusY = Math.abs(endY - startY) / 2;

  // Generate points around the ellipse
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    points.push([x, y]);
  }

  return points;
};

export const lineToPolygon = (
  start: [number, number],
  end: [number, number],
  lineWidth: number = 3,
): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  // Calculate perpendicular vector for line width
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    // If line has no length, create a small square
    const halfWidth = lineWidth / 2;
    return [
      [startX - halfWidth, startY - halfWidth],
      [startX + halfWidth, startY - halfWidth],
      [startX + halfWidth, startY + halfWidth],
      [startX - halfWidth, startY + halfWidth],
      [startX - halfWidth, startY - halfWidth],
    ];
  }

  // Normalize and create perpendicular vector
  const nx = -dy / length;
  const ny = dx / length;
  const halfWidth = lineWidth / 2;

  return [
    [startX + nx * halfWidth, startY + ny * halfWidth],
    [endX + nx * halfWidth, endY + ny * halfWidth],
    [endX - nx * halfWidth, endY - ny * halfWidth],
    [startX - nx * halfWidth, startY - ny * halfWidth],
    [startX + nx * halfWidth, startY + ny * halfWidth], // Close the polygon
  ];
};

export const isPointInPolygon = (
  point: [number, number],
  polygon: [number, number][],
): boolean => {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

export const textToPolygon = (
  position: [number, number],
  text: string,
  fontSize: number = 14,
  _padding: number = 4,
): [number, number][] => {
  const [x, y] = position;

  // Estimate text dimensions with better approximation
  const charWidth = fontSize * 0.7; // More accurate character width
  const textWidth = text.length * charWidth;
  const textHeight = fontSize * 1.2; // Account for line height

  // Add VERY generous padding for easy hit detection
  // Make the hit area much larger than the actual text
  const hitPadding = Math.max(fontSize * 2, 20); // Much larger padding - at least 2x font size or 20px
  const halfWidth = (textWidth + hitPadding * 2) / 2;
  const halfHeight = (textHeight + hitPadding * 2) / 2;

  return [
    [x - halfWidth, y - halfHeight],
    [x + halfWidth, y - halfHeight],
    [x + halfWidth, y + halfHeight],
    [x - halfWidth, y + halfHeight],
    [x - halfWidth, y - halfHeight], // Close the polygon
  ];
};

export interface InteractionCoordinate {
  type: "click" | "dragStart" | "drag" | "dragEnd" | "hover";
  coordinate: [number, number, number];
}

export interface DrawingState {
  isDrawing: boolean;
  dragStart: [number, number] | null;
  dragEnd: [number, number] | null;
}

export interface DragState {
  isDragging: boolean;
  draggedAnnotationId: string | null;
  dragOffset: [number, number] | null;
}

export interface HoverState {
  hoveredAnnotationId: string | null;
}

/**
 * Annotation / viewport UI state + story authoring.
 *
 * **Serializable story (`story.json`)** — not a separate Zustand slice: the
 * wire-shaped snapshot is **`storyDocument`** (`version`, `waypoints`, `shapes`).
 * It is derived-only: `syncStoryDocument()` calls {@link exportStoryDocument}.
 *
 * **Sources for that export**
 * - **`stories`** — each row is {@link StoreStoryWaypoint}: serialized waypoint
 *   fields (`id`, `title`, `content`, `viewport`, `shapes` UUIDs, …) plus runtime
 *   camera keys from `ConfigWaypoint` (`State`, `Pan`, …). Mutators often accept
 *   `ConfigWaypoint` and convert internally.
 * - **`Shapes`** — merged in from {@link ./document-store.ts `DocumentStore`};
 *   global geometry registry keyed by UUID; referenced by each waypoint’s
 *   `shapes[]` list.
 *
 * Runtime-only layers (`annotations`, brush state, …) are **not** part of
 * `storyDocument`; they hydrate from a waypoint via `importWaypointAnnotations`.
 *
 * **Naming:** Zustand **`stories`** are narrative waypoint rows (one tab in the
 * author list ≈ one entry in `storyDocument.waypoints`). That is **not** the
 * exhibit playback type `Story[]` in `exhibit.ts`.
 */
export interface OverlayStore {
  // State
  overlayLayers: OverlayLayer[];
  activeTool: string;
  currentInteraction: InteractionCoordinate | null;
  drawingState: DrawingState;
  dragState: DragState; // New: drag state for move tool
  hoverState: HoverState; // New: hover state for move tool
  annotations: Annotation[]; // New: persistent annotations
  annotationGroups: AnnotationGroup[]; // New: annotation groups
  hiddenLayers: Set<string>; // New: track hidden layers
  globalColor: [number, number, number, number]; // New: global drawing color
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
  selectedAnnotationId: string | null;
  brushEditTargetId: string | null;
  brushEditMode: "add" | "subtract" | null;

  /** See {@link OverlayStore} — source rows for `storyDocument.waypoints` + camera. */
  stories: StoreStoryWaypoint[];
  activeStoryIndex: number | null;

  // Channel Group and Channel State
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
  layersPanelSelectedAnnotationIds: string[];
  setLayersPanelSelectedAnnotationIds: (ids: string[]) => void;
  /** Layers panel: selected group id (single-select) for copy/flash. */
  layersPanelSelectedGroupId: string | null;
  setLayersPanelSelectedGroupId: (id: string | null) => void;
  /** Layers panel: transient pulse/flash request (e.g. copy/paste feedback). */
  layersPanelSelectionFlash: {
    token: number;
    annotationIds: string[];
    groupId: string | null;
  } | null;
  flashLayersPanelSelection: (payload: {
    annotationIds: string[];
    groupId: string | null;
  }) => void;
  /** Layers panel: optional selection request for paste feedback. */
  layersPanelSelectionRequest: {
    token: number;
    annotationIds: string[];
    groupId: string | null;
  } | null;
  requestLayersPanelSelection: (payload: {
    annotationIds: string[];
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

  // New annotation actions
  addAnnotation: (annotation: Annotation) => void;
  addAnnotationsBatch: (items: Annotation[]) => void;
  removeAnnotation: (annotationId: string) => void;
  updateAnnotation: (
    annotationId: string,
    updates: Partial<Annotation>,
  ) => void;
  clearAnnotations: () => void;
  finalizeRectangle: () => void; // Convert current drawing to annotation

  /**
   * Narrative waypoint row actions. Prefer {@link setStoryWaypointRows} when you
   * already hold {@link StoreStoryWaypoint}[]; use these when bridging exhibit
   * {@link ConfigWaypoint} rows (`ItemRegistry.Stories`).
   */
  /** Replace all rows from exhibit-shaped waypoints (converts to store rows). */
  setStories: (configWaypoints: ConfigWaypoint[]) => void;
  /** Replace rows without `ConfigWaypoint` round-trip (e.g. importers). */
  setStoryWaypointRows: (rows: StoreStoryWaypoint[]) => void;
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

  finalizeEllipse: () => void; // Convert current drawing to ellipse annotation
  finalizeLasso: (points: [number, number][]) => void; // Convert lasso points to polygon annotation
  finalizeLine: (hasArrowHead?: boolean) => void; // Convert current drawing to line annotation
  finalizePolyline: (points: [number, number][]) => void; // Convert polyline points to polyline annotation
  createTextAnnotation: (
    position: [number, number],
    text: string,
    fontSize?: number,
  ) => void; // Create text annotation
  createPointAnnotation: (position: [number, number], radius?: number) => void; // Create point annotation
  updateTextAnnotation: (
    annotationId: string,
    newText: string,
    fontSize?: number,
  ) => void; // Update text annotation content
  updateTextAnnotationColor: (
    annotationId: string,
    fontColor: [number, number, number, number],
  ) => void; // Update text annotation color
  updateShapeText: (annotationId: string, newText: string) => void; // Update text field on any annotation (for shapes with text)
  updateAnnotationLabel: (annotationId: string, newLabel: string) => void; // Update the metadata label (used as layer name)
  setGlobalColor: (color: [number, number, number, number]) => void; // Set global drawing color
  setViewportZoom: (zoom: number) => void; // Set viewport zoom for line width scaling
  showSquareViewportOverlay: boolean;
  setShowSquareViewportOverlay: (show: boolean) => void;
  toggleSquareViewportOverlay: () => void;
  setBrushRadiusPx: (radius: number) => void;
  setBrushMaskResolution: (res: number) => void;
  setBrushViewport: (
    width: number,
    height: number,
    bounds: [number, number, number, number] | null,
  ) => void;
  clearBrushMask: () => void;
  brushPaintStart: (screenCoord: [number, number]) => void;
  brushPaint: (screenCoord: [number, number]) => void;
  brushPaintEnd: () => void;
  startBrushEdit: (annotationId: string, mode: "add" | "subtract") => void;
  stopBrushEdit: () => void;
  setSelectedAnnotation: (annotationId: string | null) => void;
  finalizeBrush: (
    strokePoints: [number, number][],
    precomputedHull?: [number, number][],
  ) => void;

  // New layer visibility actions
  toggleLayerVisibility: (annotationId: string) => void;
  showAllLayers: () => void;
  hideAllLayers: () => void;

  // New drag actions for move tool
  startDrag: (annotationId: string, offset: [number, number]) => void;
  updateDrag: (coordinate: [number, number, number]) => void;
  endDrag: () => void;
  resetDragState: () => void;

  // New hover actions for move tool
  setHoveredAnnotation: (annotationId: string | null) => void;
  resetHoverState: () => void;

  // Group actions
  createGroup: (name?: string) => void;
  deleteGroup: (groupId: string) => void;
  addAnnotationToGroup: (groupId: string, annotationId: string) => void;
  removeAnnotationFromGroup: (groupId: string, annotationId: string) => void;
  toggleGroupExpanded: (groupId: string) => void;

  // Import waypoint annotations actions
  imageWidth: number;
  imageHeight: number;
  setImageDimensions: (width: number, height: number) => void;
  importWaypointAnnotations: (
    story: StoreStoryWaypoint,
    clearExisting?: boolean,
    /** When passed (e.g. from React), used for resolution so effects track `Shapes` explicitly. */
    shapeRegistry?: StoryShape[],
  ) => void;
  clearImportedAnnotations: () => void;
  /** Persist annotations into stories[index] (`shapes` + `ItemRegistry.Shapes`). */
  persistImportedAnnotationsToStory: (storyIndex: number) => void;

  /**
   * Serializable `story.json` snapshot (`version` + `waypoints` + `shapes`).
   * Kept in sync via `syncStoryDocument` after story/shape/export-input changes.
   */
  storyDocument: StoryDocument;
  /** Rebuild `storyDocument` from `stories`, `Shapes`, `imageWidth`/`imageHeight`, `viewerViewportSize`. */
  syncStoryDocument: () => void;
  /** `syncStoryDocument` then download; avoids duplicating export inputs at call sites. */
  downloadStoryJsonFile: (filename?: string) => void;

  // Waypoint camera (resolved inside ImageViewer for correct viewport coupling)
  setTargetWaypointCamera: (waypoint: ConfigWaypoint | null) => void;
  clearTargetWaypointCamera: () => void;
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
    draggedAnnotationId: null,
    dragOffset: null,
  },
  hoverState: {
    hoveredAnnotationId: null,
  },
  annotations: [], // New: empty annotations array
  annotationGroups: [], // New: empty groups array
  hiddenLayers: new Set<string>(), // New: empty hidden layers set
  globalColor: [255, 255, 255, 255], // New: default white color
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
  selectedAnnotationId: null as string | null,
  brushEditTargetId: null as string | null,
  brushEditMode: null as "add" | "subtract" | null,
  stories: [], // New: empty stories array
  storyDocument: {
    version: STORY_JSON_VERSION,
    waypoints: [],
    shapes: [],
  },
  activeStoryIndex: null, // New: no active story initially
  activeChannelGroupId: null, // No channel group initially
  imageWidth: 0,
  imageHeight: 0,
  channelVisibilities: {},
  groupChannelLists: {},
  groupNames: {},
  targetWaypointCamera: null,
  authoringWaypointEditorOpen: false,
  layersPanelSelectedAnnotationIds: [] as string[],
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
  viewerImageLayersLoaded: false,
  squareViewportThumbnailCapture: null,
  editingViewstateWaypointIndex: null,
};

// Create the overlay store
export const useOverlayStore = create<OverlayStore & DocumentStore>()(
  devtools(
    (set, get) => ({
      ...overlayInitialState,
      ...documentStore(set, get),
      setShapes: (Shapes: StoryShape[]) => {
        set({ Shapes });
        get().syncStoryDocument();
      },

      syncStoryDocument: () => {
        const s = get();
        set({
          storyDocument: exportStoryDocument(
            s.stories,
            s.Shapes ?? [],
            s.imageWidth,
            s.imageHeight,
            s.viewerViewportSize,
          ),
        });
      },

      downloadStoryJsonFile: (filename = "story.json") => {
        get().syncStoryDocument();
        downloadStoryDocument(get().storyDocument, filename);
      },

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
          // Remove the drawing layer when tool is not active
          get().removeOverlayLayer("drawing-layer");
          return;
        }

        // Add or update the layer
        get().addOverlayLayer(layer);
      },

      handleToolChange: (tool: string) => {
        set({
          activeTool: tool,
          brushEditTargetId: null,
          brushEditMode: null,
        });

        // Clear any partial drawing state when switching tools
        get().resetDrawingState();

        // Clear any drag state when switching tools
        get().resetDragState();

        // Remove the unified drawing layer and arrow preview
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

        // Handle move tool interactions
        if (activeTool === "move") {
          if (!get().authoringWaypointEditorOpen) {
            return;
          }
          const { hoverState } = get();

          switch (type) {
            case "hover":
              // Hover detection is handled in dragHandlers.ts
              break;
            case "click":
              // Click without drag: select annotation (e.g. for layers panel)
              if (hoverState.hoveredAnnotationId) {
                get().setSelectedAnnotation(hoverState.hoveredAnnotationId);
              }
              break;
            case "dragStart":
              // Start drag if clicking on a hovered annotation
              if (hoverState.hoveredAnnotationId) {
                const annotation = get().annotations.find(
                  (a) => a.id === hoverState.hoveredAnnotationId,
                );
                if (annotation) {
                  // Calculate offset between click position and annotation position
                  let offset: [number, number] = [0, 0];

                  if (
                    annotation.type === "text" ||
                    annotation.type === "point"
                  ) {
                    // For text and point, offset from position
                    offset = [
                      x - annotation.position[0],
                      y - annotation.position[1],
                    ];
                  } else {
                    // For polygon-based annotations, calculate offset from first point
                    const firstPoint = annotation.polygon[0];
                    offset = [x - firstPoint[0], y - firstPoint[1]];
                  }

                  get().startDrag(hoverState.hoveredAnnotationId, offset);
                }
              }
              break;
            case "drag":
              // Update drag position
              if (dragState.isDragging) {
                get().updateDrag(coordinate);
              }
              break;
            case "dragEnd":
              // End drag
              if (dragState.isDragging) {
                get().endDrag();
              }
              break;
          }
          return;
        }

        // Handle drawing state updates only for tools that use it (rectangle, ellipse, arrow, line)
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

      // New annotation actions
      addAnnotation: (annotation: Annotation) => {
        set((state) => ({
          annotations: [...state.annotations, annotation],
        }));
      },

      addAnnotationsBatch: (items: Annotation[]) => {
        if (items.length === 0) return;
        set((state) => ({
          annotations: [...state.annotations, ...items],
        }));
      },

      removeAnnotation: (annotationId: string) => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenLayers);
          newHiddenLayers.delete(annotationId);
          const newSelected =
            state.selectedAnnotationId === annotationId
              ? null
              : state.selectedAnnotationId;

          const clearingBrushEdit =
            state.brushEditTargetId === annotationId
              ? {
                  brushEditTargetId: null as string | null,
                  brushEditMode: null as "add" | "subtract" | null,
                }
              : {};

          return {
            annotations: state.annotations.filter((a) => a.id !== annotationId),
            hiddenLayers: newHiddenLayers,
            selectedAnnotationId: newSelected,
            ...clearingBrushEdit,
          };
        });
      },

      updateAnnotation: (
        annotationId: string,
        updates: Partial<Annotation>,
      ) => {
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === annotationId ? ({ ...a, ...updates } as Annotation) : a,
          ),
        }));
      },

      clearAnnotations: () => {
        set({ annotations: [] });
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

          // Rectangle tool stores a closed polygon (same rendering path as lasso / brush).
          const annotation: PolygonAnnotation = {
            id: newAnnotationId(),
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
              label: `Untitled ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Reset drawing state
          get().resetDrawingState();

          // Remove the temporary drawing layer
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

          const annotation: PolygonAnnotation = {
            id: newAnnotationId(),
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
              label: `Untitled ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Reset drawing state
          get().resetDrawingState();

          // Remove the temporary drawing layer
          get().removeOverlayLayer("drawing-layer");
        }
      },

      finalizeLasso: (points: [number, number][]) => {
        if (points.length >= 3) {
          // Create a new polygon annotation
          const annotation: PolygonAnnotation = {
            id: newAnnotationId(),
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
              label: `Untitled ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Remove the temporary drawing layer
          get().removeOverlayLayer("drawing-layer");
        }
      },

      finalizePolyline: (points: [number, number][]) => {
        if (points.length >= 2) {
          // Create a new polyline annotation
          const annotation: PolylineAnnotation = {
            id: newAnnotationId(),
            type: "polyline",
            polygon: points,
            style: {
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Remove the temporary drawing layer
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

          const annotation: LineAnnotation = {
            id: newAnnotationId(),
            type: "line",
            polygon: linePolygon,
            hasArrowHead,
            style: {
              fillColor: [0, 0, 0, 0] as [number, number, number, number], // Transparent fill
              lineColor: get().globalColor,
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Reset drawing state
          get().resetDrawingState();

          // Remove the temporary drawing layer
          get().removeOverlayLayer("drawing-layer");
        }
      },

      createTextAnnotation: (
        position: [number, number],
        text: string,
        fontSize: number = 14,
      ) => {
        if (!text.trim()) {
          return;
        }

        // Create a new text annotation
        const annotation: TextAnnotation = {
          id: newAnnotationId(),
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
            label: `Untitled ${get().annotations.length + 1}`,
          },
        };

        // Add the annotation
        get().addAnnotation(annotation);
      },

      createPointAnnotation: (
        position: [number, number],
        radius: number = 5,
      ) => {
        // Create a new point annotation
        const annotation: PointAnnotation = {
          id: newAnnotationId(),
          type: "point",
          position: position,
          style: {
            fillColor: get().globalColor, // Use global color for fill
            strokeColor: [255, 255, 255, 255], // White stroke
            radius: radius,
          },
          metadata: {
            label: `Untitled ${get().annotations.length + 1}`,
          },
        };

        // Add the annotation
        get().addAnnotation(annotation);
      },

      updateTextAnnotation: (
        annotationId: string,
        newText: string,
        fontSize?: number,
      ) => {
        if (!newText.trim()) {
          return;
        }

        const annotations = get().annotations;
        const annotation = annotations.find((a) => a.id === annotationId);

        if (!annotation || annotation.type !== "text") {
          return;
        }

        // Update the text content and optionally fontSize
        const updates: Partial<TextAnnotation> = {
          text: newText.trim(),
        };

        if (fontSize !== undefined) {
          updates.style = {
            ...annotation.style,
            fontSize: fontSize,
          };
        }

        get().updateAnnotation(annotationId, updates);
      },

      updateTextAnnotationColor: (
        annotationId: string,
        fontColor: [number, number, number, number],
      ) => {
        const annotations = get().annotations;
        const annotation = annotations.find((a) => a.id === annotationId);

        if (!annotation || annotation.type !== "text") {
          return;
        }

        // Update the font color
        const updates: Partial<TextAnnotation> = {
          style: {
            ...annotation.style,
            fontColor: fontColor,
          },
        };

        get().updateAnnotation(annotationId, updates);
      },

      updateShapeText: (annotationId: string, newText: string) => {
        const annotations = get().annotations;
        const annotation = annotations.find((a) => a.id === annotationId);

        if (!annotation) {
          return;
        }

        // For text annotations, use the existing updateTextAnnotation method
        if (annotation.type === "text") {
          get().updateTextAnnotation(annotationId, newText);
          return;
        }

        // Update the text field on the shape
        // Empty string removes the text field
        const updates: Partial<Annotation> = {
          text: newText.trim() || undefined,
        };

        get().updateAnnotation(annotationId, updates);
      },

      updateAnnotationLabel: (annotationId: string, newLabel: string) => {
        const trimmed = newLabel.trim();

        set((state) => ({
          annotations: state.annotations.map((annotation) => {
            if (annotation.id !== annotationId) {
              return annotation;
            }

            const nextMetadata = {
              ...(annotation.metadata ?? {}),
              label: trimmed || undefined,
            };

            return {
              ...annotation,
              metadata: nextMetadata,
            } as Annotation;
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

      toggleSquareViewportOverlay: () => {
        set((state) => ({
          showSquareViewportOverlay: !state.showSquareViewportOverlay,
        }));
      },

      setBrushRadiusPx: (radius: number) => {
        set({ brushRadiusPx: radius });
      },

      setBrushMaskResolution: (res: number) => {
        set({ brushMaskMaxResolution: Math.max(1, Math.floor(res)) });
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

      startBrushEdit: (annotationId: string, mode: "add" | "subtract") => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenLayers);
          if (newHiddenLayers.has(annotationId)) {
            newHiddenLayers.delete(annotationId);
          }

          return {
            activeTool: "brush",
            brushEditTargetId: annotationId,
            brushEditMode: mode,
            hiddenLayers: newHiddenLayers,
            selectedAnnotationId: annotationId,
          };
        });
      },

      stopBrushEdit: () => {
        set({
          brushEditTargetId: null,
          brushEditMode: null,
        });
      },

      setSelectedAnnotation: (annotationId: string | null) => {
        set({ selectedAnnotationId: annotationId });
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
          annotations,
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
          const target = annotations.find((a) => a.id === brushEditTargetId);
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
              get().updateAnnotation(brushEditTargetId, {
                polygon: nextPolygon,
              } as Partial<Annotation>);
            }
          }
        } else {
          const annotation: PolygonAnnotation = {
            id: newAnnotationId(),
            type: "polygon",
            polygon: overlayPolygon,
            style: {
              fillColor: [0, 0, 0, 0],
              lineColor: globalColor,
              lineWidth: 3,
            },
            metadata: {
              label: `Untitled ${annotations.length + 1}`,
            },
          };
          get().addAnnotation(annotation);
        }

        get().removeOverlayLayer("drawing-layer");
        // Clear mask after finalizing this brush annotation
        set({ brushMask: null, brushMaskVersion: 0 });
      },

      // New layer visibility actions
      toggleLayerVisibility: (annotationId: string) => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenLayers);
          if (newHiddenLayers.has(annotationId)) {
            newHiddenLayers.delete(annotationId);
          } else {
            newHiddenLayers.add(annotationId);
          }
          return { hiddenLayers: newHiddenLayers };
        });
      },

      showAllLayers: () => {
        set({ hiddenLayers: new Set<string>() });
      },

      hideAllLayers: () => {
        set((state) => ({
          hiddenLayers: new Set(state.annotations.map((a) => a.id)),
        }));
      },

      // New drag actions for move tool
      startDrag: (annotationId: string, offset: [number, number]) => {
        set({
          dragState: {
            isDragging: true,
            draggedAnnotationId: annotationId,
            dragOffset: offset,
          },
        });
      },

      updateDrag: (coordinate: [number, number, number]) => {
        const { dragState, annotations } = get();
        if (
          dragState.isDragging &&
          dragState.draggedAnnotationId &&
          dragState.dragOffset
        ) {
          const [x, y] = coordinate;
          const [offsetX, offsetY] = dragState.dragOffset;

          // Calculate new position based on drag offset
          const newX = x - offsetX;
          const newY = y - offsetY;

          // Find the annotation being dragged
          const annotation = annotations.find(
            (a) => a.id === dragState.draggedAnnotationId,
          );
          if (annotation) {
            if (annotation.type === "text" || annotation.type === "point") {
              // For text and point annotations, update the position directly
              const updatedAnnotation = {
                ...annotation,
                position: [newX, newY] as [number, number],
              };
              get().updateAnnotation(
                dragState.draggedAnnotationId,
                updatedAnnotation,
              );
            } else {
              // For polygon-based annotations (rectangle, polygon, line, polyline), calculate delta from first point
              const deltaX = newX - annotation.polygon[0][0];
              const deltaY = newY - annotation.polygon[0][1];

              // Update all polygon points by the same delta
              const updatedPolygon = annotation.polygon.map(
                ([px, py]) => [px + deltaX, py + deltaY] as [number, number],
              );

              const updatedAnnotation = {
                ...annotation,
                polygon: updatedPolygon,
              };

              // Update the annotation in the store
              get().updateAnnotation(
                dragState.draggedAnnotationId,
                updatedAnnotation,
              );
            }
          }
        }
      },

      endDrag: () => {
        set({
          dragState: {
            isDragging: false,
            draggedAnnotationId: null,
            dragOffset: null,
          },
        });
        const { activeStoryIndex } = get();
        if (activeStoryIndex !== null) {
          get().persistImportedAnnotationsToStory(activeStoryIndex);
        }
      },

      resetDragState: () => {
        set({ dragState: overlayInitialState.dragState });
      },

      // New hover actions for move tool
      setHoveredAnnotation: (annotationId: string | null) => {
        set({
          hoverState: {
            hoveredAnnotationId: annotationId,
          },
        });
      },

      resetHoverState: () => {
        set({ hoverState: overlayInitialState.hoverState });
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

      setLayersPanelSelectedAnnotationIds: (ids: string[]) => {
        set({ layersPanelSelectedAnnotationIds: [...ids] });
      },

      setLayersPanelSelectedGroupId: (id: string | null) => {
        set({ layersPanelSelectedGroupId: id });
      },

      flashLayersPanelSelection: (payload) => {
        set({
          layersPanelSelectionFlash: {
            token: Date.now(),
            annotationIds: [...payload.annotationIds],
            groupId: payload.groupId,
          },
        });
      },

      requestLayersPanelSelection: (payload) => {
        set({
          layersPanelSelectionRequest: {
            token: Date.now(),
            annotationIds: [...payload.annotationIds],
            groupId: payload.groupId,
          },
        });
      },

      // Group actions
      createGroup: (name?: string) => {
        const groupCount = get().annotationGroups.length;
        const newGroup: AnnotationGroup = {
          id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name || `Group ${groupCount + 1}`,
          annotationIds: [],
          isExpanded: true,
        };
        set((state) => ({
          annotationGroups: [...state.annotationGroups, newGroup],
        }));
      },

      deleteGroup: (groupId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.filter(
            (g) => g.id !== groupId,
          ),
        }));
      },

      addAnnotationToGroup: (groupId: string, annotationId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  annotationIds: [...group.annotationIds, annotationId],
                }
              : group,
          ),
        }));
      },

      removeAnnotationFromGroup: (groupId: string, annotationId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  annotationIds: group.annotationIds.filter(
                    (id) => id !== annotationId,
                  ),
                }
              : group,
          ),
        }));
      },

      toggleGroupExpanded: (groupId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.map((group) =>
            group.id === groupId
              ? { ...group, isExpanded: !group.isExpanded }
              : group,
          ),
        }));
      },

      // Stories actions
      setStories: (configWaypoints: ConfigWaypoint[]) => {
        const s = get();
        const iw = s.imageWidth;
        const ih = s.imageHeight;
        const cw = s.viewerViewportSize?.width ?? 0;
        const ch = s.viewerViewportSize?.height ?? 0;
        set({
          stories: configWaypoints.map((w) =>
            configWaypointToStoreStoryWaypoint(w, iw, ih, cw, ch),
          ),
          activeStoryIndex: null,
        });
        get().syncStoryDocument();
      },

      setStoryWaypointRows: (rows: StoreStoryWaypoint[]) => {
        set({
          stories: rows,
          activeStoryIndex: null,
        });
        get().syncStoryDocument();
      },

      setActiveStory: (index: number | null) => {
        set({ activeStoryIndex: index });
      },

      addStory: (configWaypoint: ConfigWaypoint) => {
        const s = get();
        const row = configWaypointToStoreStoryWaypoint(
          configWaypoint,
          s.imageWidth,
          s.imageHeight,
          s.viewerViewportSize?.width ?? 0,
          s.viewerViewportSize?.height ?? 0,
        );
        set((state) => ({
          stories: [...state.stories, row],
        }));
        get().syncStoryDocument();
      },

      updateStory: (index: number, updates: Partial<ConfigWaypoint>) => {
        set((state) => {
          const shouldDropLegacyViewKeys = Object.hasOwn(updates, "Bounds");
          const iw = state.imageWidth;
          const ih = state.imageHeight;
          const cw = state.viewerViewportSize?.width ?? 0;
          const ch = state.viewerViewportSize?.height ?? 0;
          const newStories = state.stories.map((storyRow, i) => {
            if (i !== index) return storyRow;
            const asConfig = storeStoryWaypointToConfigWaypoint(storyRow);
            let merged: ConfigWaypoint = { ...asConfig, ...updates };
            if (shouldDropLegacyViewKeys) {
              const { Pan: _pan, Zoom: _zoom, ...withoutPanZoom } = merged;
              if (Object.hasOwn(updates, "ViewState")) {
                merged = withoutPanZoom as ConfigWaypoint;
              } else {
                const { ViewState: _vs, ...rest } = withoutPanZoom;
                merged = rest as ConfigWaypoint;
              }
            }
            return configWaypointToStoreStoryWaypoint(merged, iw, ih, cw, ch);
          });
          return { stories: newStories };
        });
        get().syncStoryDocument();
      },

      removeStory: (index: number) => {
        set((state) => ({
          stories: state.stories.filter((_, i) => i !== index),
          activeStoryIndex:
            state.activeStoryIndex === index
              ? null
              : state.activeStoryIndex && state.activeStoryIndex > index
                ? state.activeStoryIndex - 1
                : state.activeStoryIndex,
        }));
        get().syncStoryDocument();
      },

      reorderStories: (fromIndex: number, toIndex: number) => {
        set((state) => {
          const newStories = [...state.stories];
          const [movedStory] = newStories.splice(fromIndex, 1);
          newStories.splice(toIndex, 0, movedStory);

          // Update activeStoryIndex if it's affected by the reordering
          let newActiveStoryIndex = state.activeStoryIndex;
          if (state.activeStoryIndex !== null) {
            if (state.activeStoryIndex === fromIndex) {
              // The active story was moved
              newActiveStoryIndex = toIndex;
            } else if (
              fromIndex < state.activeStoryIndex &&
              toIndex >= state.activeStoryIndex
            ) {
              // Story moved from before active to after active
              newActiveStoryIndex = state.activeStoryIndex - 1;
            } else if (
              fromIndex > state.activeStoryIndex &&
              toIndex <= state.activeStoryIndex
            ) {
              // Story moved from after active to before active
              newActiveStoryIndex = state.activeStoryIndex + 1;
            }
          }

          return {
            stories: newStories,
            activeStoryIndex: newActiveStoryIndex,
          };
        });
        get().syncStoryDocument();
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
        get().syncStoryDocument();
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

      // Image dimensions actions
      setImageDimensions: (width: number, height: number) => {
        set({ imageWidth: width, imageHeight: height });
        get().syncStoryDocument();
      },

      // Import waypoint annotations actions
      importWaypointAnnotations: (
        story: StoreStoryWaypoint,
        clearExisting: boolean = false,
        shapeRegistry?: StoryShape[],
      ) => {
        const { imageWidth, imageHeight } = get();
        const fromStore = get().Shapes;
        const shapesForLookup =
          shapeRegistry === undefined
            ? fromStore
            : (() => {
                const merged = new Map(
                  fromStore.map((s) => [s.uuid, s] as const),
                );
                for (const s of shapeRegistry) {
                  merged.set(s.uuid, s);
                }
                return [...merged.values()];
              })();

        if (imageWidth === 0 || imageHeight === 0) {
          return;
        }

        const shapeIds = story.shapes ?? [];
        if (
          clearExisting &&
          shapeIds.length > 0 &&
          shapesForLookup.length === 0
        ) {
          // Registry not hydrated yet (e.g. ItemRegistry.Shapes after Stories); skip so we
          // don't clear imported overlays and re-import nothing.
          return;
        }

        const shapeById = new Map(shapesForLookup.map((s) => [s.uuid, s]));

        const newAnnotations: Annotation[] = [];
        for (const id of shapeIds) {
          const sh = shapeById.get(id);
          if (sh)
            newAnnotations.push(
              shapeToAnnotation(sh, { imageWidth, imageHeight }),
            );
        }

        // Always remove prior `isImported` overlays when `clearExisting` (waypoint
        // switch), even if `Shapes` is not fully loaded yet — otherwise annotations
        // from the previous waypoint stay on canvas until the registry catches up.
        // Resolved shapes are appended in waypoint `shapes` order; effects re-run when
        // `Shapes` updates to add any entries that were still missing.
        set((state) =>
          mergeAnnotationsAfterWaypointImport(
            state,
            newAnnotations,
            clearExisting,
          ),
        );
      },

      clearImportedAnnotations: () => {
        set({ annotations: [], hiddenLayers: new Set() });
      },

      persistImportedAnnotationsToStory: (storyIndex: number) => {
        const state = get();
        const story = state.stories[storyIndex];
        if (!story || state.imageWidth <= 0 || state.imageHeight <= 0) {
          return;
        }
        const hadStored = (story.shapes?.length ?? 0) > 0;
        if (state.annotations.length === 0 && !hadStored) {
          return;
        }
        if (state.annotations.length === 0 && hadStored) {
          const merged = mergeShapesForWaypointPersist({
            stories: state.stories,
            storyIndex,
            prevShapes: state.Shapes,
            builtShapes: [],
            newShapeIdsOrdered: [],
          });
          if (JSON.stringify(merged) !== JSON.stringify(state.Shapes)) {
            set({ Shapes: merged });
          }
          get().updateStory(storyIndex, {
            ShapeIds: [],
          });
          return;
        }
        const builtShapes = annotationsToShapes(state.annotations);
        const newShapeIdsOrdered = builtShapes.map((s) => s.uuid);
        const merged = mergeShapesForWaypointPersist({
          stories: state.stories,
          storyIndex,
          prevShapes: state.Shapes,
          builtShapes,
          newShapeIdsOrdered,
        });
        const prevIds = JSON.stringify(story.shapes ?? []);
        const nextIds = JSON.stringify(newShapeIdsOrdered);
        const prevShapesJson = JSON.stringify(state.Shapes);
        const nextShapesJson = JSON.stringify(merged);
        if (prevIds === nextIds && prevShapesJson === nextShapesJson) {
          return;
        }
        set({ Shapes: merged });
        get().updateStory(storyIndex, {
          ShapeIds: newShapeIdsOrdered,
        });
      },

      // channel and group actions
      //
      setActiveChannelGroup: (channelGroupId: string) => {
        set(({ groupChannelLists, groupNames }) => {
          const name = groupNames[channelGroupId] || "";
          const channels = groupChannelLists[name] || [];
          const channelVisibilities = Object.fromEntries(
            channels.map((name) => [name, true]),
          );
          return {
            activeChannelGroupId: channelGroupId,
            channelVisibilities,
          };
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
      name: "overlay-store",
    },
  ),
);

// Example of how to add more stores in the future:
//
// export interface UserStore {
//   user: User | null;
//   isAuthenticated: boolean;
//   login: (credentials: LoginCredentials) => Promise<void>;
//   logout: () => void;
// }
//
// export const useUserStore = create<UserStore>()(
//   devtools(
//     (set) => ({
//       user: null,
//       isAuthenticated: false,
//       login: async (credentials) => {
//         // Login logic
//       },
//       logout: () => {
//         set({ user: null, isAuthenticated: false });
//       },
//     }),
//     { name: 'user-store' }
//   )
// );
