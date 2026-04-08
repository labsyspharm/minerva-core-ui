/**
 * Shape layer utilities
 *
 * Contains deck.gl layer creation logic for rendering viewer shapes, plus a hook
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
import ArrowHoverIconUrl from "@/components/shared/icons/arrow-annotation-hover.svg?url";
import { useAppStore } from "@/lib/stores/app-store";
import type { Shape } from "./shapeModel";

type ColorRGBA = [number, number, number, number];
type LayerType = PolygonLayer | TextLayer | ScatterplotLayer | IconLayer;

// Arrow SVG icon (250x250) - positioned so center (125,125) is at target point
// Exported for drawing preview (arrow tool). Hover uses a separate asset (WebGL
// IconLayer cannot be styled with CSS).
export const ARROW_ICON_URL = ArrowIconUrl;
export const ARROW_ICON_HOVER_URL = ArrowHoverIconUrl;
export const ARROW_ICON_SIZE = 250;

/**
 * Create all deck.gl layers for multiple viewer shapes.
 * Uses consolidated layers per type with arrays of data for better performance.
 *
 * Drawing hierarchy (bottom to top): shapes/points, arrows, labels.
 */
export function createAllShapeLayers(
  shapes: Shape[],
  hiddenShapeIds: Set<string>,
  hoveredShapeId: string | null,
  pickable: boolean = true,
  brushEditTargetId: string | null = null,
): LayerType[] {
  const visibleShapes = shapes.filter((shape) => !hiddenShapeIds.has(shape.id));

  const layers: LayerType[] = [];

  // Group data by layer type
  const polygonData: Array<{
    polygon: [number, number][];
    fillColor: ColorRGBA;
    lineColor: ColorRGBA;
    lineWidth: number;
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
    iconUrl: string;
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

  const brushEditOutlineData: Array<{
    polygon: [number, number][];
    lineColor: ColorRGBA;
    lineWidth: number;
    id: string;
  }> = [];

  visibleShapes.forEach((shape) => {
    const isHovered = hoveredShapeId === shape.id;
    const isBrushEditTarget =
      brushEditTargetId != null &&
      shape.id === brushEditTargetId &&
      shape.type === "polygon";

    if (shape.type === "text") {
      const fontColor = isHovered
        ? ([0, 120, 255, 255] as ColorRGBA)
        : shape.style.fontColor;

      const backgroundColor = isHovered
        ? ([0, 120, 255, 150] as ColorRGBA)
        : shape.style.backgroundColor || ([0, 0, 0, 100] as ColorRGBA);

      textData.push({
        text: shape.text,
        position: [shape.position[0], shape.position[1], 0],
        color: fontColor,
        backgroundColor,
        fontSize: shape.style.fontSize,
        id: shape.id,
      });
      return;
    }

    if (shape.type === "point") {
      const fillColor = isHovered
        ? ([0, 120, 255, 255] as ColorRGBA)
        : shape.style.fillColor;
      const lineColor = isHovered
        ? ([0, 120, 255, 255] as ColorRGBA)
        : shape.style.strokeColor;

      pointData.push({
        position: [shape.position[0], shape.position[1], 0],
        radius: shape.style.radius,
        fillColor,
        lineColor,
        id: shape.id,
      });

      // Add label text if present
      if (shape.text) {
        const textColor =
          shape.style.strokeColor || ([255, 255, 255, 255] as ColorRGBA);
        labelData.push({
          text: shape.text,
          position: [shape.position[0], shape.position[1], 0],
          pixelOffset: [0, 0],
          color: textColor,
          textAnchor: "middle",
          id: `${shape.id}-text`,
        });
      }

      return;
    }

    if (shape.type === "line") {
      const hasArrowHead = shape.hasArrowHead !== false; // Default true for backward compat

      const baseLineColor = shape.style.lineColor;
      const lineColor = hasArrowHead
        ? baseLineColor
        : isHovered
          ? ([0, 120, 255, 255] as ColorRGBA)
          : baseLineColor;

      if (hasArrowHead) {
        // Arrow shapes use IconLayer for the head/body glyph
        const polygon = shape.polygon;
        if (polygon.length >= 2) {
          const [startX, startY] = polygon[0];
          const [endX, endY] = polygon[1];

          // Calculate angle from start to end (in degrees)
          const dx = endX - startX;
          const dy = endY - startY;
          const angleRad = Math.atan2(dy, dx);
          const angleDeg = (angleRad * 180) / Math.PI + 90;

          // Arrow color stays fixed (no hover tint); glyph swaps to hover asset.
          const iconColor = baseLineColor;
          const iconUrl = isHovered ? ArrowHoverIconUrl : ArrowIconUrl;

          arrowData.push({
            position: [endX, endY, 0],
            angle: angleDeg,
            color: iconColor,
            iconUrl,
            id: `${shape.id}-arrow`,
          });

          // Wide invisible stroke along the segment for move-tool hover/drag on
          // the shaft (hover appearance is the arrow SVG only).
          const hitLineWidth = Math.max(shape.style.lineWidth, 12);
          polygonData.push({
            polygon: shape.polygon,
            fillColor: [0, 0, 0, 0],
            lineColor: [0, 0, 0, 0] as ColorRGBA,
            lineWidth: hitLineWidth,
            id: shape.id,
          });

          // Add label text if present
          if (shape.text) {
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
            const textColor = baseLineColor;

            labelData.push({
              text: shape.text,
              position: [endX, endY, 0],
              pixelOffset: [pixelOffsetX, pixelOffsetY],
              color: textColor,
              textAnchor,
              id: `${shape.id}-text`,
            });
          }
        }
      } else {
        // Plain line (no arrow head): render as stroke-only polygon using pixel
        // line width for consistent thickness with the orange preview mode.
        polygonData.push({
          polygon: shape.polygon,
          fillColor: [0, 0, 0, 0],
          lineColor,
          lineWidth: shape.style.lineWidth,
          id: shape.id,
        });
      }

      return;
    }

    // Polygon-based shapes (closed polygons, polylines share stroke path)
    let fillColor: ColorRGBA = [255, 255, 255, 1];
    let lineColor: ColorRGBA = shape.style.lineColor;

    const isPolyline = shape.type === "polyline";
    if (isPolyline) {
      fillColor = [0, 0, 0, 0]; // Transparent fill
    }

    if (isHovered) {
      fillColor = isPolyline ? [0, 0, 0, 0] : [0, 120, 255, 100];
      lineColor = [0, 120, 255, 255];
    }

    polygonData.push({
      polygon: shape.polygon,
      fillColor,
      lineColor,
      lineWidth: shape.style.lineWidth,
      id: shape.id,
    });

    if (isBrushEditTarget) {
      brushEditOutlineData.push({
        polygon: shape.polygon,
        lineColor: [255, 165, 0, 255],
        lineWidth: Math.max(shape.style.lineWidth, 3),
        id: `${shape.id}-brush-outline`,
      });
    }

    // Add label text if present
    if (shape.text) {
      const polygon = shape.polygon;
      const centerX = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length;
      const centerY =
        polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length;
      const textColor =
        shape.style.lineColor || ([255, 255, 255, 255] as ColorRGBA);

      labelData.push({
        text: shape.text,
        position: [centerX, centerY, 0],
        pixelOffset: [0, 0],
        color: textColor,
        textAnchor: "middle",
        id: `${shape.id}-text`,
      });
    }
  });

  // 1. Polygons layer (filled polygons + stroked polylines)
  if (polygonData.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "shape-polygons",
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

  // 1b. Brush-edit outline layer: orange outline for the polygon currently
  // being edited with the brush add/remove tool. Rendered above base polygons.
  if (brushEditOutlineData.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "shape-brush-edit-outline",
        data: brushEditOutlineData,
        getPolygon: (d) => d.polygon,
        getFillColor: [0, 0, 0, 0] as ColorRGBA,
        getLineColor: (d) => d.lineColor,
        getLineWidth: (d) => d.lineWidth,
        lineWidthScale: 1,
        lineWidthUnits: "pixels",
        lineWidthMinPixels: 1,
        lineWidthMaxPixels: 100,
        stroked: true,
        filled: false,
        pickable: false,
      }),
    );
  }

  // 2. Points layer
  if (pointData.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: "shape-points",
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

  // 3. Text shapes layer
  if (textData.length > 0) {
    layers.push(
      new TextLayer({
        id: "shape-texts",
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

  // 4. Line arrowheads (IconLayer)
  if (arrowData.length > 0) {
    layers.push(
      new IconLayer({
        id: "shape-arrows",
        data: arrowData,
        getPosition: (d) => d.position,
        getIcon: (d) => ({
          url: d.iconUrl,
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
        id: "shape-labels",
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
        pickable,
        getTextAnchor: (d) => d.textAnchor,
      }),
    );
  }

  return layers;
}

/**
 * Hook that creates deck.gl layers from viewer shapes in the store and syncs them
 * to the overlay layers.
 *
 * @param pickable - Whether layers should be pickable/interactive (default true).
 *                  Set false for presenter mode.
 */
export function useShapeLayers(pickable: boolean = true) {
  const shapes = useAppStore((state) => state.shapes);
  const hiddenShapeIds = useAppStore((state) => state.hiddenShapeIds);
  const hoveredShapeId = useAppStore(
    (state) => state.hoverState.hoveredShapeId,
  );
  const brushEditTargetId = useAppStore((state) => state.brushEditTargetId);

  const shapeLayers = React.useMemo(() => {
    return createAllShapeLayers(
      shapes,
      hiddenShapeIds,
      hoveredShapeId,
      pickable,
      brushEditTargetId,
    );
  }, [shapes, hiddenShapeIds, hoveredShapeId, pickable, brushEditTargetId]);

  React.useEffect(() => {
    const consolidatedLayerIds = [
      "shape-polygons",
      "shape-brush-edit-outline",
      "shape-points",
      "shape-texts",
      "shape-arrows",
      "shape-labels",
    ];

    consolidatedLayerIds.forEach((layerId) => {
      useAppStore.getState().removeOverlayLayer(layerId);
    });

    shapeLayers.forEach((layer) => {
      useAppStore.getState().addOverlayLayer(layer);
    });
  }, [shapeLayers]);

  return shapeLayers;
}
