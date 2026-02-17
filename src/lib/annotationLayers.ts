/**
 * Annotation layer utilities
 *
 * Contains deck.gl layer creation logic for rendering annotations, plus a hook
 * that syncs those layers into the overlay store.
 *
 * Kept in `src/lib/` because this is non-UI logic (it renders via deck.gl layers),
 * even though it is consumed by React components.
 */

import {
  IconLayer,
  PolygonLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import * as React from "react";
import ArrowIconUrl from "@/components/shared/icons/arrow-annotation.svg?url";
import type { Annotation } from "@/lib/stores";
import { useOverlayStore } from "@/lib/stores";

type ColorRGBA = [number, number, number, number];
type LayerType = PolygonLayer | TextLayer | ScatterplotLayer | IconLayer;

// Arrow SVG icon (250x250) - positioned so center (125,125) is at target point
// Exported for drawing preview (arrow tool)
export const ARROW_ICON_URL = ArrowIconUrl;
export const ARROW_ICON_SIZE = 250;

/**
 * Create all deck.gl layers for multiple annotations.
 * Uses consolidated layers per type with arrays of data for better performance.
 *
 * Drawing hierarchy (bottom to top): shapes/points, arrows, labels.
 */
export function createAllAnnotationLayers(
  annotations: Annotation[],
  hiddenLayers: Set<string>,
  hoveredAnnotationId: string | null,
  pickable: boolean = true,
): LayerType[] {
  const visibleAnnotations = annotations.filter(
    (annotation) => !hiddenLayers.has(annotation.id),
  );

  const layers: LayerType[] = [];

  // Group data by layer type
  const polygonData: Array<{
    polygon: [number, number][];
    fillColor: ColorRGBA;
    lineColor: ColorRGBA;
    lineWidth: number;
    id: string;
  }> = [];
  // Plain lines (lineToPolygon): filled only, no stroke - polygon represents thick line
  const filledOnlyPolygonData: Array<{
    polygon: [number, number][];
    fillColor: ColorRGBA;
    id: string;
  }> = [];
  const textData: Array<{
    text: string;
    position: [number, number, number];
    color: ColorRGBA;
    backgroundColor: ColorRGBA;
    fontSize: number;
    id: string;
  }> = [];
  const pointData: Array<{
    position: [number, number, number];
    radius: number;
    fillColor: ColorRGBA;
    lineColor: ColorRGBA;
    id: string;
  }> = [];
  const arrowData: Array<{
    position: [number, number, number];
    angle: number;
    color: ColorRGBA;
    id: string;
  }> = [];
  const labelData: Array<{
    text: string;
    position: [number, number, number];
    pixelOffset: [number, number];
    color: ColorRGBA;
    textAnchor: "start" | "middle" | "end";
    id: string;
  }> = [];

  visibleAnnotations.forEach((annotation) => {
    const isHovered = hoveredAnnotationId === annotation.id;

    if (annotation.type === "text") {
      const fontColor = isHovered
        ? ([0, 120, 255, 255] as ColorRGBA)
        : annotation.style.fontColor;

      const backgroundColor = isHovered
        ? ([0, 120, 255, 150] as ColorRGBA)
        : annotation.style.backgroundColor || ([0, 0, 0, 100] as ColorRGBA);

      textData.push({
        text: annotation.text,
        position: [annotation.position[0], annotation.position[1], 0],
        color: fontColor,
        backgroundColor,
        fontSize: annotation.style.fontSize,
        id: annotation.id,
      });
      return;
    }

    if (annotation.type === "point") {
      const fillColor = isHovered
        ? ([0, 120, 255, 255] as ColorRGBA)
        : annotation.style.fillColor;
      const lineColor = isHovered
        ? ([0, 120, 255, 255] as ColorRGBA)
        : annotation.style.strokeColor;

      pointData.push({
        position: [annotation.position[0], annotation.position[1], 0],
        radius: annotation.style.radius,
        fillColor,
        lineColor,
        id: annotation.id,
      });

      // Add label text if present
      if (annotation.text) {
        const textColor =
          annotation.style.strokeColor || ([255, 255, 255, 255] as ColorRGBA);
        labelData.push({
          text: annotation.text,
          position: [annotation.position[0], annotation.position[1], 0],
          pixelOffset: [0, 0],
          color: textColor,
          textAnchor: "middle",
          id: `${annotation.id}-text`,
        });
      }

      return;
    }

    if (annotation.type === "line") {
      const hasArrowHead = annotation.hasArrowHead !== false; // Default true for backward compat

      if (hasArrowHead) {
        // Arrow annotations use IconLayer
        const polygon = annotation.polygon;
        if (polygon.length >= 2) {
          const [startX, startY] = polygon[0];
          const [endX, endY] = polygon[1];

          // Calculate angle from start to end (in degrees)
          const dx = endX - startX;
          const dy = endY - startY;
          const angleRad = Math.atan2(dy, dx);
          const angleDeg = (angleRad * 180) / Math.PI + 90;

          const iconColor = isHovered
            ? ([0, 120, 255, 255] as ColorRGBA)
            : annotation.style.lineColor;

          arrowData.push({
            position: [endX, endY, 0],
            angle: angleDeg,
            color: iconColor,
            id: `${annotation.id}-arrow`,
          });

          // Add label text if present
          if (annotation.text) {
            // Calculate direction from tip to tail (opposite of arrow direction)
            const labelDx = startX - endX;
            const labelDy = startY - endY;
            const length = Math.sqrt(labelDx * labelDx + labelDy * labelDy);
            const dirX = length > 0 ? labelDx / length : 0;
            const dirY = length > 0 ? labelDy / length : 1;

            const pixelOffsetMagnitude = ARROW_ICON_SIZE / 2 + 12;
            const pixelOffsetX = dirX * pixelOffsetMagnitude;
            const pixelOffsetY = dirY * pixelOffsetMagnitude;

            const textAnchor: "start" | "end" = labelDx > 0 ? "start" : "end";
            const textColor =
              annotation.style.lineColor ||
              ([255, 255, 255, 255] as ColorRGBA);

            labelData.push({
              text: annotation.text,
              position: [endX, endY, 0],
              pixelOffset: [pixelOffsetX, pixelOffsetY],
              color: textColor,
              textAnchor,
              id: `${annotation.id}-text`,
            });
          }
        }
      } else {
        // Plain line (no arrow head): lineToPolygon creates a rectangular polygon
        // that should be FILLED with the line color, not stroked
        const fillColor = isHovered
          ? ([0, 120, 255, 255] as ColorRGBA)
          : annotation.style.lineColor;
        filledOnlyPolygonData.push({
          polygon: annotation.polygon,
          fillColor,
          id: annotation.id,
        });
      }

      return;
    }

    // Polygon-based annotations (rectangle, polygon, polyline, ellipse)
    let fillColor: ColorRGBA = [255, 255, 255, 1];
    let lineColor: ColorRGBA = annotation.style.lineColor;

    const isPolyline = annotation.type === "polyline";
    if (isPolyline) {
      fillColor = [0, 0, 0, 0]; // Transparent fill
    }

    if (isHovered) {
      fillColor = isPolyline ? [0, 0, 0, 0] : [0, 120, 255, 100];
      lineColor = [0, 120, 255, 255];
    }

    polygonData.push({
      polygon: annotation.polygon,
      fillColor,
      lineColor,
      lineWidth: annotation.style.lineWidth,
      id: annotation.id,
    });

    // Add label text if present
    if (annotation.text) {
      const polygon = annotation.polygon;
      const centerX = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length;
      const centerY =
        polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length;
      const textColor =
        annotation.style.lineColor || ([255, 255, 255, 255] as ColorRGBA);

      labelData.push({
        text: annotation.text,
        position: [centerX, centerY, 0],
        pixelOffset: [0, 0],
        color: textColor,
        textAnchor: "middle",
        id: `${annotation.id}-text`,
      });
    }
  });

  // 1. Polygons layer (rectangles, polygons, polylines, ellipses)
  if (polygonData.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "annotation-polygons",
        data: polygonData,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) => d.fillColor,
        getLineColor: (d) => d.lineColor,
        getLineWidth: (d) => d.lineWidth,
        lineWidthScale: 1,
        lineWidthUnits: "pixels",
        lineWidthMinPixels: 1,
        lineWidthMaxPixels: 100,
        stroked: true,
        filled: true,
        pickable,
      }),
    );
  }

  // 1b. Filled-only polygons (plain lines from lineToPolygon - thick line as filled rect)
  if (filledOnlyPolygonData.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "annotation-filled-polygons",
        data: filledOnlyPolygonData,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) => d.fillColor,
        stroked: false,
        filled: true,
        pickable,
      }),
    );
  }

  // 2. Points layer
  if (pointData.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: "annotation-points",
        data: pointData,
        getPosition: (d) => d.position,
        getRadius: (d) => d.radius,
        radiusMinPixels: 3,
        radiusMaxPixels: 20,
        getFillColor: (d) => d.fillColor,
        getLineColor: (d) => d.lineColor,
        getLineWidth: 10,
        pickable,
      }),
    );
  }

  // 3. Text annotations layer
  if (textData.length > 0) {
    layers.push(
      new TextLayer({
        id: "annotation-texts",
        data: textData,
        getText: (d) => d.text,
        getPosition: (d) => d.position,
        maxWidth: 9,
        getColor: (d) => d.color,
        background: true,
        getBackgroundColor: (d) => d.backgroundColor,
        getSize: (d) => d.fontSize,
        fontFamily: "Arial, sans-serif",
        fontWeight: "normal",
        backgroundPadding: [6, 6],
        pickable,
      }),
    );
  }

  // 4. Arrows layer
  if (arrowData.length > 0) {
    layers.push(
      new IconLayer({
        id: "annotation-arrows",
        data: arrowData,
        getPosition: (d) => d.position,
        getIcon: () => ({
          url: ARROW_ICON_URL,
          width: ARROW_ICON_SIZE,
          height: ARROW_ICON_SIZE,
          anchorX: ARROW_ICON_SIZE / 2,
          anchorY: ARROW_ICON_SIZE / 2,
        }),
        getSize: ARROW_ICON_SIZE,
        sizeUnits: "pixels",
        sizeMinPixels: ARROW_ICON_SIZE,
        sizeMaxPixels: ARROW_ICON_SIZE,
        getAngle: (d) => d.angle,
        getColor: (d) => d.color,
        pickable,
        billboard: false,
      }),
    );
  }

  // 5. Labels layer (on top)
  if (labelData.length > 0) {
    layers.push(
      new TextLayer({
        id: "annotation-labels",
        data: labelData,
        getText: (d) => d.text,
        getPosition: (d) => d.position,
        getPixelOffset: (d) => d.pixelOffset,
        maxWidth: 9,
        getColor: (d) => d.color,
        background: true,
        getBackgroundColor: [0, 0, 0, 180] as ColorRGBA,
        getSize: 14,
        fontFamily: "Arial, sans-serif",
        fontWeight: "normal",
        backgroundPadding: [6, 6],
        pickable: false,
        getTextAnchor: (d) => d.textAnchor,
      }),
    );
  }

  return layers;
}

/**
 * Hook that creates deck.gl layers from annotations in the store and syncs them
 * to the overlay layers.
 *
 * @param pickable - Whether layers should be pickable/interactive (default true).
 *                  Set false for presenter mode.
 */
export function useAnnotationLayers(pickable: boolean = true) {
  const annotations = useOverlayStore((state) => state.annotations);
  const hiddenLayers = useOverlayStore((state) => state.hiddenLayers);
  const hoveredAnnotationId = useOverlayStore(
    (state) => state.hoverState.hoveredAnnotationId,
  );

  const annotationLayers = React.useMemo(() => {
    return createAllAnnotationLayers(
      annotations,
      hiddenLayers,
      hoveredAnnotationId,
      pickable,
    );
  }, [annotations, hiddenLayers, hoveredAnnotationId, pickable]);

  React.useEffect(() => {
    const consolidatedLayerIds = [
      "annotation-polygons",
      "annotation-points",
      "annotation-texts",
      "annotation-arrows",
      "annotation-labels",
    ];

    consolidatedLayerIds.forEach((layerId) => {
      useOverlayStore.getState().removeOverlayLayer(layerId);
    });

    annotationLayers.forEach((layer) => {
      useOverlayStore.getState().addOverlayLayer(layer);
    });
  }, [annotationLayers]);

  return annotationLayers;
}
