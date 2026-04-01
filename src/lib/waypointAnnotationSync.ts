import type {
  ConfigWaypoint,
  ConfigWaypointArrow,
  ConfigWaypointOverlay,
} from "./config";
import type {
  Annotation,
  LineAnnotation,
  PointAnnotation,
  RectangleAnnotation,
  TextAnnotation,
} from "./stores";

/**
 * Serialize annotations back into waypoint config fields (normalized 0–1 vs
 * max(image width, height), same coordinate space as import).
 *
 * Handles **text**, **line**, **rectangle**, and **point** types; other shapes
 * (polygon, ellipse, polyline, …) remain in memory until this serializer (or
 * the config shape) is extended.
 */
export function serializeImportedAnnotationsToWaypointFields(
  annotations: Annotation[],
  imageWidth: number,
  imageHeight: number,
  story: ConfigWaypoint,
): { Arrows: ConfigWaypointArrow[]; Overlays: ConfigWaypointOverlay[] } {
  const maxDimension = Math.max(imageWidth, imageHeight);
  if (maxDimension <= 0) {
    return { Arrows: [], Overlays: [] };
  }

  const arrows: ConfigWaypointArrow[] = [];
  const overlays: ConfigWaypointOverlay[] = [];
  let overlayFallbackIndex = 0;
  const prevOverlays = story.Overlays ?? [];

  for (const ann of annotations) {
    if (ann.type === "text") {
      const t = ann as TextAnnotation;
      const x = t.position[0] / maxDimension;
      const y = t.position[1] / maxDimension;
      arrows.push({
        Angle: 0,
        HideArrow: true,
        Point: [x, y],
        Text: t.text ?? t.metadata?.label ?? "",
      });
    } else if (ann.type === "line") {
      const line = ann as LineAnnotation;
      const poly = line.polygon;
      if (poly.length < 2) continue;
      const startX = poly[0][0];
      const startY = poly[0][1];
      const tipX = poly[1][0];
      const tipY = poly[1][1];
      const angleDeg =
        (Math.atan2(startY - tipY, startX - tipX) * 180) / Math.PI;
      arrows.push({
        Angle: angleDeg,
        HideArrow: false,
        Point: [tipX / maxDimension, tipY / maxDimension],
        Text: line.text ?? line.metadata?.label ?? "",
      });
    } else if (ann.type === "rectangle") {
      const rect = ann as RectangleAnnotation;
      const xs = rect.polygon.map((p) => p[0]);
      const ys = rect.polygon.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const meta = rect.metadata as { sourceOverlayGroup?: string } | undefined;
      const group =
        meta?.sourceOverlayGroup ??
        prevOverlays[overlayFallbackIndex]?.Group ??
        "";
      overlayFallbackIndex += 1;
      overlays.push({
        x: minX / maxDimension,
        y: minY / maxDimension,
        width: (maxX - minX) / maxDimension,
        height: (maxY - minY) / maxDimension,
        Group: group,
      });
    } else if (ann.type === "point") {
      const pt = ann as PointAnnotation;
      const [px, py] = pt.position;
      arrows.push({
        Angle: 0,
        HideArrow: true,
        IsPoint: true,
        Point: [px / maxDimension, py / maxDimension],
        Text: pt.text ?? pt.metadata?.label ?? "",
      });
    }
  }

  return { Arrows: arrows, Overlays: overlays };
}
