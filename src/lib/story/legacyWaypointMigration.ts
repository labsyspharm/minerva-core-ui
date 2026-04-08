/**
 * One-time migration: legacy waypoint `Arrows` / `Overlays` (runtime-only props
 * on demo / old configs) → `shapeIds` + `ItemRegistry.Shapes`.
 */

import type { ConfigWaypoint } from "../authoring/config";
import {
  importedLineStyle,
  importedPolygonStyle,
} from "../shapes/shapeDefaults";
import { arrowLineDegeneratePolygon } from "../shapes/shapeGeometry";
import type {
  LineShape,
  PointShape,
  PolygonShape,
  Shape,
  TextShape,
} from "../shapes/shapeModel";
import { rectangleToPolygon } from "../shapes/shapeModel";
import { type StoryShape, viewerShapeToStoryShape } from "./storyShapes";

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

function newShapeId(): string {
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
        id: newShapeId(),
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
        id: newShapeId(),
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
        id: newShapeId(),
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
      id: newShapeId(),
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

function mergeShapeLists(
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
    shapes: mergeShapeLists(existingShapes, addedShapes),
    didMigrate,
  };
}
