/**
 * Canonical Zod schemas and types for exhibit/story document data (waypoints, shapes,
 * channels, groups, images). Legacy wire normalization: `storeUtils.ts` (`normalizeWaypointRecord`,
 * `preprocessDocumentDataRaw`, …). UUID coercion: `validateDocument.ts`.
 */
import { z } from "zod";
import {
  normalizeWaypointRecord,
  preprocessJsonExportRoot,
} from "./storeUtils";

/* -------------------- shared primitives -------------------- */

export const IdSchema = z.string().uuid();

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

/** One logical channel under an image (persisted). `id` is stable across the document. */
export const ImageChannelSchema = z.object({
  id: IdSchema,
  index: z.number().int().min(0),
  name: z.string(),
  samples: z.number().int().optional(),
  sourceDataTypeId: z.string().optional(),
  sourceDistribution: SourceDistributionSchema.optional(),
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
  channels: z.array(ImageChannelSchema),
});

/** Group row: `channelId` is {@link ImageChannelSchema}`id`; `id` is the UI / range-slider row id. */
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
export type ImageChannel = z.infer<typeof ImageChannelSchema>;

/**
 * Flattened view of a nested channel plus parent `imageId` (for Viv / ItemRegistry).
 * Build lists with `flattenImageChannelsInDocumentOrder` in `storeUtils.ts`.
 */
export type Channel = ImageChannel & {
  imageId: string;
};

export type GroupChannel = z.infer<typeof GroupChannelSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Waypoint = z.infer<typeof WaypointSchema>;
export type SourceDistributionData = z.infer<typeof SourceDistributionSchema>;

export type DocumentData = z.infer<typeof DocumentDataSchema>;

/** Aliases that disambiguate from viewer-side types with the same name. */
export type StoryShape = Shape;
export type StoryWaypoint = Waypoint;

/* -------------------- story.json root (version + waypoints + shapes) -------------------- */

const jsonExportCoreSchema = z.object({
  version: z.union([z.literal("1"), z.literal("2")]),
  waypoints: z.array(WaypointSchema),
  shapes: z.array(ShapeSchema),
});

export type JsonExport = z.infer<typeof jsonExportCoreSchema>;

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

export function parseJsonExport(data: unknown): JsonExport {
  return JsonExportSchema.parse(data);
}

/** Build validated {@link JsonExport} for `story.json`. */
export function buildJsonExport(
  waypointRows: StoryWaypoint[],
  shapeList: StoryShape[],
): JsonExport {
  return JsonExportSchema.parse({
    version: "2",
    waypoints: waypointRows.map((w) => ({
      ...w,
      shapeIds: [...w.shapeIds],
    })),
    shapes: [...shapeList],
  });
}
