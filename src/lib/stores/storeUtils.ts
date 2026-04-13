/**
 * Utilities shared across the stores layer:
 *
 * - **Wire preprocess** (`normalizeWaypointRecord`, `preprocessDocumentDataRaw`):
 *   legacy key migration before Zod parse.
 * - **Channel helpers** (`flattenImageChannelsInDocumentOrder`, `findSourceChannel`):
 *   flatten nested `Image.channels` to flat {@link Channel} rows for Viv / UI.
 * - **ConfigWaypoint bridge** (`configWaypointToWaypoint`, `waypointToConfigWaypoint`):
 *   exhibit waypoints to/from the `story.json` wire format.
 * - **Viewer shape conversion** (`storyShapeToViewer`, `viewerShapesToStoryShapes`):
 *   document shapes to/from viewer annotation shapes.
 * - **Legacy migration** (`migrateLegacyWaypointShapes`):
 *   old Arrows/Overlays to shapeIds + StoryShape records.
 *
 * Uses only `import type` from `documentSchema` to avoid a runtime import cycle.
 */

import type { ConfigWaypoint } from "../authoring/config";
import { type Loader, loaderPixelSizeXY } from "../imaging/viv";
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
import { rectangleToPolygon } from "../shapes/shapeModel";
import {
  getWaypointBounds,
  isWaypointBounds,
  type WaypointBounds,
} from "../waypoints/waypoint";
import type {
  ArrowShape,
  Channel,
  Group,
  Image,
  ImageChannel,
  Point,
  StoryShape,
  StoryWaypoint,
  Viewport,
  Waypoint,
} from "./documentSchema";

export type { JsonExport, StoryShape, StoryWaypoint } from "./documentSchema";

export type AuthoringWaypointExtra = Pick<
  ConfigWaypoint,
  "State" | "ViewState" | "Pan" | "Zoom"
>;

/* -------------------- wire preprocess (before Zod) -------------------- */

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
  if (
    !("groupId" in w) &&
    "Group" in w &&
    typeof (w as { Group?: unknown }).Group === "string"
  ) {
    w.groupId = (w as { Group: string }).Group;
  }
  if (!("thumbnail" in w) || w.thumbnail == null) {
    w.thumbnail = "";
  }
  return w;
}

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

/**
 * Expand minimal `story.json` root with synthetic full-document fields, then
 * {@link preprocessDocumentDataRaw} (consumers: `JsonExportSchema` in `documentSchema.ts`).
 */
export function preprocessJsonExportRoot(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const d = raw as Record<string, unknown>;
  return preprocessDocumentDataRaw({
    ...d,
    metadata: {},
    groups: [],
    images: [],
  });
}

/**
 * Flatten nested `Image.channels` into {@link Channel} rows: `images` array order, then each
 * image’s `channels` order. Each row includes `imageId` for Viv and channel-group UI.
 */
export function flattenImageChannelsInDocumentOrder(
  images: Image[],
): Channel[] {
  const out: Channel[] = [];
  for (const im of images) {
    for (const ch of im.channels) {
      out.push({
        ...ch,
        imageId: im.id,
      });
    }
  }
  return out;
}

/** Resolve a flat row by nested channel id (same as `Image.channels[].id`). */
export function findSourceChannel(
  channels: Channel[],
  channelId: string,
): Channel | undefined {
  return channels.find((c) => c.id === channelId);
}

// --- Pure transformations (formerly inline in documentStore actions) -------------------------

export type SetGroupChannelRangeInput = {
  LowerRange: number;
  UpperRange: number;
  groupId: string;
  channelId: string;
};

export type SetGroupChannelRangePayload =
  | SetGroupChannelRangeInput
  | {
      LowerRange: number;
      UpperRange: number;
      group_uuid: string;
      channel_uuid: string;
    };

/** Apply a flat `Channel[]` back onto an `Image[]`, grouping by `imageId`. */
export function applySourceChannelsToImages(
  currentImages: Image[],
  flatChannels: Channel[],
): Image[] {
  const byImage = new Map<string, ImageChannel[]>();
  for (const row of flatChannels) {
    const {
      id,
      imageId,
      index,
      name,
      samples,
      sourceDataTypeId,
      sourceDistribution,
    } = row;
    const slice: ImageChannel = {
      id: id && id.length > 0 ? id : crypto.randomUUID(),
      index,
      name,
      ...(samples !== undefined ? { samples } : {}),
      ...(sourceDataTypeId !== undefined ? { sourceDataTypeId } : {}),
      ...(sourceDistribution !== undefined ? { sourceDistribution } : {}),
    };
    const list = byImage.get(imageId) ?? [];
    list.push(slice);
    byImage.set(imageId, list);
  }
  let nextImages = [...currentImages];
  for (const [imId, chans] of byImage) {
    chans.sort((a, b) => a.index - b.index);
    const idx = nextImages.findIndex((im) => im.id === imId);
    if (idx >= 0) {
      nextImages = [
        ...nextImages.slice(0, idx),
        { ...nextImages[idx], channels: chans },
        ...nextImages.slice(idx + 1),
      ];
    } else {
      nextImages = [
        ...nextImages,
        {
          id: imId,
          sizeX: 1,
          sizeY: 1,
          sizeC: chans.length,
          omeXmlHash: "",
          basename: "",
          channels: chans,
        },
      ];
    }
  }
  return nextImages;
}

/** Set `sizeX`/`sizeY` on the `Image` row matching `imageId` from the Viv loader pyramid/metadata. */
export function applyLoaderPixelSizeToImage(
  images: Image[],
  imageId: string,
  loader: Loader,
): Image[] {
  const dims = loaderPixelSizeXY(loader);
  if (!dims) return [...images];
  const idx = images.findIndex((im) => im.id === imageId);
  if (idx < 0) return [...images];
  const next = [...images];
  next[idx] = { ...next[idx], sizeX: dims.sizeX, sizeY: dims.sizeY };
  return next;
}

/** Normalize a polymorphic range payload and update the matching channel entry. */
export function applyGroupChannelRange(
  groups: Group[],
  raw: SetGroupChannelRangePayload,
): Group[] {
  const lower = raw.LowerRange;
  const upper = raw.UpperRange;
  const groupId =
    "groupId" in raw && raw.groupId !== undefined
      ? raw.groupId
      : (raw as { group_uuid: string }).group_uuid;
  const channelEntryId =
    "channelId" in raw && raw.channelId !== undefined
      ? raw.channelId
      : (raw as { channel_uuid: string }).channel_uuid;
  return groups.map((group) =>
    group.id !== groupId
      ? group
      : {
          ...group,
          channels: group.channels.map((e) =>
            e.id === channelEntryId
              ? { ...e, lowerLimit: lower, upperLimit: upper }
              : e,
          ),
        },
  );
}

// --- Exhibit `ConfigWaypoint` ↔ `story.json` waypoint slice (for building JsonExport) -----

/** Normalize exhibit / legacy waypoint fields into current {@link ConfigWaypoint} shape. */
export function hydrateConfigWaypoint(
  wp: ConfigWaypoint,
  groups: Array<Pick<Group, "id" | "name">>,
): ConfigWaypoint {
  const anyWp = wp as ConfigWaypoint & {
    UUID?: string;
    ShapeIds?: string[];
    Group?: string;
  };
  const id = anyWp.id ?? anyWp.UUID ?? "";
  const shapeIds = anyWp.shapeIds ?? anyWp.ShapeIds ?? [];
  let groupId = anyWp.groupId;
  const legacyGroup = anyWp.Group;
  if (
    groupId === undefined &&
    legacyGroup !== undefined &&
    legacyGroup !== ""
  ) {
    groupId = UUID_RE.test(legacyGroup)
      ? legacyGroup
      : (groups.find((g) => g.name === legacyGroup)?.id ?? legacyGroup);
  }
  const next = {
    ...wp,
    id,
    shapeIds,
    ...(groupId !== undefined ? { groupId } : {}),
  } as ConfigWaypoint & Record<string, unknown>;
  delete next.UUID;
  delete next.ShapeIds;
  delete next.Group;
  return next as ConfigWaypoint;
}

function boundsToExportViewport(b: WaypointBounds): Viewport {
  const minX = Math.min(b.x0, b.x1);
  const maxX = Math.max(b.x0, b.x1);
  const minY = Math.min(b.y0, b.y1);
  const maxY = Math.max(b.y0, b.y1);
  return {
    upperLeft: { x: minX, y: minY },
    lowerRight: { x: maxX, y: maxY },
  };
}

function exportViewportToBounds(v: Viewport): WaypointBounds {
  const x0 = Math.min(v.upperLeft.x, v.lowerRight.x);
  const x1 = Math.max(v.upperLeft.x, v.lowerRight.x);
  const y0 = Math.min(v.upperLeft.y, v.lowerRight.y);
  const y1 = Math.max(v.upperLeft.y, v.lowerRight.y);
  return { x0, x1, y0, y1 };
}

function configWaypointToExportWaypoint(
  wp: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): StoryWaypoint {
  let bounds: WaypointBounds | null = null;
  if (isWaypointBounds(wp.Bounds)) {
    bounds = wp.Bounds;
  } else if (
    imageWidth > 0 &&
    imageHeight > 0 &&
    containerWidth > 0 &&
    containerHeight > 0
  ) {
    bounds = getWaypointBounds(
      wp,
      imageWidth,
      imageHeight,
      containerWidth,
      containerHeight,
    );
  }
  if (!bounds && imageWidth > 0 && imageHeight > 0) {
    bounds = { x0: 0, y0: 0, x1: imageWidth, y1: imageHeight };
  }
  if (!bounds) {
    bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };
  }

  const out: StoryWaypoint = {
    id: wp.id,
    title: wp.Name,
    content: wp.Content ?? "",
    viewport: boundsToExportViewport(bounds),
    shapeIds: [...(wp.shapeIds ?? [])],
  };
  if (wp.groupId) {
    out.groupId = wp.groupId;
  }
  if (wp.ThumbnailDataUrl) {
    out.thumbnail = wp.ThumbnailDataUrl;
  }
  return out;
}

/** Convert a `ConfigWaypoint` to a schema `Waypoint` + an `AuthoringWaypointExtra` sidecar. */
export function configWaypointToWaypoint(
  wp: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): { waypoint: Waypoint; authoring: AuthoringWaypointExtra } {
  const waypoint: Waypoint = configWaypointToExportWaypoint(
    wp,
    imageWidth,
    imageHeight,
    containerWidth,
    containerHeight,
  );
  return {
    waypoint,
    authoring: {
      State: wp.State,
      ViewState: wp.ViewState,
      Pan: wp.Pan,
      Zoom: wp.Zoom,
    },
  };
}

/** Reconstruct a `ConfigWaypoint` from a schema `Waypoint` + optional authoring extras. */
export function waypointToConfigWaypoint(
  wp: Waypoint,
  authoring?: AuthoringWaypointExtra,
): ConfigWaypoint {
  const bounds = exportViewportToBounds(wp.viewport);
  const out: ConfigWaypoint = {
    id: wp.id,
    Name: wp.title,
    Content: wp.content,
    State: authoring?.State ?? { Expanded: false },
    Bounds: bounds,
    shapeIds: [...wp.shapeIds],
    ViewState: authoring?.ViewState,
    Pan: authoring?.Pan,
    Zoom: authoring?.Zoom,
  };
  if (wp.groupId !== undefined) {
    out.groupId = wp.groupId;
  }
  if (wp.thumbnail !== undefined) {
    out.ThumbnailDataUrl = wp.thumbnail;
  }
  return out;
}

/** Map waypoints + authoring map → exhibit `ConfigWaypoint` list (`ItemRegistry.Stories`). */
export function waypointsToConfigWaypoints(
  waypoints: Waypoint[],
  authoringMap: Map<string, AuthoringWaypointExtra>,
): ConfigWaypoint[] {
  return waypoints.map((wp) =>
    waypointToConfigWaypoint(wp, authoringMap.get(wp.id)),
  );
}

// --- Viewer `Shape` ↔ `story.json` `shapes[]` (same wire as JsonExport) -------------------

function buildArrowShape(parts: {
  id: string;
  point: Point;
  angle: number;
  label?: string;
}): ArrowShape {
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
type ArrowShapeLoose = {
  type?: "arrow";
  id?: string;
  uuid?: string;
  point?: Point;
  angle?: number | string;
  label?: string;
  from?: Point;
  to?: Point;
  text?: unknown;
};

function arrowLocalId(s: { id?: string; uuid?: string }): string {
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

function pointFromTuple(p: [number, number]): Point {
  return { x: p[0], y: p[1] };
}

function openPolylinePoints(polygon: [number, number][]): [number, number][] {
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
  waypoints: { shapeIds?: string[] }[];
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

function viewerShapeToStoryShape(viewer: Shape): StoryShape | null {
  const id = viewer.id;
  switch (viewer.type) {
    case "point": {
      const a = viewer as PointShape;
      return {
        type: "point",
        id,
        point: pointFromTuple(a.position),
      };
    }
    case "text": {
      const a = viewer as TextShape;
      return {
        type: "text",
        id,
        content: a.text ?? "",
        point: pointFromTuple(a.position),
      };
    }
    case "polyline": {
      const a = viewer as PolylineShape;
      const pts = openPolylinePoints(a.polygon).map(pointFromTuple);
      if (pts.length < 2) return null;
      return { type: "polyline", id, points: pts };
    }
    case "polygon": {
      const a = viewer as PolygonShape;
      const pts = a.polygon.map(pointFromTuple);
      if (pts.length < 3) return null;
      return { type: "polygon", id, points: pts };
    }
    case "line": {
      const a = viewer as LineShape;
      const poly = a.polygon;
      if (poly.length < 2) return null;
      const from = pointFromTuple(poly[0]);
      const to = pointFromTuple(poly[1]);
      const arrowHead = a.hasArrowHead !== false;
      if (arrowHead) {
        const label = a.text?.trim() || a.metadata?.label?.trim() || undefined;
        const angleRad = Math.atan2(from.y - to.y, from.x - to.x);
        return buildArrowShape({
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

function tupleFromPoint(p: Point): [number, number] {
  return [p.x, p.y];
}

/** Caption for arrows; older JSON may use `text` instead of `label` — treat as `label`. */
function arrowCaptionFromShape(shape: ArrowShapeLoose): string | undefined {
  const fromLabel = shape.label?.trim();
  if (fromLabel) return fromLabel;
  if (typeof shape.text === "string") {
    const t = shape.text.trim();
    return t || undefined;
  }
  return undefined;
}

function arrowPointAngleFromInput(shape: ArrowShapeLoose): {
  point: Point;
  angle: number;
} {
  const hasAngleField =
    shape.angle !== undefined &&
    shape.angle !== null &&
    !(typeof shape.angle === "string" && shape.angle.trim() === "");

  if (shape.point && hasAngleField) {
    return {
      point: shape.point,
      angle: parseArrowAngleRadians(shape.angle, arrowLocalId(shape)),
    };
  }
  if (shape.from && shape.to) {
    const tip = shape.to;
    const tail = shape.from;
    const angleRad = Math.atan2(tail.y - tip.y, tail.x - tip.x);
    return { point: tip, angle: angleRad };
  }
  throw new Error(`minerva: invalid arrow shape (id ${arrowLocalId(shape)})`);
}

type StoryShapeToViewerContext = {
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

// --- Legacy exhibit `Arrows` / `Overlays` → wire ids + shapes (JsonExport-compatible) ---

/** Legacy exhibit arrow / callout (normalized 0–1 coordinates). */
export type LegacyExhibitArrow = {
  Angle: number;
  HideArrow: boolean;
  Point: [number, number];
  Text: string;
  IsPoint?: boolean;
};

/** Legacy rectangle overlay (normalized 0–1 coordinates). */
export type LegacyExhibitOverlay = {
  x: number;
  y: number;
  width: number;
  height: number;
  Group?: string;
};

/**
 * Exhibit seed row that may still carry runtime-only `Arrows` / `Overlays`.
 * After {@link migrateLegacyWaypointShapes}, only {@link ConfigWaypoint} fields remain.
 */
export type LegacyExhibitWaypoint = ConfigWaypoint & {
  Arrows?: LegacyExhibitArrow[];
  Overlays?: LegacyExhibitOverlay[];
  /** Older JSON used `Group` naming; newer wire uses {@link ConfigWaypoint.groupId}. */
  Group?: string;
};

function newLegacyShapeId(): string {
  return crypto.randomUUID();
}

function annotationsFromLegacyArrowsAndOverlays(
  arrows: LegacyExhibitArrow[],
  overlays: LegacyExhibitOverlay[],
  imageWidth: number,
  imageHeight: number,
): Shape[] {
  const maxDimension = Math.max(imageWidth, imageHeight);
  if (maxDimension <= 0) return [];

  const newShapes: Shape[] = [];

  arrows.forEach((arrow, index) => {
    const [normX, normY] = arrow.Point;
    const x = normX * maxDimension;
    const y = normY * maxDimension;

    if (arrow.IsPoint) {
      const pointShape: PointShape = {
        id: newLegacyShapeId(),
        type: "point",
        position: [x, y],
        style: {
          fillColor: [255, 255, 255, 255],
          strokeColor: [255, 255, 255, 255],
          radius: 5,
        },
        metadata: {
          label: arrow.Text || `Point ${index + 1}`,
          isImported: true,
        },
      };
      newShapes.push(pointShape);
    } else if (arrow.HideArrow) {
      const textShape: TextShape = {
        id: newLegacyShapeId(),
        type: "text",
        position: [x, y],
        text: arrow.Text,
        style: {
          fontSize: 16,
          fontColor: [255, 255, 255, 255],
          backgroundColor: [0, 0, 0, 150],
          padding: 6,
        },
        metadata: {
          label: arrow.Text,
          isImported: true,
        },
      };
      newShapes.push(textShape);
    } else {
      const angleRad = (arrow.Angle * Math.PI) / 180;
      const minDimension = Math.min(imageWidth, imageHeight);
      const lineLength = minDimension * 0.5;
      const startX = x + Math.cos(angleRad) * lineLength;
      const startY = y + Math.sin(angleRad) * lineLength;
      const endX = x;
      const endY = y;
      const linePolygon = arrowLineDegeneratePolygon(
        [startX, startY],
        [endX, endY],
      );

      const lineShape: LineShape = {
        id: newLegacyShapeId(),
        type: "line",
        polygon: linePolygon,
        hasArrowHead: true,
        text: arrow.Text,
        style: { ...importedLineStyle },
        metadata: {
          label: arrow.Text,
          isImported: true,
        },
      };
      newShapes.push(lineShape);
    }
  });

  overlays.forEach((overlay, index) => {
    const ox = overlay.x * maxDimension;
    const oy = overlay.y * maxDimension;
    const width = overlay.width * maxDimension;
    const height = overlay.height * maxDimension;
    const polygon = rectangleToPolygon([ox, oy], [ox + width, oy + height]);

    const rectShape: PolygonShape = {
      id: newLegacyShapeId(),
      type: "polygon",
      polygon,
      style: { ...importedPolygonStyle },
      metadata: {
        label: `Region ${index + 1}`,
        isImported: true,
      },
    };
    newShapes.push(rectShape);
  });

  return newShapes;
}

function stripLegacyKeys(wp: LegacyExhibitWaypoint): ConfigWaypoint {
  const { Arrows: _a, Overlays: _o, ...rest } = wp;
  return rest as ConfigWaypoint;
}

/** True if any waypoint still has runtime-only `Arrows` / `Overlays` (pre-migration). */
export function configWaypointsHaveLegacyArrowsOrOverlays(
  stories: ConfigWaypoint[],
): boolean {
  for (const wp of stories) {
    const rw = wp as LegacyExhibitWaypoint;
    if ((rw.Arrows?.length ?? 0) > 0 || (rw.Overlays?.length ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

function mergeMigratedShapeLists(
  existing: StoryShape[],
  added: StoryShape[],
): StoryShape[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const s of added) {
    byId.set(s.id, s);
  }
  return [...byId.values()];
}

/**
 * If any waypoint still carries legacy `Arrows` / `Overlays`, convert them to
 * `shapeIds` and return additional `StoryShape` records. Idempotent for waypoints
 * that already have `shapeIds` (only strips stray legacy keys).
 */
export function migrateLegacyWaypointShapes(
  stories: LegacyExhibitWaypoint[],
  existingShapes: StoryShape[],
  imageWidth: number,
  imageHeight: number,
): { stories: ConfigWaypoint[]; shapes: StoryShape[]; didMigrate: boolean } {
  let didMigrate = false;
  const addedShapes: StoryShape[] = [];
  const addedByUuid = new Map<string, StoryShape>();

  const nextStories: ConfigWaypoint[] = stories.map((wp) => {
    const hasLegacy =
      (wp.Arrows && wp.Arrows.length > 0) ||
      (wp.Overlays && wp.Overlays.length > 0);
    const hasNew = (wp.shapeIds?.length ?? 0) > 0;

    if (hasNew) {
      if (hasLegacy) didMigrate = true;
      return stripLegacyKeys(wp);
    }

    if (!hasLegacy) {
      return stripLegacyKeys(wp);
    }

    didMigrate = true;
    const anns = annotationsFromLegacyArrowsAndOverlays(
      wp.Arrows ?? [],
      wp.Overlays ?? [],
      imageWidth,
      imageHeight,
    );
    const shapeIds: string[] = [];
    for (const ann of anns) {
      const sh = viewerShapeToStoryShape(ann);
      if (!sh) continue;
      shapeIds.push(sh.id);
      if (!addedByUuid.has(sh.id)) {
        addedByUuid.set(sh.id, sh);
        addedShapes.push(sh);
      }
    }

    const stripped = stripLegacyKeys(wp);
    return {
      ...stripped,
      shapeIds,
    };
  });

  return {
    stories: nextStories,
    shapes: mergeMigratedShapeLists(existingShapes, addedShapes),
    didMigrate,
  };
}
