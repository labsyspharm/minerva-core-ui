import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { documentStore } from "./document-store";
export type { ConfigGroup } from "./document-store";
import type { DocumentStore } from "./document-store";
import type {
  ConfigWaypoint,
  ConfigWaypointArrow,
  ConfigWaypointOverlay,
} from "./config";
import { buildBrushHull } from "./brushHull";
import { polygonUnion } from "./polygonClipping";

// Re-export config types for convenience
export type {
  ConfigWaypointArrow as ConfigArrow,
  ConfigWaypointOverlay as ConfigOverlay,
};

// Types for the overlay store
export interface OverlayLayer {
  id: string;
}

type BrushMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

function ensureBrushMask(
  imageWidth: number,
  imageHeight: number,
  maxRes: number,
  existing: BrushMask | null,
): BrushMask {
  if (existing) return existing;
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: 1, height: 1, data: new Uint8Array(1) };
  }

  // Create a mask that fits within maxRes while preserving aspect ratio.
  // This keeps the mask roughly "canvas sized" and avoids huge allocations
  // for very large images.
  const scale = Math.min(1, maxRes / Math.max(imageWidth, imageHeight));
  const width = Math.max(1, Math.round(imageWidth * scale));
  const height = Math.max(1, Math.round(imageHeight * scale));
  return { width, height, data: new Uint8Array(width * height) };
}

function paintCircleOnMask(
  mask: BrushMask,
  imageWidth: number,
  imageHeight: number,
  cxWorld: number,
  cyWorld: number,
  radiusWorld: number,
): void {
  const { width, height, data } = mask;
  if (imageWidth <= 0 || imageHeight <= 0) return;

  const sx = width / imageWidth;
  const sy = height / imageHeight;
  const scale = Math.min(sx, sy);
  const r = Math.max(1, Math.round(radiusWorld * scale));

  const mx = Math.round((cxWorld / imageWidth) * (width - 1));
  // Deck.gl BitmapLayer draws texture with row 0 at bottom; world y=0 is bottom. Flip mask row so painted position matches cursor.
  const my = (height - 1) - Math.round((cyWorld / imageHeight) * (height - 1));

  const y0 = Math.max(0, my - r);
  const y1 = Math.min(height - 1, my + r);
  const x0 = Math.max(0, mx - r);
  const x1 = Math.min(width - 1, mx + r);
  const r2 = r * r;

  for (let y = y0; y <= y1; y++) {
    const dy = y - my;
    for (let x = x0; x <= x1; x++) {
      const dx = x - mx;
      if (dx * dx + dy * dy <= r2) {
        data[y * width + x] = 1;
      }
    }
  }
}

/** Viewport-sized mask: one pixel per screen pixel. */
function ensureBrushMaskViewport(
  viewportWidth: number,
  viewportHeight: number,
  existing: BrushMask | null,
): BrushMask {
  if (existing && existing.width === viewportWidth && existing.height === viewportHeight) return existing;
  const w = Math.max(1, Math.round(viewportWidth));
  const h = Math.max(1, Math.round(viewportHeight));
  return { width: w, height: h, data: new Uint8Array(w * h) };
}

/** Paint circle in screen coords. sx,sy in [0, viewportW] x [0, viewportH]; row 0 = top. */
function paintCircleOnMaskScreen(
  mask: BrushMask,
  viewportWidth: number,
  viewportHeight: number,
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

function polygonArea(poly: Point2[]): number {
  if (poly.length < 3) return 0;
  let a = 0;
  // accepts closed or open
  const n = poly.length;
  const end = poly[0][0] === poly[n - 1][0] && poly[0][1] === poly[n - 1][1] ? n - 1 : n;
  for (let i = 0; i < end; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % end];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function pointToSegmentDistance(p: Point2, a: Point2, b: Point2): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;
  const t = denom === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
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

function simplifyClosedPolygon(pointsClosed: Point2[], epsilon: number): Point2[] {
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
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > epsilon * 0.25) cleaned.push(p);
  }

  if (cleaned.length < 3) return pointsClosed;
  return [...cleaned, cleaned[0]];
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

      if (loopKeys.length >= 6 && loopKeys[0] === loopKeys[loopKeys.length - 1]) {
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
  return loop.map(([x, y]) => [left + (x / maskWidth) * dx, top + (y / maskHeight) * dy]);
}

function maskToPolygon(
  mask: BrushMask,
  imageWidth: number,
  imageHeight: number,
): [number, number][] | null {
  const { width, height, data } = mask;
  if (!width || !height) return null;
  if (imageWidth <= 0 || imageHeight <= 0) return null;

  const sx = imageWidth / width;
  const sy = imageHeight / height;

  let hull: [number, number][] | null = null;

  for (let y = 0; y < height; y++) {
    let runStart = -1;
    const rowOffset = y * width;
    for (let x = 0; x <= width; x++) {
      const inside = x < width && data[rowOffset + x] !== 0;
      if (inside && runStart === -1) {
        runStart = x;
      } else if (!inside && runStart !== -1) {
        const x0 = runStart * sx;
        const x1 = x * sx;
        const y0 = y * sy;
        const y1 = (y + 1) * sy;
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

  return hull && hull.length >= 3 ? hull : null;
}

// New annotation types - all using polygon coordinates internally
type ColorRGBA = [number, number, number, number];
export interface RectangleAnnotation {
  id: string;
  type: "rectangle";
  polygon: [number, number][]; // Converted to polygon coordinates
  style: {
    fillColor: ColorRGBA;
    lineColor: ColorRGBA;
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

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
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export interface EllipseAnnotation {
  id: string;
  type: "ellipse";
  polygon: [number, number][]; // Ellipse approximated as polygon coordinates
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
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
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
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
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
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
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
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
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export type Annotation = (
  | RectangleAnnotation
  | EllipseAnnotation
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
    createdAt: Date;
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
  selectedAnnotationId: string | null;

  // Stories state
  stories: ConfigWaypoint[];
  activeStoryIndex: number | null;
  waypoints: ConfigWaypoint[]; // All waypoints from all stories
  activeWaypointId: string | null;

  // Channel Group and Channel State
  activeChannelGroupId: string | null;

  // Waypoint view state (for triggering view changes from waypoint selection)
  // These are in Minerva 1.5 (OSD) format - will be converted by VivView
  targetWaypointPan: [number, number] | null;
  targetWaypointZoom: number | null;

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
  removeAnnotation: (annotationId: string) => void;
  updateAnnotation: (
    annotationId: string,
    updates: Partial<Annotation>,
  ) => void;
  clearAnnotations: () => void;
  finalizeRectangle: () => void; // Convert current drawing to annotation

  // Stories actions
  setStories: (stories: ConfigWaypoint[]) => void;
  setActiveStory: (index: number | null) => void;
  addStory: (story: ConfigWaypoint) => void;
  updateStory: (index: number, updates: Partial<ConfigWaypoint>) => void;
  removeStory: (index: number) => void;
  reorderStories: (fromIndex: number, toIndex: number) => void;

  // Waypoints actions
  setWaypoints: (waypoints: ConfigWaypoint[]) => void;
  setActiveWaypoint: (waypointId: string | null) => void;
  addWaypoint: (waypoint: ConfigWaypoint) => void;
  updateWaypoint: (
    waypointId: string,
    updates: Partial<ConfigWaypoint>,
  ) => void;
  removeWaypoint: (waypointId: string) => void;

  // SAM2 magic wand: image fetcher for 1024x1024 crop (set by ImageViewer)
  sam2ImageFetcher: ((cx: number, cy: number) => Promise<{
    float32Array: Float32Array;
    shape: [number, number, number, number];
  }>) | null;
  setSam2ImageFetcher: (fetcher: ((cx: number, cy: number) => Promise<{
    float32Array: Float32Array;
    shape: [number, number, number, number];
  }>) | null) => void;
  sam2Processing: boolean;
  setSam2Processing: (v: boolean) => void;
  sam2DebugImages: { encoded: string; mask: string } | null;
  setSam2DebugImages: (v: { encoded: string; mask: string } | null) => void;

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
  setGlobalColor: (color: [number, number, number, number]) => void; // Set global drawing color
  setViewportZoom: (zoom: number) => void; // Set viewport zoom for line width scaling
  setBrushRadiusPx: (radius: number) => void;
  setBrushMaskResolution: (res: number) => void;
  setBrushViewport: (width: number, height: number, bounds: [number, number, number, number] | null) => void;
  clearBrushMask: () => void;
  brushPaintStart: (screenCoord: [number, number]) => void;
  brushPaint: (screenCoord: [number, number]) => void;
  brushPaintEnd: () => void;
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
    arrows: ConfigWaypointArrow[],
    overlays: ConfigWaypointOverlay[],
    clearExisting?: boolean,
  ) => void;
  clearImportedAnnotations: () => void;

  // Waypoint view state actions
  setTargetWaypointViewState: (
    pan: [number, number] | null,
    zoom: number | null,
  ) => void;
  clearTargetWaypointViewState: () => void;
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
  activeWaypoint: 0,
  annotations: [], // New: empty annotations array
  annotationGroups: [], // New: empty groups array
  hiddenLayers: new Set<string>(), // New: empty hidden layers set
  globalColor: [255, 255, 255, 255], // New: default white color
  viewportZoom: 0, // Default zoom level
  brushRadiusPx: 30,
   brushMask: null as BrushMask | null,
   brushMaskVersion: 0,
   brushMaskMaxResolution: 1024,
   brushViewportWidth: 0,
   brushViewportHeight: 0,
   brushViewBounds: null as [number, number, number, number] | null,
  selectedAnnotationId: null as string | null,
  stories: [], // New: empty stories array
  activeStoryIndex: null, // New: no active story initially
  activeChannelGroupId: null, // No channel group initially
  waypoints: [], // New: empty waypoints array
  activeWaypointId: null, // New: no active waypoint initially
  imageWidth: 0,
  imageHeight: 0,
  channelVisibilities: {},
  groupChannelLists: {},
  groupNames: {},
  targetWaypointPan: null, // Target pan from waypoint selection (Minerva 1.5 format)
  targetWaypointZoom: null, // Target zoom from waypoint selection (Minerva 1.5 format)
  sam2ImageFetcher: null,
  sam2Processing: false,
  sam2DebugImages: null,
};

// Create the overlay store
export const useOverlayStore = create<OverlayStore & DocumentStore>()(
  devtools(
    (set, get) => ({
      ...overlayInitialState,
      ...documentStore(set, get),

      setActiveTool: (tool: string) => {
        set({ activeTool: tool });
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
        set({ activeTool: tool });

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
                  setTimeout(() => get().finalizeLine(activeTool === "arrow"), 0);
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

      removeAnnotation: (annotationId: string) => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenLayers);
          newHiddenLayers.delete(annotationId);
          const newSelected =
            state.selectedAnnotationId === annotationId
              ? null
              : state.selectedAnnotationId;
          return {
            annotations: state.annotations.filter((a) => a.id !== annotationId),
            hiddenLayers: newHiddenLayers,
            selectedAnnotationId: newSelected,
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

          // Create a new rectangle annotation using polygon coordinates
          const annotation: RectangleAnnotation = {
            id: `rect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "rectangle",
            polygon: rectangleToPolygon([startX, startY], [endX, endY]),
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
              createdAt: new Date(),
              label: `Rectangle ${get().annotations.length + 1}`,
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

          // Create a new ellipse annotation using polygon coordinates
          const annotation: EllipseAnnotation = {
            id: `ellipse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "ellipse",
            polygon: ellipseToPolygon([startX, startY], [endX, endY]),
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
              createdAt: new Date(),
              label: `Ellipse ${get().annotations.length + 1}`,
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
            id: `poly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
              createdAt: new Date(),
              label: `Polygon ${get().annotations.length + 1}`,
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
            id: `polyline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "polyline",
            polygon: points,
            style: {
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Polyline ${get().annotations.length + 1}`,
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
          const lineWidth = 3;

          // Arrow uses degenerate polygon (IconLayer uses first 2 points); plain line uses lineToPolygon for proper stroke
          const linePolygon: [number, number][] = hasArrowHead
            ? [
                [startX, startY],
                [endX, endY],
                [endX, endY],
                [startX, startY],
                [startX, startY],
              ]
            : lineToPolygon([startX, startY], [endX, endY], lineWidth);

          const annotation: LineAnnotation = {
            id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "line",
            polygon: linePolygon,
            hasArrowHead,
            style: {
              fillColor: [0, 0, 0, 0] as [number, number, number, number], // Transparent fill
              lineColor: get().globalColor,
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Line ${get().annotations.length + 1}`,
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
          id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
            createdAt: new Date(),
            label: `Text ${get().annotations.length + 1}`,
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
          id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "point",
          position: position,
          style: {
            fillColor: get().globalColor, // Use global color for fill
            strokeColor: [255, 255, 255, 255], // White stroke
            radius: radius,
          },
          metadata: {
            createdAt: new Date(),
            label: `Point ${get().annotations.length + 1}`,
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

      setGlobalColor: (color: [number, number, number, number]) => {
        set({ globalColor: color });
      },

      setViewportZoom: (zoom: number) => {
        set({ viewportZoom: zoom });
      },

      setBrushRadiusPx: (radius: number) => {
        set({ brushRadiusPx: radius });
      },

      setBrushMaskResolution: (res: number) => {
        set({ brushMaskMaxResolution: Math.max(1, Math.floor(res)) });
      },

      setBrushViewport: (width: number, height: number, bounds: [number, number, number, number] | null) => {
        set({ brushViewportWidth: width, brushViewportHeight: height, brushViewBounds: bounds });
      },

      clearBrushMask: () => {
        set({ brushMask: null, brushMaskVersion: 0 });
      },

      brushPaintStart: (screenCoord: [number, number]) => {
        const state = get();
        const { brushViewportWidth, brushViewportHeight, brushRadiusPx } = state;
        if (brushViewportWidth <= 0 || brushViewportHeight <= 0 || brushRadiusPx <= 0) return;
        const mask = ensureBrushMaskViewport(brushViewportWidth, brushViewportHeight, null);
        paintCircleOnMaskScreen(mask, brushViewportWidth, brushViewportHeight, screenCoord[0], screenCoord[1], brushRadiusPx);
        set({ brushMask: mask, brushMaskVersion: 1 });
      },

      brushPaint: (screenCoord: [number, number]) => {
        const state = get();
        const mask = state.brushMask;
        if (!mask) return;
        const { brushViewportWidth, brushViewportHeight, brushRadiusPx } = state;
        paintCircleOnMaskScreen(mask, brushViewportWidth, brushViewportHeight, screenCoord[0], screenCoord[1], brushRadiusPx);
        set({ brushMask: { ...mask }, brushMaskVersion: state.brushMaskVersion + 1 });
      },

      brushPaintEnd: () => {
        const state = get();
        const mask = state.brushMask;
        const bounds = state.brushViewBounds;
        if (mask && bounds) {
          const loops = maskToLoops(mask);
          const pxToWorld = Math.max(
            Math.abs(bounds[2] - bounds[0]) / Math.max(1, mask.width),
            Math.abs(bounds[1] - bounds[3]) / Math.max(1, mask.height),
          );
          const epsilonWorld = pxToWorld * 2.5; // smooth away pixel bumps

          let hull: [number, number][] | null = null;
          for (const loop of loops) {
            const worldLoop = loopScreenToWorld(loop, bounds, mask.width, mask.height);
            const simplified = simplifyClosedPolygon(worldLoop, epsilonWorld);
            if (simplified.length < 4) continue;
            const area = Math.abs(polygonArea(simplified));
            if (area < (epsilonWorld * epsilonWorld) * 8) continue;
            if (!hull) {
              hull = simplified;
            } else {
              const union = polygonUnion(hull, simplified);
              if (union && union.length >= 4) hull = union;
            }
          }

          if (hull && hull.length >= 4) {
            const annotation: PolygonAnnotation = {
              id: `brush-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "polygon",
              polygon: hull,
              style: {
                fillColor: [0, 0, 0, 0],
                lineColor: state.globalColor,
                lineWidth: 3,
              },
              metadata: {
                createdAt: new Date(),
                label: `Brush ${state.annotations.length + 1}`,
              },
            };
            get().addAnnotation(annotation);
          }
        }

        set({ brushMask: null, brushMaskVersion: 0 });
      },

      setSelectedAnnotation: (annotationId: string | null) => {
        set({ selectedAnnotationId: annotationId });
      },

      finalizeBrush: (
        strokePoints: [number, number][],
        precomputedHull?: [number, number][],
      ) => {
        const state = get();
        const { brushRadiusPx, viewportZoom, brushMask, imageWidth, imageHeight } = state;
        if (strokePoints.length === 0) return;

        let overlayPolygon: [number, number][] | null = null;

        // Prefer mask-based polygon if a brush mask exists
        if (brushMask && imageWidth > 0 && imageHeight > 0) {
          overlayPolygon = maskToPolygon(brushMask, imageWidth, imageHeight);
        }

        // Fallback to geometry-based union-of-circles if mask is unavailable or empty
        if (!overlayPolygon || overlayPolygon.length < 3) {
          overlayPolygon =
            precomputedHull && precomputedHull.length >= 3
              ? precomputedHull
              : buildBrushHull(strokePoints, brushRadiusPx, viewportZoom);
        }

        if (!overlayPolygon || overlayPolygon.length < 3) return;

        // Debug: log final brush overlay polygon points for inspection
        try {
          // eslint-disable-next-line no-console
          console.log(
            "[brush] overlay polygon",
            JSON.stringify(overlayPolygon),
          );
        } catch {
          // ignore logging errors
        }

        const annotation: PolygonAnnotation = {
          id: `brush-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "polygon",
          polygon: overlayPolygon,
          style: {
            fillColor: [0, 0, 0, 0], // Outline only: annotation is the outline of the shape
            lineColor: state.globalColor,
            lineWidth: 3,
          },
          metadata: {
            createdAt: new Date(),
            label: `Brush ${state.annotations.length + 1}`,
          },
        };
        get().addAnnotation(annotation);
        get().removeOverlayLayer("drawing-layer");
        // Clear mask after finalizing this brush annotation
        set({ brushMask: null });
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

      // Group actions
      createGroup: (name?: string) => {
        const groupCount = get().annotationGroups.length;
        const newGroup: AnnotationGroup = {
          id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name || `Group ${groupCount + 1}`,
          annotationIds: [],
          isExpanded: true,
          metadata: {
            createdAt: new Date(),
          },
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
      setStories: (stories: ConfigWaypoint[]) => {
        set({ stories, activeStoryIndex: null });
      },

      setActiveStory: (index: number | null) => {
        set({ activeStoryIndex: index });
      },

      addStory: (story: ConfigWaypoint) => {
        set((state) => ({
          stories: [...state.stories, story],
        }));
      },

      updateStory: (index: number, updates: Partial<ConfigWaypoint>) => {
        set((state) => ({
          stories: state.stories.map((story, i) =>
            i === index ? { ...story, ...updates } : story,
          ),
        }));
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

      setChannelVisibilities: (vis: Record<string, boolean>) => {
        set({ channelVisibilities: vis });
      },

      setWaypoints: (waypoints: ConfigWaypoint[]) => {
        set({ waypoints, activeWaypointId: null });
      },

      setActiveWaypoint: (waypointId: string | null) => {
        set({ activeWaypointId: waypointId });
      },

      addWaypoint: (waypoint: ConfigWaypoint) => {
        set((state) => ({
          waypoints: [...state.waypoints, waypoint],
        }));
      },

      updateWaypoint: (
        waypointId: string,
        updates: Partial<ConfigWaypoint>,
      ) => {
        set((state) => ({
          waypoints: state.waypoints.map((waypoint) =>
            waypoint.UUID === waypointId
              ? { ...waypoint, ...updates }
              : waypoint,
          ),
        }));
      },

      removeWaypoint: (waypointId: string) => {
        set((state) => ({
          waypoints: state.waypoints.filter(
            (waypoint) => waypoint.UUID !== waypointId,
          ),
          activeWaypointId:
            state.activeWaypointId === waypointId
              ? null
              : state.activeWaypointId,
        }));
      },

      // Image dimensions actions
      setImageDimensions: (width: number, height: number) => {
        set({ imageWidth: width, imageHeight: height });
      },

      // Import waypoint annotations actions
      importWaypointAnnotations: (
        arrows: ConfigWaypointArrow[],
        overlays: ConfigWaypointOverlay[],
        clearExisting: boolean = false,
      ) => {
        const { imageWidth, imageHeight } = get();

        // Skip if image dimensions not set
        if (imageWidth === 0 || imageHeight === 0) {
          return;
        }

        // Use max dimension for uniform coordinate scaling (1.0 = max dimension)
        const maxDimension = Math.max(imageWidth, imageHeight);

        const newAnnotations: Annotation[] = [];

        // Convert arrows to line annotations (coordinates are normalized 0-1 relative to max dimension, convert to image pixels)
        arrows.forEach((arrow, index) => {
          // Convert normalized coordinates to image pixels (relative to max dimension)
          const [normX, normY] = arrow.Point;
          const x = normX * maxDimension;
          const y = normY * maxDimension;

          if (arrow.HideArrow) {
            // Create text-only annotation
            const textAnnotation: TextAnnotation = {
              id: `imported-text-${Date.now()}-${index}`,
              type: "text",
              position: [x, y],
              text: arrow.Text,
              style: {
                fontSize: 16,
                fontColor: [255, 255, 255, 255], // White text
                backgroundColor: [0, 0, 0, 150], // Semi-transparent black background
                padding: 6,
              },
              metadata: {
                createdAt: new Date(),
                label: arrow.Text,
                isImported: true,
              },
            };
            newAnnotations.push(textAnnotation);
          } else {
            // Create line annotation (arrow converted to simple stroke-based line)
            // Convert angle from degrees to radians and calculate start point
            // Angle 0 = pointing right, 90 = pointing down, etc.
            const angleRad = (arrow.Angle * Math.PI) / 180;

            // Line length proportional to image size (50% of the smaller dimension)
            const minDimension = Math.min(imageWidth, imageHeight);
            const lineLength = minDimension * 0.5;

            // Calculate start point (line points TO the Point location)
            // So start is away from the point in the direction of the angle
            const startX = x + Math.cos(angleRad) * lineLength;
            const startY = y + Math.sin(angleRad) * lineLength;
            const endX = x;
            const endY = y;

            // Simple polygon for stroke-based line rendering (no fill, just stroke)
            const linePolygon: [number, number][] = [
              [startX, startY],
              [endX, endY],
              [endX, endY],
              [startX, startY],
              [startX, startY],
            ];

            const lineAnnotation: LineAnnotation = {
              id: `imported-line-${Date.now()}-${index}`,
              type: "line",
              polygon: linePolygon,
              hasArrowHead: true, // Imported arrows display arrow heads
              text: arrow.Text,
              style: {
                fillColor: [0, 0, 0, 0], // Transparent fill
                lineColor: [255, 255, 255, 255], // White line
                lineWidth: 3,
              },
              metadata: {
                createdAt: new Date(),
                label: arrow.Text,
                isImported: true,
              },
            };
            newAnnotations.push(lineAnnotation);
          }
        });

        // Convert overlays (rectangles) to annotations (coordinates are normalized 0-1 relative to max dimension, convert to image pixels)
        overlays.forEach((overlay, index) => {
          // Convert normalized coordinates to image pixels (relative to max dimension)
          const x = overlay.x * maxDimension;
          const y = overlay.y * maxDimension;
          const width = overlay.width * maxDimension;
          const height = overlay.height * maxDimension;

          const polygon = rectangleToPolygon([x, y], [x + width, y + height]);

          const rectAnnotation: RectangleAnnotation = {
            id: `imported-rect-${Date.now()}-${index}`,
            type: "rectangle",
            polygon,
            style: {
              fillColor: [255, 255, 255, 30], // White with very low opacity
              lineColor: [255, 255, 255, 200], // White border
              lineWidth: 2,
            },
            metadata: {
              createdAt: new Date(),
              label: `Region ${index + 1}`,
              isImported: true,
            },
          };
          newAnnotations.push(rectAnnotation);
        });

        // Add all new annotations to the store
        // If clearExisting is true, filter out old imported annotations in the same operation
        set((state) => {
          const existingAnnotations = clearExisting
            ? state.annotations.filter((a) => !a.metadata?.isImported)
            : state.annotations;

          const newHiddenLayers = clearExisting
            ? new Set(
                [...state.hiddenLayers].filter((id) => {
                  const annotation = state.annotations.find((a) => a.id === id);
                  return annotation && !annotation.metadata?.isImported;
                }),
              )
            : state.hiddenLayers;

          return {
            annotations: [...existingAnnotations, ...newAnnotations],
            hiddenLayers: newHiddenLayers,
          };
        });
      },

      clearImportedAnnotations: () => {
        set((state) => ({
          annotations: state.annotations.filter((a) => !a.metadata?.isImported),
          hiddenLayers: new Set(
            [...state.hiddenLayers].filter((id) => {
              const annotation = state.annotations.find((a) => a.id === id);
              return annotation && !annotation.metadata?.isImported;
            }),
          ),
        }));
      },

      // channel and group actions
      //
      setActiveChannelGroup: (channelGroupId: string) => {
        console.log("Store: Setting active channel group ID:", channelGroupId);
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

      // Waypoint view state actions
      setTargetWaypointViewState: (
        pan: [number, number] | null,
        zoom: number | null,
      ) => {
        set({ targetWaypointPan: pan, targetWaypointZoom: zoom });
      },

      clearTargetWaypointViewState: () => {
        set({ targetWaypointPan: null, targetWaypointZoom: null });
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
