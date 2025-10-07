import type { 
  Annotation, 
  RectangleAnnotation, 
  TextAnnotation, 
  PolygonAnnotation, 
  PolylineAnnotation,
  LineAnnotation,
  PointAnnotation
} from './stores';
import { rectangleToPolygon, lineToPolygon } from './stores';

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
  type: 'rectangle';
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

interface RoiEllipseShape extends BaseRoiShape {
  type: 'ellipse';
  X: number;
  Y: number;
  RadiusX: number;
  RadiusY: number;
}

interface RoiLineShape extends BaseRoiShape {
  type: 'line';
  X1: number;
  Y1: number;
  X2: number;
  Y2: number;
}

interface RoiPointShape extends BaseRoiShape {
  type: 'point';
  X: number;
  Y: number;
}

interface RoiPolygonShape extends BaseRoiShape {
  type: 'polygon';
  Points: string; // Format: "x1,y1 x2,y2 x3,y3 ..."
}

interface RoiPolylineShape extends BaseRoiShape {
  type: 'polyline';
  Points: string; // Format: "x1,y1 x2,y2 x3,y3 ..."
}

interface RoiLabelShape extends BaseRoiShape {
  type: 'label';
  X: number;
  Y: number;
  Text: string;
}

type RoiShape = 
  | RoiRectangleShape 
  | RoiEllipseShape
  | RoiLineShape
  | RoiPointShape
  | RoiPolygonShape
  | RoiPolylineShape
  | RoiLabelShape;

interface Roi {
  ID: string;
  Name?: string;
  Description?: string;
  shapes: RoiShape[];
}

interface LoaderMetadata {
  ROIs?: Roi[];
  [key: string]: any;
}

/**
 * Apply affine transformation to a point
 */
const applyTransform = (
  x: number, 
  y: number, 
  transform?: Transform
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
const parsePoints = (pointsStr: string, transform?: Transform): [number, number][] => {
  const points = pointsStr.trim().split(/\s+/).map(point => {
    const [x, y] = point.split(',').map(Number);
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
  segments: number = 32
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
const getColors = (shape: BaseRoiShape, defaultFill: [number, number, number, number], defaultStroke: [number, number, number, number]) => {
  return {
    fillColor: shape.FillColor || defaultFill,
    lineColor: shape.StrokeColor || defaultStroke,
    lineWidth: shape.StrokeWidth || 3,
  };
};

/**
 * Convert ROI rectangle shape to RectangleAnnotation
 */
const rectangleShapeToAnnotation = (shape: RoiRectangleShape, roi: Roi): RectangleAnnotation => {
  const { X, Y, Width, Height, Transform, ID, Text, Name } = shape;
  
  // Calculate rectangle corners
  const topLeft = applyTransform(X, Y, Transform);
  const bottomRight = applyTransform(X + Width, Y + Height, Transform);
  
  // Create polygon from rectangle bounds
  const polygon = rectangleToPolygon(topLeft, bottomRight);
  
  const colors = getColors(shape, [255, 0, 0, 50], [255, 0, 0, 255]);
  
  return {
    id: `roi-${roi.ID}-${ID}`,
    type: 'rectangle',
    polygon,
    style: colors,
    metadata: {
      createdAt: new Date(),
      label: Name || `Rectangle from ${roi.Name || roi.ID}`,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI ellipse shape to PolygonAnnotation
 */
const ellipseShapeToAnnotation = (shape: RoiEllipseShape, roi: Roi): PolygonAnnotation => {
  const { X, Y, RadiusX, RadiusY, Transform, ID, Name } = shape;
  
  // Convert ellipse to polygon approximation
  const polygon = ellipseToPolygon(X, Y, RadiusX, RadiusY, Transform);
  
  const colors = getColors(shape, [0, 255, 0, 50], [0, 255, 0, 255]);
  
  return {
    id: `roi-${roi.ID}-${ID}`,
    type: 'polygon',
    polygon,
    style: colors,
    metadata: {
      createdAt: new Date(),
      label: Name || `Ellipse from ${roi.Name || roi.ID}`,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI line shape to LineAnnotation
 */
const lineShapeToAnnotation = (shape: RoiLineShape, roi: Roi): LineAnnotation => {
  const { X1, Y1, X2, Y2, Transform, ID, Name } = shape;
  
  const start = applyTransform(X1, Y1, Transform);
  const end = applyTransform(X2, Y2, Transform);
  
  const lineWidth = shape.StrokeWidth || 3;
  const polygon = lineToPolygon(start, end, lineWidth);
  
  const lineColor = shape.StrokeColor || [0, 255, 255, 255];
  
  return {
    id: `roi-${roi.ID}-${ID}`,
    type: 'line',
    polygon,
    style: {
      lineColor,
      lineWidth,
    },
    metadata: {
      createdAt: new Date(),
      label: Name || `Line from ${roi.Name || roi.ID}`,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI point shape to PointAnnotation
 */
const pointShapeToAnnotation = (shape: RoiPointShape, roi: Roi): PointAnnotation => {
  const { X, Y, Transform, ID, Name } = shape;
  
  const position = applyTransform(X, Y, Transform);
  
  const fillColor = shape.FillColor || [255, 140, 0, 255];
  const strokeColor = shape.StrokeColor || [255, 255, 255, 255];
  
  return {
    id: `roi-${roi.ID}-${ID}`,
    type: 'point',
    position,
    style: {
      fillColor,
      strokeColor,
      radius: 5,
    },
    metadata: {
      createdAt: new Date(),
      label: Name || `Point from ${roi.Name || roi.ID}`,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI polygon shape to PolygonAnnotation
 */
const polygonShapeToAnnotation = (shape: RoiPolygonShape, roi: Roi): PolygonAnnotation => {
  const { Points, Transform, ID, Name } = shape;
  
  const polygon = parsePoints(Points, Transform);
  
  const colors = getColors(shape, [255, 165, 0, 50], [255, 165, 0, 255]);
  
  return {
    id: `roi-${roi.ID}-${ID}`,
    type: 'polygon',
    polygon,
    style: colors,
    metadata: {
      createdAt: new Date(),
      label: Name || `Polygon from ${roi.Name || roi.ID}`,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI polyline shape to PolylineAnnotation
 */
const polylineShapeToAnnotation = (shape: RoiPolylineShape, roi: Roi): PolylineAnnotation => {
  const { Points, Transform, ID, Name } = shape;
  
  const polygon = parsePoints(Points, Transform);
  
  const lineColor = shape.StrokeColor || [0, 255, 0, 255];
  const lineWidth = shape.StrokeWidth || 3;
  
  return {
    id: `roi-${roi.ID}-${ID}`,
    type: 'polyline',
    polygon,
    style: {
      lineColor,
      lineWidth,
    },
    metadata: {
      createdAt: new Date(),
      label: Name || `Polyline from ${roi.Name || roi.ID}`,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Convert ROI label shape to TextAnnotation
 */
const labelShapeToAnnotation = (shape: RoiLabelShape, roi: Roi): TextAnnotation => {
  const { X, Y, Text, ID, Name, Transform } = shape;
  
  const position = applyTransform(X, Y, Transform);
  
  const fontColor = shape.StrokeColor || [255, 255, 0, 255];
  const backgroundColor = shape.FillColor || [0, 0, 0, 150];
  
  return {
    id: `roi-${roi.ID}-${ID}`,
    type: 'text',
    position,
    text: Text,
    style: {
      fontSize: 14,
      fontColor,
      backgroundColor,
      padding: 4,
    },
    metadata: {
      createdAt: new Date(),
      label: Name || `Label from ${roi.Name || roi.ID}`,
      description: `Imported from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Create a text annotation from a shape's Text field, positioned at the center of the shape
 */
const createTextAnnotationFromShape = (shape: BaseRoiShape, roi: Roi, centerPosition: [number, number]): TextAnnotation => {
  const { ID, Text, Name } = shape;
  
  const fontColor = shape.StrokeColor || [255, 255, 255, 255];
  const backgroundColor = shape.FillColor || [0, 0, 0, 150];
  
  return {
    id: `roi-${roi.ID}-${ID}:Label`,
    type: 'text',
    position: centerPosition,
    text: Text!,
    style: {
      fontSize: 14,
      fontColor,
      backgroundColor,
      padding: 4,
    },
    metadata: {
      createdAt: new Date(),
      label: Name || `Text from ${roi.Name || roi.ID}`,
      description: `Imported text from ROI ${roi.Name || roi.ID}, Shape ${ID}`,
      isImported: true,
    },
  };
};

/**
 * Parse ROIs from loader metadata and convert to annotations
 */
export const parseRoisFromLoader = (loader: any): Annotation[] => {
  const annotations: Annotation[] = [];
  
  // Check if loader has metadata with ROIs
  if (!loader || !loader.metadata || !loader.metadata.ROIs) {
    console.log('No ROIs found in loader metadata');
    return annotations;
  }
  
  const rois = loader.metadata.ROIs as Roi[];
  console.log(`Found ${rois.length} ROIs in loader metadata`);
  
  // Process each ROI
  rois.forEach((roi) => {
    console.log(`Processing ROI ${roi.ID} (${roi.Name || 'unnamed'}) with ${roi.shapes.length} shapes`);
    
    // Process each shape in the ROI
    roi.shapes.forEach((shape) => {
      try {
        let annotation: Annotation | null = null;
        let centerPosition: [number, number] | null = null;
        
        switch (shape.type) {
          case 'rectangle':
            annotation = rectangleShapeToAnnotation(shape, roi);
            // Calculate center position for text annotation
            const rectShape = shape as RoiRectangleShape;
            const rectCenter = applyTransform(
              rectShape.X + rectShape.Width / 2, 
              rectShape.Y + rectShape.Height / 2, 
              rectShape.Transform
            );
            centerPosition = rectCenter;
            console.log(`Created rectangle annotation: ${annotation.id}`);
            break;
          
          case 'ellipse':
            annotation = ellipseShapeToAnnotation(shape, roi);
            // Center position is already the center of the ellipse
            const ellipseShape = shape as RoiEllipseShape;
            centerPosition = applyTransform(ellipseShape.X, ellipseShape.Y, ellipseShape.Transform);
            console.log(`Created ellipse annotation: ${annotation.id}`);
            break;
          
          case 'line':
            annotation = lineShapeToAnnotation(shape, roi);
            // Calculate center position for text annotation
            const lineShape = shape as RoiLineShape;
            const lineCenter = applyTransform(
              (lineShape.X1 + lineShape.X2) / 2, 
              (lineShape.Y1 + lineShape.Y2) / 2, 
              lineShape.Transform
            );
            centerPosition = lineCenter;
            console.log(`Created line annotation: ${annotation.id}`);
            break;
          
          case 'point':
            annotation = pointShapeToAnnotation(shape, roi);
            // Point position is the center
            const pointShape = shape as RoiPointShape;
            centerPosition = applyTransform(pointShape.X, pointShape.Y, pointShape.Transform);
            console.log(`Created point annotation: ${annotation.id}`);
            break;
          
          case 'polygon':
            annotation = polygonShapeToAnnotation(shape, roi);
            // Calculate center position for text annotation
            const polygonShape = shape as RoiPolygonShape;
            const polygonPoints = parsePoints(polygonShape.Points, polygonShape.Transform);
            const polygonCenter: [number, number] = [
              polygonPoints.reduce((sum, [x]) => sum + x, 0) / polygonPoints.length,
              polygonPoints.reduce((sum, [, y]) => sum + y, 0) / polygonPoints.length
            ];
            centerPosition = polygonCenter;
            console.log(`Created polygon annotation: ${annotation.id}`);
            break;
          
          case 'polyline':
            annotation = polylineShapeToAnnotation(shape, roi);
            // Calculate center position for text annotation
            const polylineShape = shape as RoiPolylineShape;
            const polylinePoints = parsePoints(polylineShape.Points, polylineShape.Transform);
            const polylineCenter: [number, number] = [
              polylinePoints.reduce((sum, [x]) => sum + x, 0) / polylinePoints.length,
              polylinePoints.reduce((sum, [, y]) => sum + y, 0) / polylinePoints.length
            ];
            centerPosition = polylineCenter;
            console.log(`Created polyline annotation: ${annotation.id}`);
            break;
          
          case 'label':
            annotation = labelShapeToAnnotation(shape, roi);
            // Label position is already the text position
            const labelShape = shape as RoiLabelShape;
            centerPosition = applyTransform(labelShape.X, labelShape.Y, labelShape.Transform);
            console.log(`Created text annotation: ${annotation.id}`);
            break;
          
          default:
            console.warn(`Unknown shape type: ${(shape as any).type}`);
        }
        
        if (annotation) {
          annotations.push(annotation);
          
          // If the shape has a Text field and we have a center position, create an additional text annotation
          if (shape.Text && centerPosition) {
            const textAnnotation = createTextAnnotationFromShape(shape, roi, centerPosition);
            annotations.push(textAnnotation);
            console.log(`Created additional text annotation: ${textAnnotation.id}`);
          }
        }
      } catch (error) {
        console.error(`Error processing shape ${shape.ID} in ROI ${roi.ID}:`, error);
      }
    });
  });
  
  console.log(`Total annotations created from ROIs: ${annotations.length}`);
  return annotations;
};

