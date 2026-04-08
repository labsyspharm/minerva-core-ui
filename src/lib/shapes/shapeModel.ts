/** Viewer shape types and pure geometry helpers (no Zustand). Distinct from persisted `StoryShape` in `documentSchema`. */

export interface OverlayLayer {
  id: string;
}

export type ShapeCommonMetadata = {
  createdAt?: Date;
  label?: string;
  description?: string;
  isImported?: boolean;
};

export interface PolygonShape {
  id: string;
  type: "polygon";
  polygon: [number, number][];
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string;
  metadata?: ShapeCommonMetadata;
}

export interface LineShape {
  id: string;
  type: "line";
  polygon: [number, number][];
  hasArrowHead?: boolean;
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string;
  metadata?: ShapeCommonMetadata;
}

export interface PolylineShape {
  id: string;
  type: "polyline";
  polygon: [number, number][];
  style: {
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string;
  metadata?: ShapeCommonMetadata;
}

export interface TextShape {
  id: string;
  type: "text";
  position: [number, number];
  text: string;
  style: {
    fontSize: number;
    fontColor: [number, number, number, number];
    backgroundColor?: [number, number, number, number];
    padding?: number;
  };
  metadata?: ShapeCommonMetadata;
}

export interface PointShape {
  id: string;
  type: "point";
  position: [number, number];
  style: {
    fillColor: [number, number, number, number];
    strokeColor: [number, number, number, number];
    radius: number;
  };
  text?: string;
  metadata?: ShapeCommonMetadata;
}

export type Shape = (
  | PolygonShape
  | LineShape
  | PolylineShape
  | TextShape
  | PointShape
) & {
  color?: [number, number, number, number];
};

export interface ShapeGroup {
  id: string;
  name: string;
  shapeIds: string[];
  isExpanded: boolean;
  metadata?: {
    createdAt?: Date;
    color?: [number, number, number, number];
  };
}

export const rectangleToPolygon = (
  start: [number, number],
  end: [number, number],
): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);

  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ];
};

export const ellipseToPolygon = (
  start: [number, number],
  end: [number, number],
  segments: number = 64,
): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const radiusX = Math.abs(endX - startX) / 2;
  const radiusY = Math.abs(endY - startY) / 2;

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    points.push([x, y]);
  }

  return points;
};

export const lineToPolygon = (
  start: [number, number],
  end: [number, number],
  lineWidth: number = 3,
): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    const halfWidth = lineWidth / 2;
    return [
      [startX - halfWidth, startY - halfWidth],
      [startX + halfWidth, startY - halfWidth],
      [startX + halfWidth, startY + halfWidth],
      [startX - halfWidth, startY + halfWidth],
      [startX - halfWidth, startY - halfWidth],
    ];
  }

  const nx = -dy / length;
  const ny = dx / length;
  const halfWidth = lineWidth / 2;

  return [
    [startX + nx * halfWidth, startY + ny * halfWidth],
    [endX + nx * halfWidth, endY + ny * halfWidth],
    [endX - nx * halfWidth, endY - ny * halfWidth],
    [startX - nx * halfWidth, startY - ny * halfWidth],
    [startX + nx * halfWidth, startY + ny * halfWidth],
  ];
};

export const isPointInPolygon = (
  point: [number, number],
  polygon: [number, number][],
): boolean => {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

export const textToPolygon = (
  position: [number, number],
  text: string,
  fontSize: number = 14,
  _padding: number = 4,
): [number, number][] => {
  const [x, y] = position;

  const charWidth = fontSize * 0.7;
  const textWidth = text.length * charWidth;
  const textHeight = fontSize * 1.2;

  const hitPadding = Math.max(fontSize * 2, 20);
  const halfWidth = (textWidth + hitPadding * 2) / 2;
  const halfHeight = (textHeight + hitPadding * 2) / 2;

  return [
    [x - halfWidth, y - halfHeight],
    [x + halfWidth, y - halfHeight],
    [x + halfWidth, y + halfHeight],
    [x - halfWidth, y + halfHeight],
    [x - halfWidth, y - halfHeight],
  ];
};

export interface InteractionCoordinate {
  type: "click" | "dragStart" | "drag" | "dragEnd" | "hover";
  coordinate: [number, number, number];
}

export interface DrawingState {
  isDrawing: boolean;
  dragStart: [number, number] | null;
  dragEnd: [number, number] | null;
}

export interface DragState {
  isDragging: boolean;
  draggedShapeId: string | null;
  dragOffset: [number, number] | null;
}

export interface HoverState {
  hoveredShapeId: string | null;
}
