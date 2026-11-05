import type { Roi, RoiShape } from "./roiParser";

/**
 * GeoJSON annotations (OMERO ROI export, QuPath, …) as the same `Roi` list the
 * OME-XML importer builds, so `parseRoisFromRoiList` places them. Coordinates are
 * image pixels, y down. Each Feature is one ROI; multi-part geometries become
 * several shapes in it. Polygon holes are dropped: story polygons have one ring.
 */

type Json = Record<string, unknown>;
type Position = [number, number];

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const position = (v: unknown): Position | null => {
  if (!Array.isArray(v) || v.length < 2) return null;
  const [x, y] = v;
  return typeof x === "number" &&
    typeof y === "number" &&
    Number.isFinite(x) &&
    Number.isFinite(y)
    ? [x, y]
    : null;
};

const positions = (v: unknown): Position[] | null => {
  if (!Array.isArray(v)) return null;
  const out: Position[] = [];
  for (const p of v) {
    const pos = position(p);
    if (!pos) return null;
    out.push(pos);
  }
  return out;
};

const pointsAttr = (pts: Position[]) =>
  pts.map(([x, y]) => `${x},${y}`).join(" ");

/** OMERO exports write a missing name as the string "undefined". */
const text = (v: unknown): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).trim();
  return s && s !== "undefined" && s !== "null" ? s : undefined;
};

/** Feature label: OMERO `Name`/`Text`, QuPath `name`, else its class name. */
const featureName = (props: Json): string | undefined => {
  const classification = isObject(props.classification)
    ? props.classification
    : undefined;
  return (
    text(props.Name) ??
    text(props.name) ??
    text(props.Text) ??
    text(props.text) ??
    text(classification?.name) ??
    text(props.classification)
  );
};

/** OMERO keeps the original OME shape type (`Label`, `Ellipse`, …) here. */
const omeShapeType = (props: Json): string =>
  typeof props.type === "string" ? props.type.toLowerCase() : "";

function geometryShapes(
  geometry: unknown,
  props: Json,
  nextId: () => string,
): RoiShape[] {
  if (!isObject(geometry)) return [];
  const coords = geometry.coordinates;
  const polygon = (rings: unknown): RoiShape[] => {
    // Outer ring only; GeoJSON rings repeat the first vertex at the end.
    const outer = Array.isArray(rings) ? positions(rings[0]) : null;
    if (!outer || outer.length < 3) return [];
    return [{ type: "polygon", ID: nextId(), Points: pointsAttr(outer) }];
  };
  const lineString = (v: unknown): RoiShape[] => {
    const pts = positions(v);
    if (!pts || pts.length < 2) return [];
    return [{ type: "polyline", ID: nextId(), Points: pointsAttr(pts) }];
  };
  const point = (v: unknown): RoiShape[] => {
    const p = position(v);
    if (!p) return [];
    const [X, Y] = p;
    const label = text(props.Text) ?? text(props.text);
    if (omeShapeType(props) === "label" && label) {
      return [{ type: "label", ID: nextId(), X, Y, Text: label }];
    }
    return [{ type: "point", ID: nextId(), X, Y }];
  };
  const each = (v: unknown, f: (part: unknown) => RoiShape[]) =>
    Array.isArray(v) ? v.flatMap(f) : [];

  switch (geometry.type) {
    case "Point":
      return point(coords);
    case "MultiPoint":
      return each(coords, point);
    case "LineString":
      return lineString(coords);
    case "MultiLineString":
      return each(coords, lineString);
    case "Polygon":
      return polygon(coords);
    case "MultiPolygon":
      return each(coords, polygon);
    case "GeometryCollection":
      return each(geometry.geometries, (g) => geometryShapes(g, props, nextId));
    default:
      return [];
  }
}

/** Features of a FeatureCollection, a lone Feature or geometry, or a bare array (QuPath). */
function features(root: unknown): Json[] {
  if (Array.isArray(root)) return root.filter(isObject);
  if (!isObject(root)) return [];
  if (root.type === "FeatureCollection") {
    return Array.isArray(root.features) ? root.features.filter(isObject) : [];
  }
  if (root.type === "Feature") return [root];
  if (typeof root.type === "string" && root.type !== "") {
    return [{ type: "Feature", geometry: root, properties: {} }];
  }
  return [];
}

/** Parse GeoJSON text into ROIs. Throws when the text is not JSON or not GeoJSON. */
export function parseGeoJsonStringToRois(json: string): Roi[] {
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const list = features(root);
  if (list.length === 0) {
    throw new Error("The file has no GeoJSON features.");
  }

  const rois: Roi[] = [];
  list.forEach((feature, i) => {
    const props = isObject(feature.properties) ? feature.properties : {};
    const id =
      text(feature.id) ?? text(props.Id) ?? text(props.id) ?? `Feature:${i}`;
    let part = 0;
    const shapes = geometryShapes(feature.geometry, props, () =>
      part++ === 0 ? id : `${id}:${part - 1}`,
    );
    if (shapes.length === 0) return;
    rois.push({ ID: id, Name: featureName(props), shapes });
  });
  return rois;
}
