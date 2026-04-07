/**
 * Default styles for annotations rehydrated from waypoint / shape registry data.
 * Keeps import (`shapeToAnnotation`) aligned with legacy waypoint arrows (tip + angle).
 */

/** Region / rehydrated polygon (matches legacy overlay import and `shapeToAnnotation`). */
export const importedPolygonStyle = {
  fillColor: [255, 255, 255, 30] as [number, number, number, number],
  lineColor: [255, 255, 255, 200] as [number, number, number, number],
  lineWidth: 2,
};

export const importedPolylineStyle = {
  lineColor: [255, 255, 255, 255] as [number, number, number, number],
  lineWidth: 3,
};

export const importedLineStyle = {
  fillColor: [0, 0, 0, 0] as [number, number, number, number],
  lineColor: [255, 255, 255, 255] as [number, number, number, number],
  lineWidth: 3,
};

export const importedTextStyle = {
  fontSize: 16,
  fontColor: [255, 255, 255, 255] as [number, number, number, number],
  backgroundColor: [0, 0, 0, 150] as [number, number, number, number],
  padding: 6,
};

export const importedPointStyle = {
  fillColor: [255, 255, 255, 255] as [number, number, number, number],
  strokeColor: [255, 255, 255, 255] as [number, number, number, number],
  radius: 5,
};
