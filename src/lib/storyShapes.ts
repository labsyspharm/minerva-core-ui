/**
 * Canonical waypoint annotation geometry for persistence (`story.json` / `StoryShape`).
 * Waypoints reference records by UUID (`StoreStoryWaypoint.shapes`, exhibit `ShapeIds`);
 * full definitions live in Zustand `Shapes` / `ItemRegistry.Shapes` / `storyDocument.shapes`.
 * Coordinates are image / world pixels.
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

/** A single point in image / world pixel space. */
export type StoryPoint = { x: number; y: number };

export type StoryShapePoint = {
  type: "point";
  uuid: string;
  point: StoryPoint;
};

/**
 * Serialized arrow (matches `story.schema.json`).
 * Key order for `JSON.stringify` is: `type`, `point`, `angle`, optional `label`, `uuid`.
 *
 * `angle` is **radians**: bearing from tip toward tail (+x = 0, CCW), image pixels.
 * Loose JSON may still pass `angle` as a numeric string; it is parsed to a number.
 */
export type StoryShapeArrow = {
  type: "arrow";
  point: StoryPoint;
  angle: number;
  label?: string;
  uuid: string;
};

/** Build arrow shapes in canonical field order for exports (`angle` in radians). */
export function buildStoryShapeArrow(parts: {
  uuid: string;
  point: StoryPoint;
  /** Bearing from tip toward tail, radians (+x = 0, CCW). */
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
      uuid: parts.uuid,
    };
  }
  return {
    type: "arrow",
    point: parts.point,
    angle: parts.angle,
    uuid: parts.uuid,
  };
}

/** Loose arrow at load time (`angle` as number or numeric string, legacy `from`/`to`, `text` caption). */
type StoryShapeArrowLoose = {
  type: "arrow";
  uuid: string;
  point?: StoryPoint;
  angle?: number | string;
  label?: string;
  from?: StoryPoint;
  to?: StoryPoint;
  text?: unknown;
};

/** Parsed angle in radians (for `point` + `angle` form only; not used for `from`/`to`). */
function parseArrowAngleRadians(raw: unknown, uuid: string): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) {
      return n;
    }
  }
  throw new Error(`minerva: invalid arrow angle for uuid ${uuid}`);
}

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
 * Drops shapes that were only referenced by this waypoint's previous shape ids
 * (unless another waypoint still references them), then upserts new records.
 */
export function mergeShapesForWaypointPersist(params: {
  stories: { shapes: string[] }[];
  storyIndex: number;
  prevShapes: StoryShape[];
  builtShapes: StoryShape[];
  newShapeIdsOrdered: string[];
}): StoryShape[] {
  const { stories, storyIndex, prevShapes, builtShapes, newShapeIdsOrdered } =
    params;
  const story = stories[storyIndex];
  const oldIds = story?.shapes ?? [];
  const newShapeIdSet = new Set(newShapeIdsOrdered);

  const otherRefs = new Set<string>();
  for (let j = 0; j < stories.length; j++) {
    if (j === storyIndex) continue;
    for (const id of stories[j].shapes ?? []) {
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
        const label = a.text?.trim() || a.metadata?.label?.trim() || undefined;
        const angleRad = Math.atan2(from.y - to.y, from.x - to.x);
        return buildStoryShapeArrow({
          uuid,
          point: to,
          angle: angleRad,
          label,
        });
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
      angle: parseArrowAngleRadians(shape.angle, shape.uuid),
    };
  }
  if (shape.from && shape.to) {
    const tip = shape.to;
    const tail = shape.from;
    const angleRad = Math.atan2(tail.y - tip.y, tail.x - tip.x);
    return { point: tip, angle: angleRad };
  }
  throw new Error(`minerva: invalid arrow shape (uuid ${shape.uuid})`);
}

export type ShapeToAnnotationContext = {
  imageWidth: number;
  imageHeight: number;
};

export function shapeToAnnotation(
  shape: StoryShape,
  context?: ShapeToAnnotationContext,
): Annotation {
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
        id: shape.uuid,
        type: "line",
        polygon: arrowLineDegeneratePolygon(tail, tip),
        hasArrowHead: true,
        style: { ...importedLineStyle },
        ...(caption ? { text: caption } : {}),
        metadata: {
          isImported: true,
          ...(caption ? { label: caption } : {}),
        },
      } satisfies LineAnnotation;
    }
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}
