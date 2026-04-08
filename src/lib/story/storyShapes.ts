/** Viewer `Shape` ↔ persisted `StoryShape` in `storyJsonModel`. */

import {
  importedLineStyle,
  importedPointStyle,
  importedPolygonStyle,
  importedPolylineStyle,
  importedTextStyle,
} from "../shapes/shapeDefaults";
import { arrowLineDegeneratePolygon } from "../shapes/shapeGeometry";
import type {
  LineShape,
  PointShape,
  PolygonShape,
  PolylineShape,
  Shape,
  TextShape,
} from "../shapes/shapeModel";
import type { StoryPoint, StoryShape, StoryShapeArrow } from "./storyJsonModel";

export type {
  StoryPoint,
  StoryShape,
  StoryShapeArrow,
  StoryShapePoint,
  StoryShapePolygon,
  StoryShapePolyline,
  StoryShapeText,
} from "./storyJsonModel";

/** Export arrow (`angle` radians); import tolerates string `angle` and legacy `from`/`to`/`text`. */
export function buildStoryShapeArrow(parts: {
  id: string;
  point: StoryPoint;
  angle: number;
  label?: string;
}): StoryShapeArrow {
  const trimmed = parts.label?.trim();
  if (trimmed) {
    return {
      type: "arrow",
      point: parts.point,
      angle: parts.angle,
      label: trimmed,
      id: parts.id,
    };
  }
  return {
    type: "arrow",
    point: parts.point,
    angle: parts.angle,
    id: parts.id,
  };
}

/** Loose arrow at load time (`angle` as number or numeric string, legacy `from`/`to`, `text` caption). */
type StoryShapeArrowLoose = {
  type: "arrow";
  id?: string;
  uuid?: string;
  point?: StoryPoint;
  angle?: number | string;
  label?: string;
  from?: StoryPoint;
  to?: StoryPoint;
  text?: unknown;
};

function storyShapeArrowLocalId(s: { id?: string; uuid?: string }): string {
  return s.id ?? s.uuid ?? "";
}

/** Parsed angle in radians (for `point` + `angle` form only; not used for `from`/`to`). */
function parseArrowAngleRadians(raw: unknown, shapeId: string): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) {
      return n;
    }
  }
  throw new Error(`minerva: invalid arrow angle for shape id ${shapeId}`);
}

export function storyPointFromTuple(p: [number, number]): StoryPoint {
  return { x: p[0], y: p[1] };
}

export function tupleFromStoryPoint(p: StoryPoint): [number, number] {
  return [p.x, p.y];
}

/** Drop closing vertex when it duplicates the first (closed rings). */
export function openPolylinePoints(
  polygon: [number, number][],
): [number, number][] {
  if (polygon.length < 2) return [...polygon];
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return polygon.slice(0, -1);
  }
  return [...polygon];
}

/** After saving one waypoint: remove shapes only it used, merge in new geometry. */
export function mergeShapesForWaypointPersist(params: {
  waypoints: { shapeIds: string[] }[];
  waypointIndex: number;
  prevShapes: StoryShape[];
  builtShapes: StoryShape[];
  newShapeIdsOrdered: string[];
}): StoryShape[] {
  const {
    waypoints,
    waypointIndex,
    prevShapes,
    builtShapes,
    newShapeIdsOrdered,
  } = params;
  const wp = waypoints[waypointIndex];
  const oldIds = wp?.shapeIds ?? [];
  const newShapeIdSet = new Set(newShapeIdsOrdered);

  const otherRefs = new Set<string>();
  for (let j = 0; j < waypoints.length; j++) {
    if (j === waypointIndex) continue;
    for (const id of waypoints[j].shapeIds ?? []) {
      otherRefs.add(id);
    }
  }

  const next = prevShapes.filter((s) => {
    const sid = s.id;
    const wasOnThisStory = oldIds.includes(sid);
    if (!wasOnThisStory) return true;
    if (newShapeIdSet.has(sid)) return true;
    if (otherRefs.has(sid)) return true;
    return false;
  });

  const byId = new Map(next.map((shape) => [shape.id, shape]));
  for (const s of builtShapes) {
    byId.set(s.id, s);
  }
  return [...byId.values()];
}

export function viewerShapeToStoryShape(viewer: Shape): StoryShape | null {
  const id = viewer.id;
  switch (viewer.type) {
    case "point": {
      const a = viewer as PointShape;
      return {
        type: "point",
        id,
        point: storyPointFromTuple(a.position),
      };
    }
    case "text": {
      const a = viewer as TextShape;
      return {
        type: "text",
        id,
        content: a.text ?? "",
        point: storyPointFromTuple(a.position),
      };
    }
    case "polyline": {
      const a = viewer as PolylineShape;
      const pts = openPolylinePoints(a.polygon).map(storyPointFromTuple);
      if (pts.length < 2) return null;
      return { type: "polyline", id, points: pts };
    }
    case "polygon": {
      const a = viewer as PolygonShape;
      const pts = a.polygon.map(storyPointFromTuple);
      if (pts.length < 3) return null;
      return { type: "polygon", id, points: pts };
    }
    case "line": {
      const a = viewer as LineShape;
      const poly = a.polygon;
      if (poly.length < 2) return null;
      const from = storyPointFromTuple(poly[0]);
      const to = storyPointFromTuple(poly[1]);
      const arrowHead = a.hasArrowHead !== false;
      if (arrowHead) {
        const label = a.text?.trim() || a.metadata?.label?.trim() || undefined;
        const angleRad = Math.atan2(from.y - to.y, from.x - to.x);
        return buildStoryShapeArrow({
          id,
          point: to,
          angle: angleRad,
          label,
        });
      }
      return {
        type: "polyline",
        id,
        points: [from, to],
      };
    }
    default:
      return null;
  }
}

export function viewerShapesToStoryShapes(shapes: Shape[]): StoryShape[] {
  const out: StoryShape[] = [];
  for (const v of shapes) {
    const s = viewerShapeToStoryShape(v);
    if (s) out.push(s);
  }
  return out;
}

function tupleFromPoint(p: StoryPoint): [number, number] {
  return [p.x, p.y];
}

/** Caption for arrows; older JSON may use `text` instead of `label` — treat as `label`. */
function arrowCaptionFromShape(
  shape: StoryShapeArrowLoose,
): string | undefined {
  const fromLabel = shape.label?.trim();
  if (fromLabel) return fromLabel;
  if (typeof shape.text === "string") {
    const t = shape.text.trim();
    return t || undefined;
  }
  return undefined;
}

function arrowPointAngleFromInput(shape: StoryShapeArrowLoose): {
  point: StoryPoint;
  angle: number;
} {
  const hasAngleField =
    shape.angle !== undefined &&
    shape.angle !== null &&
    !(typeof shape.angle === "string" && shape.angle.trim() === "");

  if (shape.point && hasAngleField) {
    return {
      point: shape.point,
      angle: parseArrowAngleRadians(shape.angle, storyShapeArrowLocalId(shape)),
    };
  }
  if (shape.from && shape.to) {
    const tip = shape.to;
    const tail = shape.from;
    const angleRad = Math.atan2(tail.y - tip.y, tail.x - tip.x);
    return { point: tip, angle: angleRad };
  }
  throw new Error(
    `minerva: invalid arrow shape (id ${storyShapeArrowLocalId(shape)})`,
  );
}

export type StoryShapeToViewerContext = {
  imageWidth: number;
  imageHeight: number;
};

export function storyShapeToViewer(
  shape: StoryShape,
  context?: StoryShapeToViewerContext,
): Shape {
  switch (shape.type) {
    case "point":
      return {
        id: shape.id,
        type: "point",
        position: tupleFromPoint(shape.point),
        style: { ...importedPointStyle },
        metadata: { isImported: true },
      } satisfies PointShape;
    case "text":
      return {
        id: shape.id,
        type: "text",
        position: tupleFromPoint(shape.point),
        text: shape.content ?? "",
        style: { ...importedTextStyle },
        metadata: { isImported: true, label: shape.content },
      } satisfies TextShape;
    case "polygon": {
      const polygon = shape.points.map(tupleFromPoint) as [number, number][];
      return {
        id: shape.id,
        type: "polygon",
        polygon,
        style: { ...importedPolygonStyle },
        metadata: { isImported: true },
      } satisfies PolygonShape;
    }
    case "polyline": {
      const polygon = shape.points.map(tupleFromPoint) as [number, number][];
      return {
        id: shape.id,
        type: "polyline",
        polygon,
        style: { ...importedPolylineStyle },
        metadata: { isImported: true },
      } satisfies PolylineShape;
    }
    case "arrow": {
      const { point, angle: angleRad } = arrowPointAngleFromInput(shape);
      const tip = tupleFromPoint(point);
      const minDim = context
        ? Math.min(context.imageWidth, context.imageHeight)
        : 800;
      const lineLength = minDim * 0.5;
      const tail: [number, number] = [
        tip[0] + Math.cos(angleRad) * lineLength,
        tip[1] + Math.sin(angleRad) * lineLength,
      ];
      const caption = arrowCaptionFromShape(shape);
      return {
        id: shape.id,
        type: "line",
        polygon: arrowLineDegeneratePolygon(tail, tip),
        hasArrowHead: true,
        style: { ...importedLineStyle },
        ...(caption ? { text: caption } : {}),
        metadata: {
          isImported: true,
          ...(caption ? { label: caption } : {}),
        },
      } satisfies LineShape;
    }
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}
