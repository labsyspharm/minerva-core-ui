/**
 * AnnotationLayers.ts
 * 
 * Contains all deck.gl layer creation logic for rendering annotations.
 * Used by both DrawingOverlay (editor mode) and AnnotationRenderer (presenter mode).
 */

import * as React from "react";
import { PolygonLayer, TextLayer, ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import { useOverlayStore } from "../../lib/stores";
import type { Annotation } from "../../lib/stores";

type ColorRGBA = [number, number, number, number];
type LayerType = PolygonLayer | TextLayer | ScatterplotLayer | IconLayer;

// ============================================================================
// Arrow Icon Constants
// ============================================================================

// Arrow PNG icon (1000x1000) - positioned so center (500,500) is at target point
const ARROW_ICON_URL = '/arrow.png';
const ARROW_ICON_SIZE = 1000;

// ============================================================================
// Layer Creation Functions
// ============================================================================

/**
 * Create a TextLayer for a text annotation
 */
export function createTextLayer(
  annotation: Annotation & { type: 'text' },
  isHovered: boolean
): TextLayer {
  const fontColor = isHovered
    ? [0, 120, 255, 255] as ColorRGBA
    : annotation.style.fontColor;
  const backgroundColor = isHovered
    ? [0, 120, 255, 150] as ColorRGBA
    : annotation.style.backgroundColor || [0, 0, 0, 100] as ColorRGBA;

  return new TextLayer({
    id: `annotation-${annotation.id}`,
    data: [{
      text: annotation.text,
      position: [annotation.position[0], annotation.position[1], 0],
    }],
    getText: d => d.text,
    getPosition: d => d.position,
    getColor: fontColor,
    getBackgroundColor: backgroundColor,
    getSize: annotation.style.fontSize,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'normal',
    padding: 4,
    pickable: true,
  });
}

/**
 * Create a ScatterplotLayer for a point annotation
 */
export function createPointLayer(
  annotation: Annotation & { type: 'point' },
  isHovered: boolean
): ScatterplotLayer {
  const fillColor = isHovered
    ? [0, 120, 255, 255] as ColorRGBA
    : annotation.style.fillColor;
  const lineColor = isHovered
    ? [0, 120, 255, 255] as ColorRGBA
    : annotation.style.strokeColor;

  return new ScatterplotLayer({
    id: `annotation-${annotation.id}`,
    data: [{
      position: [annotation.position[0], annotation.position[1], 0],
      radius: annotation.style.radius,
    }],
    getPosition: d => d.position,
    getRadius: d => d.radius,
    radiusMinPixels: annotation.style.radius,
    radiusMaxPixels: annotation.style.radius,
    getFillColor: fillColor,
    getLineColor: lineColor,
    getLineWidth: 10,
    pickable: true
  });
}

/**
 * Create an IconLayer for arrow/line annotations
 * Renders an arrow icon at the end point, rotated to match the line direction
 */
export function createArrowIconLayer(
  annotation: Annotation,
  isHovered: boolean
): IconLayer | null {
  // Only for line annotations
  if (annotation.type !== 'line') {
    return null;
  }

  // Extract start and end points from the polygon
  // Polygon format: [[startX, startY], [endX, endY], [endX, endY], [startX, startY], [startX, startY]]
  const polygon = annotation.polygon;
  if (polygon.length < 2) return null;

  const [startX, startY] = polygon[0];
  const [endX, endY] = polygon[1];

  // Calculate angle from start to end (in degrees)
  // The PNG arrow points up (negative Y), so we need to adjust
  const dx = endX - startX;
  const dy = endY - startY;
  const angleRad = Math.atan2(dy, dx);
  // Convert to degrees and rotate 90° since arrow points up
  const angleDeg = (angleRad * 180 / Math.PI) + 90;

  const iconColor = isHovered
    ? [0, 120, 255, 255] as ColorRGBA
    : annotation.style.lineColor;

  return new IconLayer({
    id: `annotation-${annotation.id}`,
    data: [{
      position: [endX, endY, 0],
      angle: angleDeg,
    }],
    getPosition: d => d.position,
    getIcon: () => ({
      url: ARROW_ICON_URL,
      width: ARROW_ICON_SIZE,
      height: ARROW_ICON_SIZE,
      anchorX: ARROW_ICON_SIZE / 2, // Center of PNG (200,200)
      anchorY: ARROW_ICON_SIZE / 2,
    }),
    getSize: 300,
    sizeUnits: 'pixels',
    sizeMinPixels: 300,
    sizeMaxPixels: 300,
    getAngle: d => d.angle,
    getColor: iconColor,
    pickable: true,
    billboard: false, // Don't rotate to face camera
  });
}

/**
 * Create a PolygonLayer for polygon-based annotations (rectangle, polygon, polyline, ellipse)
 * Polylines use stroke only (no fill) for better performance
 */
export function createPolygonLayer(
  annotation: Annotation,
  isHovered: boolean
): PolygonLayer | null {
  // Skip text, point, and line types (lines use IconLayer now)
  if (annotation.type === 'text' || annotation.type === 'point' || annotation.type === 'line') {
    return null;
  }

  let fillColor: ColorRGBA = [255, 255, 255, 1];
  let lineColor: ColorRGBA = annotation.style.lineColor;

  // Polylines use stroke only, no fill
  const isPolyline = annotation.type === 'polyline';
  if (isPolyline) {
    fillColor = [0, 0, 0, 0]; // Transparent fill
  }

  if (isHovered) {
    fillColor = isPolyline ? [0, 0, 0, 0] : [0, 120, 255, 100];
    lineColor = [0, 120, 255, 255];
  }

  return new PolygonLayer({
    id: `annotation-${annotation.id}`,
    data: [{ polygon: annotation.polygon }],
    getPolygon: d => d.polygon,
    getFillColor: fillColor,
    getLineColor: lineColor,
    getLineWidth: annotation.style.lineWidth * 10,
    lineWidthScale: 1,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: annotation.style.lineWidth,
    lineWidthMaxPixels: annotation.style.lineWidth,
    stroked: true,
    filled: true,
    pickable: true,
  });
}

/**
 * Create a TextLayer for annotation label text (attached to shapes/points)
 */
export function createLabelTextLayer(
  annotationId: string,
  text: string,
  position: [number, number, number],
  textColor: ColorRGBA
): TextLayer {
  return new TextLayer({
    id: `annotation-${annotationId}-text`,
    data: [{ text, position }],
    getText: d => d.text,
    getPosition: d => d.position,
    getColor: textColor,
    getBackgroundColor: [0, 0, 0, 150] as ColorRGBA,
    getSize: 14,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'normal',
    padding: 4,
    pickable: false,
  });
}

// ============================================================================
// Main Layer Creation
// ============================================================================

/**
 * Create all deck.gl layers for a single annotation
 */
export function createAnnotationLayers(
  annotation: Annotation,
  hoveredAnnotationId: string | null
): LayerType[] {
  const layers: LayerType[] = [];
  const isHovered = hoveredAnnotationId === annotation.id;

  if (annotation.type === 'text') {
    layers.push(createTextLayer(annotation, isHovered));
  } else if (annotation.type === 'point') {
    layers.push(createPointLayer(annotation, isHovered));

    // Add label text if present
    // @ts-ignore
    if (annotation.text) {
      const textColor = annotation.style.strokeColor || [255, 255, 255, 255] as ColorRGBA;
      layers.push(createLabelTextLayer(
        annotation.id,
        // @ts-ignore
        annotation.text,
        [annotation.position[0], annotation.position[1], 0],
        textColor
      ));
    }
  } else if (annotation.type === 'line') {
    // Arrow/line annotations use IconLayer
    const arrowLayer = createArrowIconLayer(annotation, isHovered);
    if (arrowLayer) {
      layers.push(arrowLayer);
    }

    // Add label text if present (position near the arrow tip)
    // @ts-ignore
    if (annotation.text) {
      const polygon = annotation.polygon;
      // Use end point (arrow tip) for text position
      const [endX, endY] = polygon[1];
      const textColor = annotation.style.lineColor || [255, 255, 255, 255] as ColorRGBA;

      layers.push(createLabelTextLayer(
        annotation.id,
        // @ts-ignore
        annotation.text,
        [endX, endY, 0],
        textColor
      ));
    }
  } else {
    // Polygon-based annotations (rectangle, polygon, polyline, ellipse)
    const polygonLayer = createPolygonLayer(annotation, isHovered);
    if (polygonLayer) {
      layers.push(polygonLayer);
    }

    // Add label text if present
    // @ts-ignore
    if (annotation.text) {
      const polygon = annotation.polygon;
      const centerX = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length;
      const centerY = polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length;
      const textColor = annotation.style.lineColor || [255, 255, 255, 255] as ColorRGBA;

      layers.push(createLabelTextLayer(
        annotation.id,
        // @ts-ignore
        annotation.text,
        [centerX, centerY, 0],
        textColor
      ));
    }
  }

  return layers;
}

/**
 * Create all deck.gl layers for multiple annotations
 */
export function createAllAnnotationLayers(
  annotations: Annotation[],
  hiddenLayers: Set<string>,
  hoveredAnnotationId: string | null
): LayerType[] {
  const layers: LayerType[] = [];

  annotations
    .filter(annotation => !hiddenLayers.has(annotation.id))
    .forEach(annotation => {
      layers.push(...createAnnotationLayers(annotation, hoveredAnnotationId));
    });

  return layers;
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook that creates deck.gl layers from annotations in the store
 * and syncs them to the overlay layers.
 */
export function useAnnotationLayers() {
  const annotations = useOverlayStore(state => state.annotations);
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);
  const hoveredAnnotationId = useOverlayStore(state => state.hoverState.hoveredAnnotationId);

  const annotationLayers = React.useMemo(() => {
    return createAllAnnotationLayers(annotations, hiddenLayers, hoveredAnnotationId);
  }, [annotations, hiddenLayers, hoveredAnnotationId]);

  // Sync layers to the overlay store
  React.useEffect(() => {
    const currentLayers = useOverlayStore.getState().overlayLayers;
    const annotationLayerIds = currentLayers
      .filter(layer => layer && layer.id.startsWith('annotation-'))
      .map(layer => layer.id);

    // Remove old annotation layers
    annotationLayerIds.forEach(layerId => {
      useOverlayStore.getState().removeOverlayLayer(layerId);
    });

    // Add new annotation layers
    annotationLayers.forEach(layer => {
      if (layer) {
        useOverlayStore.getState().addOverlayLayer(layer);
      }
    });
  }, [annotationLayers]);

  return annotationLayers;
}
