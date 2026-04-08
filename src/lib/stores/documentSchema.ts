/**
 * Zod validation for persisted `story.json` (synced on `useDocumentStore.jsonExport`).
 *
 * Wire-format types are inferred from these schemas (`z.infer`). {@link buildJsonExport}
 * in `util/jsonExport.ts` composes a payload and runs {@link parseJsonExport}.
 */

import { z } from "zod";

/** `discriminatedUnion` branches must be plain `z.object` nodes. */
const storyPointZ = z.object({
  x: z.number(),
  y: z.number(),
});

const storyViewportZ = z.object({
  upperLeft: storyPointZ,
  lowerRight: storyPointZ,
});

const storyWaypointObjectZ = z.object({
  id: z.string(),
  title: z.string(),
  name: z.string().optional(),
  content: z.string(),
  groupId: z.string().optional(),
  thumbnail: z.string().optional(),
  viewport: storyViewportZ,
  shapeIds: z.array(z.string()),
});

const StoryWaypointSchema = z.preprocess((raw) => {
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
}, storyWaypointObjectZ);

/** Output shape of {@link StoryWaypointSchema} (preprocess does not widen fields). */
export type StoryWaypoint = z.infer<typeof storyWaypointObjectZ>;

const storyShapePointZ = z.object({
  type: z.literal("point"),
  id: z.string(),
  point: storyPointZ,
});

const storyShapeArrowZ = z.object({
  type: z.literal("arrow"),
  point: storyPointZ,
  angle: z.coerce.number(),
  label: z.string().optional(),
  id: z.string(),
});

const storyShapePolygonZ = z.object({
  type: z.literal("polygon"),
  id: z.string(),
  points: z.array(storyPointZ),
});

const storyShapePolylineZ = z.object({
  type: z.literal("polyline"),
  id: z.string(),
  points: z.array(storyPointZ),
});

const storyShapeTextZ = z.object({
  type: z.literal("text"),
  id: z.string(),
  content: z.string(),
  point: storyPointZ,
});

export const StoryShapeSchema = z.discriminatedUnion("type", [
  storyShapePointZ,
  storyShapeArrowZ,
  storyShapePolygonZ,
  storyShapePolylineZ,
  storyShapeTextZ,
]);

export type StoryPoint = z.infer<typeof storyPointZ>;
export type StoryViewport = z.infer<typeof storyViewportZ>;
export type StoryShapePoint = z.infer<typeof storyShapePointZ>;
export type StoryShapeArrow = z.infer<typeof storyShapeArrowZ>;
export type StoryShapePolygon = z.infer<typeof storyShapePolygonZ>;
export type StoryShapePolyline = z.infer<typeof storyShapePolylineZ>;
export type StoryShapeText = z.infer<typeof storyShapeTextZ>;

/** Union of branch types so `switch (shape.type)` narrows correctly in TypeScript. */
export type StoryShape =
  | StoryShapePoint
  | StoryShapeArrow
  | StoryShapePolygon
  | StoryShapePolyline
  | StoryShapeText;

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

function preprocessJsonExport(raw: unknown): unknown {
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

const jsonExportCoreSchema = z.object({
  version: z.union([z.literal("1"), z.literal("2")]),
  waypoints: z.array(StoryWaypointSchema),
  shapes: z.array(StoryShapeSchema),
});

/** Root object validated for `story.json` export/import. */
export type JsonExport = z.infer<typeof jsonExportCoreSchema>;
export type StoryFormatVersion = JsonExport["version"];

export const JsonExportSchema = z.preprocess(
  preprocessJsonExport,
  jsonExportCoreSchema,
);

export function safeParseJsonExport(data: unknown) {
  return JsonExportSchema.safeParse(data);
}

export function parseJsonExport(data: unknown): JsonExport {
  return JsonExportSchema.parse(data);
}
