/**
 * `story.json`: explicit TS types + Zod schemas (`strict: false` breaks `z.infer`).
 * `parseStoryDocument` / `safeParseStoryDocument` validate **any** load or the object built in `exportStoryDocument`.
 */

import { z } from "zod";

export interface StoryPoint {
  x: number;
  y: number;
}

export interface StoryViewport {
  upperLeft: StoryPoint;
  lowerRight: StoryPoint;
}

export interface StoryWaypoint {
  id: string;
  title: string;
  name?: string;
  content: string;
  groupId?: string;
  thumbnail?: string;
  viewport: StoryViewport;
  shapeIds: string[];
}

export interface StoryShapePoint {
  type: "point";
  id: string;
  point: StoryPoint;
}

/** Radians from tip toward tail (+x = 0, CCW). */
export interface StoryShapeArrow {
  type: "arrow";
  point: StoryPoint;
  angle: number;
  label?: string;
  id: string;
}

export interface StoryShapePolygon {
  type: "polygon";
  id: string;
  points: StoryPoint[];
}

export interface StoryShapePolyline {
  type: "polyline";
  id: string;
  points: StoryPoint[];
}

export interface StoryShapeText {
  type: "text";
  id: string;
  content: string;
  point: StoryPoint;
}

export type StoryShape =
  | StoryShapePoint
  | StoryShapeArrow
  | StoryShapePolygon
  | StoryShapePolyline
  | StoryShapeText;

export type StoryFormatVersion = "1" | "2";

export interface StoryDocument {
  version: StoryFormatVersion;
  waypoints: StoryWaypoint[];
  shapes: StoryShape[];
}

/** `discriminatedUnion` branches must be plain `z.object` nodes. */
const storyPointZ = z.object({
  x: z.number(),
  y: z.number(),
});

const storyViewportZ = z.object({
  upperLeft: storyPointZ,
  lowerRight: storyPointZ,
});

const StoryWaypointSchema = z.preprocess(
  (raw) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return raw;
    }
    const w = { ...(raw as Record<string, unknown>) };
    if (
      !("shapeIds" in w) &&
      "shapes" in w &&
      Array.isArray((w as { shapes?: unknown }).shapes)
    ) {
      w.shapeIds = (w as { shapes: string[] }).shapes;
    }
    if (
      !("groupId" in w) &&
      "group" in w &&
      typeof (w as { group?: unknown }).group === "string"
    ) {
      w.groupId = (w as { group: string }).group;
    }
    return w;
  },
  z.object({
    id: z.string(),
    title: z.string(),
    name: z.string().optional(),
    content: z.string(),
    groupId: z.string().optional(),
    thumbnail: z.string().optional(),
    viewport: storyViewportZ,
    shapeIds: z.array(z.string()),
  }),
) as z.ZodType<StoryWaypoint>;

export const StoryShapeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("point"),
    id: z.string(),
    point: storyPointZ,
  }),
  z.object({
    type: z.literal("arrow"),
    point: storyPointZ,
    angle: z.coerce.number(),
    label: z.string().optional(),
    id: z.string(),
  }),
  z.object({
    type: z.literal("polygon"),
    id: z.string(),
    points: z.array(storyPointZ),
  }),
  z.object({
    type: z.literal("polyline"),
    id: z.string(),
    points: z.array(storyPointZ),
  }),
  z.object({
    type: z.literal("text"),
    id: z.string(),
    content: z.string(),
    point: storyPointZ,
  }),
]) as unknown as z.ZodType<StoryShape>;

function normalizeRawStoryShape(shape: unknown): unknown {
  if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
    return shape;
  }
  const s = shape as Record<string, unknown>;
  let next: Record<string, unknown> = { ...s };
  if (typeof next.uuid === "string" && next.id === undefined) {
    next = { ...next, id: next.uuid };
  }
  if (next.type !== "arrow") return next;
  if (typeof next.text === "string" && next.label === undefined) {
    next = { ...next, label: next.text };
  }

  const hasPoint =
    next.point !== null &&
    typeof next.point === "object" &&
    !Array.isArray(next.point);
  const angle = next.angle;
  const hasAngle =
    angle !== undefined &&
    angle !== null &&
    !(typeof angle === "string" && (angle as string).trim() === "");

  if (hasPoint && hasAngle) {
    return next;
  }

  const from = next.from as { x?: number; y?: number } | undefined;
  const to = next.to as { x?: number; y?: number } | undefined;
  if (
    from &&
    to &&
    typeof from.x === "number" &&
    typeof from.y === "number" &&
    typeof to.x === "number" &&
    typeof to.y === "number"
  ) {
    return {
      ...next,
      point: to,
      angle: Math.atan2(from.y - to.y, from.x - to.x),
    };
  }
  return next;
}

function preprocessStoryDocument(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const d = raw as Record<string, unknown>;
  const shapes = d.shapes;
  const waypoints = d.waypoints;
  let next = { ...d };
  if (Array.isArray(shapes)) {
    next = {
      ...next,
      shapes: shapes.map(normalizeRawStoryShape),
    };
  }
  if (Array.isArray(waypoints)) {
    next = {
      ...next,
      waypoints: waypoints.map((wp) => {
        if (wp === null || typeof wp !== "object" || Array.isArray(wp)) {
          return wp;
        }
        const w = { ...(wp as Record<string, unknown>) };
        if (
          !("shapeIds" in w) &&
          "shapes" in w &&
          Array.isArray((w as { shapes?: unknown }).shapes)
        ) {
          w.shapeIds = (w as { shapes: string[] }).shapes;
        }
        if (
          !("groupId" in w) &&
          "group" in w &&
          typeof (w as { group?: unknown }).group === "string"
        ) {
          w.groupId = (w as { group: string }).group;
        }
        return w;
      }),
    };
  }
  return next;
}

const storyDocumentCoreSchema = z.object({
  version: z.union([z.literal("1"), z.literal("2")]),
  waypoints: z.array(StoryWaypointSchema),
  shapes: z.array(StoryShapeSchema),
}) as z.ZodType<StoryDocument>;

export const StoryDocumentSchema = z.preprocess(
  preprocessStoryDocument,
  storyDocumentCoreSchema,
) as z.ZodType<StoryDocument>;

export function safeParseStoryDocument(data: unknown) {
  return StoryDocumentSchema.safeParse(data);
}

export function parseStoryDocument(data: unknown): StoryDocument {
  return StoryDocumentSchema.parse(data);
}
