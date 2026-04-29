import type { Loader } from "../imaging/viv";
import type {
  LineShape,
  PointShape,
  PolygonShape,
  PolylineShape,
  Shape,
  TextShape,
} from "./shapeModel";
import { lineToPolygon, rectangleToPolygon } from "./shapeModel";

// Type definitions for ROI shapes from loader metadata (OME-XML compatible)
interface Transform {
  A00: number;
  A01: number;
  A02: number;
  A10: number;
  A11: number;
  A12: number;
}

interface BaseRoiShape {
  ID: string;
  Name?: string;
  FillColor?: [number, number, number, number];
  StrokeColor?: [number, number, number, number];
  StrokeWidth?: number;
  TheC?: number;
  TheT?: number;
  TheZ?: number;
  Text?: string;
  Transform?: Transform;
}

interface RoiRectangleShape extends BaseRoiShape {
  type: "rectangle";
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

interface RoiEllipseShape extends BaseRoiShape {
  type: "ellipse";
  X: number;
  Y: number;
  RadiusX: number;
  RadiusY: number;
}

interface RoiLineShape extends BaseRoiShape {
  type: "line";
  X1: number;
  Y1: number;
  X2: number;
  Y2: number;
}

interface RoiPointShape extends BaseRoiShape {
  type: "point";
  X: number;
  Y: number;
}

interface RoiPolygonShape extends BaseRoiShape {
  type: "polygon";
  Points: string; // Format: "x1,y1 x2,y2 x3,y3 ..."
}

interface RoiPolylineShape extends BaseRoiShape {
  type: "polyline";
  Points: string; // Format: "x1,y1 x2,y2 x3,y3 ..."
}

interface RoiLabelShape extends BaseRoiShape {
  type: "label";
  X: number;
  Y: number;
  Text: string;
}

type Group = {
  id: string;
  name: string;
  shapeIds: string[];
  isExpanded: boolean;
  metadata?: {
    createdAt?: Date;
  };
};

export type RoiShape =
  | RoiRectangleShape
  | RoiEllipseShape
  | RoiLineShape
  | RoiPointShape
  | RoiPolygonShape
  | RoiPolylineShape
  | RoiLabelShape;

export interface Roi {
  ID: string;
  Name?: string;
  Description?: string;
  shapes: RoiShape[];
}

/**
 * Apply affine transformation to a point
 */
const applyTransform = (
  x: number,
  y: number,
  transform?: Transform,
): [number, number] => {
  if (!transform) return [x, y];

  const newX = transform.A00 * x + transform.A01 * y + transform.A02;
  const newY = transform.A10 * x + transform.A11 * y + transform.A12;

  return [newX, newY];
};

/**
 * Parse points string to array of coordinates
 * Format: "x1,y1 x2,y2 x3,y3 ..."
 */
const parsePoints = (
  pointsStr: string,
  transform?: Transform,
): [number, number][] => {
  const points = pointsStr
    .trim()
    .split(/\s+/)
    .map((point) => {
      const [x, y] = point.split(",").map(Number);
      return applyTransform(x, y, transform);
    });
  return points;
};

/**
 * Convert ellipse to polygon approximation
 */
const ellipseToPolygon = (
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  transform?: Transform,
  segments: number = 32,
): [number, number][] => {
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    points.push(applyTransform(x, y, transform));
  }
  return points;
};

/**
 * Get default colors from shape or use fallback
 */
const getColors = (
  shape: BaseRoiShape,
  defaultFill: [number, number, number, number],
  defaultStroke: [number, number, number, number],
) => {
  return {
    fillColor: shape.FillColor || defaultFill,
    lineColor: shape.StrokeColor || defaultStroke,
    lineWidth: shape.StrokeWidth || 3,
  };
};

/**
 * Convert ROI rectangle shape to a closed polygon (same layer path as other regions).
 */
const rectangleShapeToViewerShape = (
  shape: RoiRectangleShape,
  roi: Roi,
): PolygonShape => {
  const { X, Y, Width, Height, Transform, ID, Text, Name } = shape;

  const topLeft = applyTransform(X, Y, Transform);
  const bottomRight = applyTransform(X + Width, Y + Height, Transform);

  const polygon = rectangleToPolygon(topLeft, bottomRight);

  const colors = getColors(shape, [255, 0, 0, 50], [255, 0, 0, 255]);

  return {
    id: `roi-${roi.ID}-${ID}`,
    type: "polygon",
    polygon,
    style: colors,
    text: Text,
    metadata: {
      label: Name || ID,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI ellipse shape to PolygonShape
 */
const ellipseShapeToViewerShape = (
  shape: RoiEllipseShape,
  roi: Roi,
): PolygonShape => {
  const { X, Y, RadiusX, RadiusY, Transform, ID, Text, Name } = shape;

  // Convert ellipse to polygon approximation
  const polygon = ellipseToPolygon(X, Y, RadiusX, RadiusY, Transform);

  const colors = getColors(shape, [0, 255, 0, 50], [0, 255, 0, 255]);

  return {
    id: `roi-${roi.ID}-${ID}`,
    type: "polygon",
    polygon,
    style: colors,
    text: Text, // Include text if present
    metadata: {
      label: Name || ID,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI line shape to LineShape
 */
const lineShapeToViewerShape = (shape: RoiLineShape, roi: Roi): LineShape => {
  const { X1, Y1, X2, Y2, Transform, ID, Text, Name } = shape;

  const start = applyTransform(X1, Y1, Transform);
  const end = applyTransform(X2, Y2, Transform);

  const lineWidth = shape.StrokeWidth || 3;
  const polygon = lineToPolygon(start, end, lineWidth);

  const lineColor = shape.StrokeColor || [0, 255, 255, 255];
  const fillColor = shape.FillColor || [0, 255, 255, 255];

  return {
    id: `roi-${roi.ID}-${ID}`,
    type: "line",
    polygon,
    hasArrowHead: false, // lineToPolygon creates rectangular geometry; arrows expect degenerate polygon
    style: {
      fillColor,
      lineColor,
      lineWidth,
    },
    text: Text, // Include text if present
    metadata: {
      label: Name || ID,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI point shape to PointShape
 */
const pointShapeToViewerShape = (
  shape: RoiPointShape,
  roi: Roi,
): PointShape => {
  const { X, Y, Transform, ID, Text, Name } = shape;

  const position = applyTransform(X, Y, Transform);

  const fillColor = shape.FillColor || [255, 140, 0, 255];
  const strokeColor = shape.StrokeColor || [255, 255, 255, 255];

  return {
    id: `roi-${roi.ID}-${ID}`,
    type: "point",
    position,
    style: {
      fillColor,
      strokeColor,
      radius: 5,
    },
    text: Text, // Include text if present
    metadata: {
      label: Name || ID,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI polygon shape to PolygonShape
 */
const polygonShapeToViewerShape = (
  shape: RoiPolygonShape,
  roi: Roi,
): PolygonShape => {
  const { Points, Transform, ID, Text, Name } = shape;

  const polygon = parsePoints(Points, Transform);

  const colors = getColors(shape, [255, 165, 0, 50], [255, 165, 0, 255]);

  return {
    id: `roi-${roi.ID}-${ID}`,
    type: "polygon",
    polygon,
    style: colors,
    text: Text, // Include text if present
    metadata: {
      label: Name || ID,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI polyline shape to PolylineShape
 */
const polylineShapeToViewerShape = (
  shape: RoiPolylineShape,
  roi: Roi,
): PolylineShape => {
  const { Points, Transform, ID, Text, Name } = shape;

  const polygon = parsePoints(Points, Transform);

  const lineColor = shape.StrokeColor || [0, 255, 0, 255];
  const lineWidth = shape.StrokeWidth || 3;

  return {
    id: `roi-${roi.ID}-${ID}`,
    type: "polyline",
    polygon,
    style: {
      lineColor,
      lineWidth,
    },
    text: Text, // Include text if present
    metadata: {
      label: Name || ID,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI label shape to TextShape
 */
const labelShapeToViewerShape = (shape: RoiLabelShape, roi: Roi): TextShape => {
  const { X, Y, Text, ID, Name, Transform } = shape;

  const position = applyTransform(X, Y, Transform);

  const fontColor = shape.StrokeColor || [255, 255, 0, 255];
  const backgroundColor = shape.FillColor || [0, 0, 0, 150];

  return {
    id: `roi-${roi.ID}-${ID}`,
    type: "text",
    position,
    text: Text,
    style: {
      fontSize: 14,
      fontColor,
      backgroundColor,
      padding: 4,
    },
    metadata: {
      label: Name || ID,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/** Convert structured ROI data (e.g. from OME-XML or Viv metadata) to viewer shapes. */
export const parseRoisFromRoiList = (
  rois: Roi[] | null | undefined,
): { shapes: Shape[]; groups: Group[] } => {
  const shapes: Shape[] = [];
  const groups: Group[] = [];

  if (!rois || rois.length === 0) {
    return { shapes, groups };
  }

  console.log(`Found ${rois.length} ROIs in ROI list`);

  // Process each ROI
  rois.forEach((roi) => {
    console.log(
      `Processing ROI ${roi.ID} (${roi.Name || "unnamed"}) with ${roi.shapes.length} shapes`,
    );

    // Create a group for this ROI
    const groupId = `roi-group-${roi.ID}`;
    const roiShapeIds: string[] = [];

    // Process each shape in the ROI
    roi.shapes.forEach((shape) => {
      try {
        let viewerShape: Shape | null = null;

        switch (shape.type) {
          case "rectangle":
            viewerShape = rectangleShapeToViewerShape(shape, roi);
            console.log(`Created rectangle shape: ${viewerShape.id}`);
            break;

          case "ellipse":
            viewerShape = ellipseShapeToViewerShape(shape, roi);
            console.log(`Created ellipse shape: ${viewerShape.id}`);
            break;

          case "line":
            viewerShape = lineShapeToViewerShape(shape, roi);
            console.log(`Created line shape: ${viewerShape.id}`);
            break;

          case "point":
            viewerShape = pointShapeToViewerShape(shape, roi);
            console.log(`Created point shape: ${viewerShape.id}`);
            break;

          case "polygon":
            viewerShape = polygonShapeToViewerShape(shape, roi);
            console.log(`Created polygon shape: ${viewerShape.id}`);
            break;

          case "polyline":
            viewerShape = polylineShapeToViewerShape(shape, roi);
            console.log(`Created polyline shape: ${viewerShape.id}`);
            break;

          case "label":
            viewerShape = labelShapeToViewerShape(shape, roi);
            console.log(`Created text shape: ${viewerShape.id}`);
            break;

          default:
            console.warn(`Unknown shape: ${shape}`);
        }

        if (viewerShape) {
          shapes.push(viewerShape);
          roiShapeIds.push(viewerShape.id);
        }
      } catch (error) {
        console.error(
          `Error processing shape ${shape.ID} in ROI ${roi.ID}:`,
          error,
        );
      }
    });

    // Create a group for this ROI if it has any shapes
    if (roiShapeIds.length > 0) {
      const group = {
        id: groupId,
        name: roi.Name || `ROI ${roi.ID}`,
        shapeIds: roiShapeIds,
        isExpanded: true,
      };
      groups.push(group);
      console.log(
        `Created group for ROI ${roi.ID} with ${roiShapeIds.length} shapes`,
      );
    }
  });

  console.log(`Total shapes created from ROIs: ${shapes.length}`);
  console.log(`Total groups created from ROIs: ${groups.length}`);
  return { shapes, groups };
};

/**
 * Parse ROIs from loader metadata and convert to viewer shapes and groups
 */
export const parseRoisFromLoader = (
  loader: Loader,
): { shapes: Shape[]; groups: Group[] } => {
  if (!loader || !loader.metadata || !loader.metadata.ROIs) {
    console.log("No ROIs found in loader metadata");
    return { shapes: [], groups: [] };
  }
  return parseRoisFromRoiList(loader.metadata.ROIs as Roi[]);
};
