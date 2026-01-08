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
import ArrowIconUrl from './icons/arrow-annotation.svg?url';

type ColorRGBA = [number, number, number, number];
type LayerType = PolygonLayer | TextLayer | ScatterplotLayer | IconLayer;

// ============================================================================
// Arrow Icon Constants
// ============================================================================

// Arrow SVG icon (250x250) - positioned so center (125,125) is at target point
const ARROW_ICON_URL = ArrowIconUrl;
const ARROW_ICON_SIZE = 250;

// ============================================================================
// Layer Creation Functions
// ============================================================================

/**
 * Create a TextLayer for a text annotation
 */
export function createTextLayer(
  annotation: Annotation & { type: 'text' },
  isHovered: boolean,
  pickable: boolean = true
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
    maxWidth: 10,
    getColor: fontColor,
    background: true, // Enable background rendering
    getBackgroundColor: backgroundColor,
    getSize: annotation.style.fontSize,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'normal',
    backgroundPadding: [6, 6], // Padding around text
    pickable,
  });
}

/**
 * Create a ScatterplotLayer for a point annotation
 */
export function createPointLayer(
  annotation: Annotation & { type: 'point' },
  isHovered: boolean,
  pickable: boolean = true
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
    pickable
  });
}

/**
 * Create an IconLayer for arrow/line annotations
 * Renders an arrow icon at the end point, rotated to match the line direction
 */
export function createArrowIconLayer(
  annotation: Annotation,
  isHovered: boolean,
  pickable: boolean = true
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
  // The SVG arrow points up (negative Y), so we need to adjust
  const dx = endX - startX;
  const dy = endY - startY;
  const angleRad = Math.atan2(dy, dx);
  // Convert to degrees and rotate 90° since arrow points up
  const angleDeg = (angleRad * 180 / Math.PI) + 90;

  const iconColor = isHovered
    ? [0, 120, 255, 255] as ColorRGBA
    : annotation.style.lineColor;

  return new IconLayer({
    id: `annotation-${annotation.id}-arrow`,
    data: [{
      position: [endX, endY, 0],
      angle: angleDeg,
    }],
    getPosition: d => d.position,
    getIcon: () => ({
      url: ARROW_ICON_URL,
      width: ARROW_ICON_SIZE,
      height: ARROW_ICON_SIZE,
      anchorX: ARROW_ICON_SIZE / 2, // Center of SVG (125,125)
      anchorY: ARROW_ICON_SIZE / 2,
    }),
    getSize: ARROW_ICON_SIZE,
    sizeUnits: 'pixels',
    sizeMinPixels: ARROW_ICON_SIZE,
    sizeMaxPixels: ARROW_ICON_SIZE,
    getAngle: d => d.angle,
    getColor: iconColor,
    pickable,
    billboard: false, // Don't rotate to face camera
  });
}

/**
 * Create a PolygonLayer for polygon-based annotations (rectangle, polygon, polyline, ellipse)
 * Polylines use stroke only (no fill) for better performance
 */
export function createPolygonLayer(
  annotation: Annotation,
  isHovered: boolean,
  pickable: boolean = true
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
    pickable,
  });
}

/**
 * Create a TextLayer for annotation label text (attached to shapes/points)
 */
export function createLabelTextLayer(
  annotationId: string,
  text: string,
  position: [number, number, number],
  textColor: ColorRGBA,
  textAnchor: 'start' | 'middle' | 'end' = 'middle',
  pixelOffset: [number, number] = [0, 0]
): TextLayer {
  return new TextLayer({
    id: `annotation-${annotationId}-text`,
    data: [{ text, position, pixelOffset }],
    getText: d => d.text,
    getPosition: d => d.position,
    getPixelOffset: d => d.pixelOffset,
    maxWidth: 10,
    getColor: textColor,
    background: true, // Enable background rendering
    getBackgroundColor: [0, 0, 0, 180] as ColorRGBA, // Semi-transparent grey
    getSize: 14,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'normal',
    backgroundPadding: [6, 6], // Padding around text
    pickable: false,
    getTextAnchor: textAnchor,
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
  hoveredAnnotationId: string | null,
  pickable: boolean = true
): LayerType[] {
  const layers: LayerType[] = [];
  const isHovered = hoveredAnnotationId === annotation.id;

  if (annotation.type === 'text') {
    layers.push(createTextLayer(annotation, isHovered, pickable));
  } else if (annotation.type === 'point') {
    layers.push(createPointLayer(annotation, isHovered, pickable));

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
    const arrowLayer = createArrowIconLayer(annotation, isHovered, pickable);
    if (arrowLayer) {
      layers.push(arrowLayer);
    }

    // Add label text if present (position at icon center with pixel offset toward tail)
    // @ts-ignore
    if (annotation.text) {
      const polygon = annotation.polygon;
      const [startX, startY] = polygon[0]; // Tail
      const [endX, endY] = polygon[1]; // Tip (icon center)

      // Calculate direction from tip to tail (normalized)
      const dx = startX - endX;
      const dy = startY - endY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const dirX = length > 0 ? dx / length : 0;
      const dirY = length > 0 ? dy / length : 1;

      // Pixel offset relative to icon size (tail is at ~half the icon size from center
      const pixelOffsetMagnitude = ARROW_ICON_SIZE / 2 + 12;
      // Pixel offset in screen coordinates (x right, y down in screen space)
      const pixelOffsetX = dirX * pixelOffsetMagnitude;
      const pixelOffsetY = dirY * pixelOffsetMagnitude;

      // Text anchor based on arrow direction:
      // - Arrow pointing left (tail on right, dx > 0): text starts at tail, extends right
      // - Arrow pointing right (tail on left, dx < 0): text ends at tail, extends left
      const textAnchor: 'start' | 'end' = dx > 0 ? 'start' : 'end';

      const textColor = annotation.style.lineColor || [255, 255, 255, 255] as ColorRGBA;

      layers.push(createLabelTextLayer(
        annotation.id,
        // @ts-ignore
        annotation.text,
        [endX, endY, 0], // Position at icon center
        textColor,
        textAnchor,
        [pixelOffsetX, pixelOffsetY] // Pixel offset toward tail
      ));
    }
  } else {
    // Polygon-based annotations (rectangle, polygon, polyline, ellipse)
    const polygonLayer = createPolygonLayer(annotation, isHovered, pickable);
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
 * Drawing hierarchy (bottom to top): shapes/points, arrows, labels
 */
export function createAllAnnotationLayers(
  annotations: Annotation[],
  hiddenLayers: Set<string>,
  hoveredAnnotationId: string | null,
  pickable: boolean = true
): LayerType[] {
  const shapeLayers: LayerType[] = [];
  const arrowLayers: LayerType[] = [];
  const labelLayers: LayerType[] = [];

  annotations
    .filter(annotation => !hiddenLayers.has(annotation.id))
    .forEach(annotation => {
      const annotationLayers = createAnnotationLayers(annotation, hoveredAnnotationId, pickable);
      // Separate layers by type based on ID suffix
      annotationLayers.forEach(layer => {
        if (layer.id.endsWith('-text')) {
          labelLayers.push(layer);
        } else if (layer.id.endsWith('-arrow')) {
          arrowLayers.push(layer);
        } else {
          shapeLayers.push(layer);
        }
      });
    });

  // Return in z-order: shapes at bottom, then arrows, then labels on top
  return [...shapeLayers, ...arrowLayers, ...labelLayers];
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook that creates deck.gl layers from annotations in the store
 * and syncs them to the overlay layers.
 * @param pickable - Whether layers should be pickable/interactive (default true, set false for presenter mode)
 */
export function useAnnotationLayers(pickable: boolean = true) {
  const annotations = useOverlayStore(state => state.annotations);
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);
  const hoveredAnnotationId = useOverlayStore(state => state.hoverState.hoveredAnnotationId);

  const annotationLayers = React.useMemo(() => {
    return createAllAnnotationLayers(annotations, hiddenLayers, hoveredAnnotationId, pickable);
  }, [annotations, hiddenLayers, hoveredAnnotationId, pickable]);

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
