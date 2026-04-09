/**
 * **`story.json` export** — validated root ({@link JsonExport}), exhibit ↔ wire waypoints,
 * viewer shapes for the export `shapes` array, legacy Arrows/Overlays → wire.
 * Zod: `documentSchema.ts` ({@link JsonExport}).
 *
 * Not every helper is “export” literally: `hydrateConfigWaypoint` and legacy migration feed
 * the same wire shape used when building {@link buildJsonExport}; shape ↔ `StoryShape`
 * is the format inside the exported file.
 */

import type { ConfigWaypoint } from "../authoring/config";
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
  Group,
  JsonExport,
  StoryPoint,
  StoryShape,
  StoryShapeArrow,
  StoryShapePoint,
  StoryShapePolygon,
  StoryShapePolyline,
  StoryShapeText,
  StoryViewport,
  StoryWaypoint,
} from "./documentSchema";
import { parseJsonExport } from "./documentSchema";
import type { StoreWaypoint } from "./documentStoreTypes";

export type {
  JsonExport,
  StoryPoint,
  StoryShape,
  StoryShapeArrow,
  StoryShapePoint,
  StoryShapePolygon,
  StoryShapePolyline,
  StoryShapeText,
  StoryViewport,
  StoryWaypoint,
} from "./documentSchema";

// --- Exhibit `ConfigWaypoint` ↔ `story.json` waypoint slice (for building JsonExport) -----

/** Store waypoint row: wire {@link StoryWaypoint} + optional authoring camera fields (not in JSON). */
export type JsonExportWaypointRow = StoreWaypoint;

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    groupId = UUID_LIKE.test(legacyGroup)
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

export function boundsToExportViewport(b: WaypointBounds): StoryViewport {
  const minX = Math.min(b.x0, b.x1);
  const maxX = Math.max(b.x0, b.x1);
  const minY = Math.min(b.y0, b.y1);
  const maxY = Math.max(b.y0, b.y1);
  return {
    upperLeft: { x: minX, y: minY },
    lowerRight: { x: maxX, y: maxY },
  };
}

export function exportViewportToBounds(v: StoryViewport): WaypointBounds {
  const x0 = Math.min(v.upperLeft.x, v.lowerRight.x);
  const x1 = Math.max(v.upperLeft.x, v.lowerRight.x);
  const y0 = Math.min(v.upperLeft.y, v.lowerRight.y);
  const y1 = Math.max(v.upperLeft.y, v.lowerRight.y);
  return { x0, x1, y0, y1 };
}

export function configWaypointToExportWaypoint(
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

export function configWaypointToExportRow(
  wp: ConfigWaypoint,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): JsonExportWaypointRow {
  const row = configWaypointToExportWaypoint(
    wp,
    imageWidth,
    imageHeight,
    containerWidth,
    containerHeight,
  );
  return {
    ...row,
    authoring: {
      State: wp.State,
      ViewState: wp.ViewState,
      Pan: wp.Pan,
      Zoom: wp.Zoom,
    },
  };
}

export function exportRowToConfigWaypoint(
  row: JsonExportWaypointRow,
): ConfigWaypoint {
  const bounds = exportViewportToBounds(row.viewport);
  const r = row as StoreWaypoint &
    Partial<Pick<ConfigWaypoint, "State" | "ViewState" | "Pan" | "Zoom">>;
  const out: ConfigWaypoint = {
    id: row.id,
    Name: row.title,
    Content: row.content,
    State: r.authoring?.State ?? r.State ?? { Expanded: false },
    Bounds: bounds,
    shapeIds: [...row.shapeIds],
    ViewState: r.authoring?.ViewState ?? r.ViewState,
    Pan: r.authoring?.Pan ?? r.Pan,
    Zoom: r.authoring?.Zoom ?? r.Zoom,
  };
  if (row.groupId !== undefined) {
    out.groupId = row.groupId;
  }
  if (row.thumbnail !== undefined) {
    out.ThumbnailDataUrl = row.thumbnail;
  }
  return out;
}

/** Map authoring waypoint rows → exhibit `ConfigWaypoint` list (`ItemRegistry.Stories`). */
export function exportRowsToConfigWaypoints(
  rows: JsonExportWaypointRow[],
): ConfigWaypoint[] {
  return rows.map(exportRowToConfigWaypoint);
}

/** Merge wire waypoint into exhibit row when `row.id === wp.id`. */
export function applyExportWaypointToConfig(
  wp: ConfigWaypoint,
  row: StoryWaypoint,
): ConfigWaypoint {
  if (row.id !== wp.id) {
    return wp;
  }
  const bounds = exportViewportToBounds(row.viewport);
  const next: ConfigWaypoint = {
    ...wp,
    Name: row.title,
    Content: row.content,
    Bounds: bounds,
    shapeIds: [...row.shapeIds],
    Pan: undefined,
    Zoom: undefined,
  };
  if (row.groupId !== undefined) {
    next.groupId = row.groupId;
  }
  if (row.thumbnail !== undefined) {
    next.ThumbnailDataUrl = row.thumbnail;
  } else {
    delete next.ThumbnailDataUrl;
  }
  return next;
}

/** Build validated {@link JsonExport} for `story.json` (camera fields stripped per row). */
export function buildJsonExport(
  waypointRows: JsonExportWaypointRow[],
  shapeList: StoryShape[],
): JsonExport {
  return parseJsonExport({
    version: "2",
    waypoints: waypointRows.map((row) => {
      const { authoring: _a, ...w } = row;
      return {
        ...w,
        shapeIds: [...w.shapeIds],
      };
    }),
    shapes: [...shapeList],
  });
}

// --- Viewer `Shape` ↔ `story.json` `shapes[]` (same wire as JsonExport) -------------------

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
  type?: "arrow";
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

// --- Legacy exhibit `Arrows` / `Overlays` → wire ids + shapes (JsonExport-compatible) ---

type LegacyArrow = {
  Angle: number;
  HideArrow: boolean;
  Point: [number, number];
  Text: string;
  IsPoint?: boolean;
};

type LegacyOverlay = {
  x: number;
  y: number;
  width: number;
  height: number;
  Group?: string;
};

type RuntimeWaypoint = ConfigWaypoint & {
  Arrows?: LegacyArrow[];
  Overlays?: LegacyOverlay[];
};

function newLegacyShapeId(): string {
  return crypto.randomUUID();
}

function annotationsFromLegacyArrowsAndOverlays(
  arrows: LegacyArrow[],
  overlays: LegacyOverlay[],
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

function stripLegacyKeys(wp: RuntimeWaypoint): ConfigWaypoint {
  const { Arrows: _a, Overlays: _o, ...rest } = wp;
  return rest as ConfigWaypoint;
}

/** True if any waypoint still has runtime-only `Arrows` / `Overlays` (pre-migration). */
export function configWaypointsHaveLegacyArrowsOrOverlays(
  stories: ConfigWaypoint[],
): boolean {
  for (const wp of stories) {
    const rw = wp as RuntimeWaypoint;
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
  stories: RuntimeWaypoint[],
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
