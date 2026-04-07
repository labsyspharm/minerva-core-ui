/**
 * Canonical waypoint annotation geometry for persistence and export.
 * Waypoints reference records by UUID (`ShapeIds`); full definitions live in
 * `ItemRegistry.Shapes`. Coordinates are world / image pixels — the same form
 * used in serialized story JSON (`shapes` array).
 */

import {
  importedLineStyle,
  importedPointStyle,
  importedPolygonStyle,
  importedPolylineStyle,
  importedTextStyle,
} from "./annotationDefaults";
import { arrowLineDegeneratePolygon } from "./annotationGeometry";
import type {
  Annotation,
  LineAnnotation,
  PointAnnotation,
  PolygonAnnotation,
  PolylineAnnotation,
  TextAnnotation,
} from "./stores";

/** A single point in image / world pixel space (matches export `{ x, y }`). */
export type StoryPoint = { x: number; y: number };

export type StoryShapePoint = {
  type: "point";
  uuid: string;
  point: StoryPoint;
};

/** Segment in world pixels; arrow head at `to`. */
export type StoryShapeArrow = {
  type: "arrow";
  uuid: string;
  from: StoryPoint;
  to: StoryPoint;
};

export type StoryShapePolygon = {
  type: "polygon";
  uuid: string;
  points: StoryPoint[];
};

export type StoryShapePolyline = {
  type: "polyline";
  uuid: string;
  points: StoryPoint[];
};

export type StoryShapeText = {
  type: "text";
  uuid: string;
  content: string;
  point: StoryPoint;
};

export type StoryShape =
  | StoryShapePoint
  | StoryShapeArrow
  | StoryShapePolygon
  | StoryShapePolyline
  | StoryShapeText;

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

/**
 * Merge the shape registry when persisting one waypoint's annotations.
 * Drops shapes that were only referenced by this waypoint's previous `ShapeIds`
 * (unless another waypoint still references them), then upserts new records.
 */
export function mergeShapesForWaypointPersist(params: {
  stories: { ShapeIds?: string[] }[];
  storyIndex: number;
  prevShapes: StoryShape[];
  builtShapes: StoryShape[];
  newShapeIdsOrdered: string[];
}): StoryShape[] {
  const { stories, storyIndex, prevShapes, builtShapes, newShapeIdsOrdered } =
    params;
  const story = stories[storyIndex];
  const oldIds = story?.ShapeIds ?? [];
  const newShapeIdSet = new Set(newShapeIdsOrdered);

  const otherRefs = new Set<string>();
  for (let j = 0; j < stories.length; j++) {
    if (j === storyIndex) continue;
    for (const id of stories[j].ShapeIds ?? []) {
      otherRefs.add(id);
    }
  }

  const next = prevShapes.filter((s) => {
    const wasOnThisStory = oldIds.includes(s.uuid);
    if (!wasOnThisStory) return true;
    if (newShapeIdSet.has(s.uuid)) return true;
    if (otherRefs.has(s.uuid)) return true;
    return false;
  });

  const byUuid = new Map(next.map((shape) => [shape.uuid, shape]));
  for (const s of builtShapes) {
    byUuid.set(s.uuid, s);
  }
  return [...byUuid.values()];
}

export function annotationToShape(ann: Annotation): StoryShape | null {
  const uuid = ann.id;
  switch (ann.type) {
    case "point": {
      const a = ann as PointAnnotation;
      return {
        type: "point",
        uuid,
        point: storyPointFromTuple(a.position),
      };
    }
    case "text": {
      const a = ann as TextAnnotation;
      return {
        type: "text",
        uuid,
        content: a.text ?? "",
        point: storyPointFromTuple(a.position),
      };
    }
    case "polyline": {
      const a = ann as PolylineAnnotation;
      const pts = openPolylinePoints(a.polygon).map(storyPointFromTuple);
      if (pts.length < 2) return null;
      return { type: "polyline", uuid, points: pts };
    }
    case "polygon": {
      const a = ann as PolygonAnnotation;
      const pts = a.polygon.map(storyPointFromTuple);
      if (pts.length < 3) return null;
      return { type: "polygon", uuid, points: pts };
    }
    case "line": {
      const a = ann as LineAnnotation;
      const poly = a.polygon;
      if (poly.length < 2) return null;
      const from = storyPointFromTuple(poly[0]);
      const to = storyPointFromTuple(poly[1]);
      const arrowHead = a.hasArrowHead !== false;
      if (arrowHead) {
        return { type: "arrow", uuid, from, to };
      }
      return {
        type: "polyline",
        uuid,
        points: [from, to],
      };
    }
    default:
      return null;
  }
}

export function annotationsToShapes(annotations: Annotation[]): StoryShape[] {
  const out: StoryShape[] = [];
  for (const a of annotations) {
    const s = annotationToShape(a);
    if (s) out.push(s);
  }
  return out;
}

function tupleFromPoint(p: StoryPoint): [number, number] {
  return [p.x, p.y];
}

export function shapeToAnnotation(shape: StoryShape): Annotation {
  switch (shape.type) {
    case "point":
      return {
        id: shape.uuid,
        type: "point",
        position: tupleFromPoint(shape.point),
        style: { ...importedPointStyle },
        metadata: { isImported: true },
      } satisfies PointAnnotation;
    case "text":
      return {
        id: shape.uuid,
        type: "text",
        position: tupleFromPoint(shape.point),
        text: shape.content ?? "",
        style: { ...importedTextStyle },
        metadata: { isImported: true, label: shape.content },
      } satisfies TextAnnotation;
    case "polygon": {
      const polygon = shape.points.map(tupleFromPoint) as [number, number][];
      return {
        id: shape.uuid,
        type: "polygon",
        polygon,
        style: { ...importedPolygonStyle },
        metadata: { isImported: true },
      } satisfies PolygonAnnotation;
    }
    case "polyline": {
      const polygon = shape.points.map(tupleFromPoint) as [number, number][];
      return {
        id: shape.uuid,
        type: "polyline",
        polygon,
        style: { ...importedPolylineStyle },
        metadata: { isImported: true },
      } satisfies PolylineAnnotation;
    }
    case "arrow": {
      const start = tupleFromPoint(shape.from);
      const end = tupleFromPoint(shape.to);
      return {
        id: shape.uuid,
        type: "line",
        polygon: arrowLineDegeneratePolygon(start, end),
        hasArrowHead: true,
        style: { ...importedLineStyle },
        metadata: { isImported: true },
      } satisfies LineAnnotation;
    }
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}
