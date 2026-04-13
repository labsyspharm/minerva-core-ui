/**
 * Default styles for shapes rehydrated from waypoint / story registry data.
 * Keeps import (`storyShapeToViewer`) aligned with story arrows (`point` + `angle` rad + `label`).
 */

/** Region / rehydrated polygon (legacy overlay import and `storyShapeToViewer`). */
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
