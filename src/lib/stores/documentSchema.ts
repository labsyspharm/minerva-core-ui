/**
 * Canonical Zod schemas and types for exhibit/story document data (waypoints, shapes,
 * channels, groups, images). Legacy wire keys are normalized in {@link preprocessDocumentDataRaw}
 * / {@link normalizeWaypointRecord}; UUID coercion lives in `validateDocument.ts`.
 */
import { z } from "zod";

/* -------------------- shared primitives -------------------- */

export const IdSchema = z.string().uuid();

/** Channel.imageId may reference exhibit keys that are not UUIDs. */
export const ImageKeySchema = z.string().min(1);

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const ViewportSchema = z.object({
  upperLeft: PointSchema,
  lowerRight: PointSchema,
});

export const ColorSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

/* -------------------- shapes -------------------- */

const BaseShapeSchema = z.object({
  id: IdSchema,
});

export const PointShapeSchema = BaseShapeSchema.extend({
  type: z.literal("point"),
  point: PointSchema,
});

export const ArrowShapeSchema = BaseShapeSchema.extend({
  type: z.literal("arrow"),
  point: PointSchema,
  angle: z.coerce.number(),
  label: z.string().default(""),
});

export const PolygonShapeSchema = BaseShapeSchema.extend({
  type: z.literal("polygon"),
  points: z.array(PointSchema).min(3),
});

export const PolylineShapeSchema = BaseShapeSchema.extend({
  type: z.literal("polyline"),
  points: z.array(PointSchema).min(2),
});

export const TextShapeSchema = BaseShapeSchema.extend({
  type: z.literal("text"),
  point: PointSchema,
  content: z.string(),
});

export const ShapeSchema = z.discriminatedUnion("type", [
  PointShapeSchema,
  ArrowShapeSchema,
  PolygonShapeSchema,
  PolylineShapeSchema,
  TextShapeSchema,
]);

/* -------------------- images / channels / groups -------------------- */

export const SourceDistributionSchema = z.object({
  id: IdSchema,
  YValues: z.array(z.number()),
  XScale: z.string(),
  YScale: z.string(),
  LowerRange: z.number(),
  UpperRange: z.number(),
});

export const ImageSchema = z.object({
  id: IdSchema,
  sizeX: z.number().int().positive(),
  sizeY: z.number().int().positive(),
  sizeC: z.number().int().nonnegative(),
  omero: z
    .object({
      omeroServerName: z.string(),
      imageIdentifier: z.number().int(),
    })
    .optional(),
  omeXmlHash: z.string(),
  basename: z.string(),
});

export const ChannelSchema = z.object({
  id: IdSchema,
  imageId: ImageKeySchema,
  index: z.number().int().min(0),
  name: z.string(),
  samples: z.number().int().optional(),
  sourceDataTypeId: z.string().optional(),
  sourceDistribution: SourceDistributionSchema.optional(),
});

/** Group channel row: `id` is the stable row id (contrast slider / color picker target). */
export const GroupChannelSchema = z.object({
  id: IdSchema,
  channelId: IdSchema,
  color: ColorSchema,
  lowerLimit: z.number(),
  upperLimit: z.number(),
});

export const GroupSchema = z.object({
  id: IdSchema,
  name: z.string(),
  expanded: z.boolean().optional(),
  channels: z.array(GroupChannelSchema),
});

const waypointObjectZ = z.object({
  id: IdSchema,
  groupId: IdSchema.optional(),
  thumbnail: z.string(),
  title: z.string(),
  name: z.string().optional(),
  content: z.string(),
  viewport: ViewportSchema,
  shapeIds: z.array(IdSchema),
});

/** Legacy story.json / exhibit keys on a single waypoint object (`shapes` → `shapeIds`, etc.). */
export function normalizeWaypointRecord(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const w = { ...raw };
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
  if (!("thumbnail" in w) || w.thumbnail == null) {
    w.thumbnail = "";
  }
  return w;
}

export const WaypointSchema = z.preprocess((raw) => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  return normalizeWaypointRecord(raw as Record<string, unknown>);
}, waypointObjectZ);

export const DocumentDataSchema = z.object({
  imageWidth: z.number(),
  imageHeight: z.number(),
  waypoints: z.array(WaypointSchema),
  shapes: z.array(ShapeSchema),
  groups: z.array(GroupSchema),
  channels: z.array(ChannelSchema),
  images: z.array(ImageSchema),
});

/* -------------------- types -------------------- */

export type Id = z.infer<typeof IdSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Viewport = z.infer<typeof ViewportSchema>;
export type Color = z.infer<typeof ColorSchema>;

export type PointShape = z.infer<typeof PointShapeSchema>;
export type ArrowShape = z.infer<typeof ArrowShapeSchema>;
export type PolygonShape = z.infer<typeof PolygonShapeSchema>;
export type PolylineShape = z.infer<typeof PolylineShapeSchema>;
export type TextShape = z.infer<typeof TextShapeSchema>;
export type Shape = z.infer<typeof ShapeSchema>;

export type Image = z.infer<typeof ImageSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type GroupChannel = z.infer<typeof GroupChannelSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Waypoint = z.infer<typeof WaypointSchema>;
export type SourceDistributionData = z.infer<typeof SourceDistributionSchema>;

export type DocumentData = z.infer<typeof DocumentDataSchema>;

/** Back-compat aliases used across authoring / export helpers. */
export type StoryPoint = Point;
export type StoryViewport = Viewport;
export type StoryShape = Shape;
export type StoryWaypoint = Waypoint;
export type StoryShapePoint = PointShape;
export type StoryShapeArrow = ArrowShape;
export type StoryShapePolygon = PolygonShape;
export type StoryShapePolyline = PolylineShape;
export type StoryShapeText = TextShape;

export type ExhibitImage = Image;

function normalizeRawShape(shape: unknown): unknown {
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

/** Preprocess wire JSON (legacy keys, arrow `from`/`to`, etc.) before `DocumentDataSchema` / export parse. */
export function preprocessDocumentDataRaw(raw: unknown): unknown {
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
      shapes: shapes.map(normalizeRawShape),
    };
  }
  if (Array.isArray(waypoints)) {
    next = {
      ...next,
      waypoints: waypoints.map((wp) => {
        if (wp === null || typeof wp !== "object" || Array.isArray(wp)) {
          return wp;
        }
        return normalizeWaypointRecord(wp as Record<string, unknown>);
      }),
    };
  }
  return next;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/* -------------------- story.json root (version + waypoints + shapes) -------------------- */

const jsonExportCoreSchema = z.object({
  version: z.union([z.literal("1"), z.literal("2")]),
  waypoints: z.array(WaypointSchema),
  shapes: z.array(ShapeSchema),
});

export type JsonExport = z.infer<typeof jsonExportCoreSchema>;
export type StoryFormatVersion = JsonExport["version"];

function preprocessJsonExportRoot(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const d = raw as Record<string, unknown>;
  return preprocessDocumentDataRaw({
    ...d,
    imageWidth: 0,
    imageHeight: 0,
    groups: [],
    channels: [],
    images: [],
  });
}

export const JsonExportSchema = z.preprocess((raw) => {
  const expanded = preprocessJsonExportRoot(raw);
  if (
    expanded === null ||
    typeof expanded !== "object" ||
    Array.isArray(expanded)
  ) {
    return expanded;
  }
  const e = expanded as Record<string, unknown>;
  return {
    version: e.version,
    waypoints: e.waypoints,
    shapes: e.shapes,
  };
}, jsonExportCoreSchema);

export function safeParseJsonExport(data: unknown) {
  return JsonExportSchema.safeParse(data);
}

export function parseJsonExport(data: unknown): JsonExport {
  return JsonExportSchema.parse(data);
}
