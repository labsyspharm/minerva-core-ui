import * as React from "react";
import { PolygonLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useOverlayStore, lineToPolygon } from "../../lib/stores";

/**
 * AnnotationRenderer - A minimal component that renders annotations as deck.gl layers
 * without any UI (no toolbar, no drawing tools). This is used in presenter mode
 * where we want to display annotations but not allow editing.
 */
const AnnotationRenderer: React.FC = () => {
  // Get annotations from store with proper reactivity
  const annotations = useOverlayStore(state => state.annotations);
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);
  const hoveredAnnotationId = useOverlayStore(state => state.hoverState.hoveredAnnotationId);
  const viewportZoom = useOverlayStore(state => state.viewportZoom);

  // Create annotation layers from stored annotations (excluding hidden ones)
  const annotationLayers = React.useMemo(() => {
    const layers: (PolygonLayer | TextLayer | ScatterplotLayer)[] = [];

    annotations
      .filter(annotation => !hiddenLayers.has(annotation.id))
      .forEach(annotation => {
        if (annotation.type === 'text') {
          const isHovered = hoveredAnnotationId === annotation.id;
          const fontColor = isHovered 
            ? [0, 120, 255, 255] as [number, number, number, number]
            : annotation.style.fontColor;
          const backgroundColor = isHovered
            ? [0, 120, 255, 150] as [number, number, number, number]
            : annotation.style.backgroundColor || [0, 0, 0, 100];
            
          layers.push(new TextLayer({
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
          }));
        } else if (annotation.type === 'point') {
          const isHovered = hoveredAnnotationId === annotation.id;
          const fillColor = isHovered
            ? [0, 120, 255, 255] as [number, number, number, number]
            : annotation.style.fillColor;
          const lineColor = isHovered
            ? [0, 120, 255, 255] as [number, number, number, number]
            : annotation.style.strokeColor;
            
          layers.push(new ScatterplotLayer({
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
          }));
          
          // @ts-ignore - text field exists on all annotation types now
          if (annotation.text) {
            const textColor = annotation.style.strokeColor || [255, 255, 255, 255];
            
            layers.push(new TextLayer({
              id: `annotation-${annotation.id}-text`,
              data: [{
                // @ts-ignore
                text: annotation.text,
                position: [annotation.position[0], annotation.position[1], 0],
              }],
              getText: d => d.text,
              getPosition: d => d.position,
              getColor: textColor,
              getBackgroundColor: [0, 0, 0, 150],
              getSize: 14,
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'normal',
              padding: 4,
              pickable: false,
            }));
          }
        } else {
          // Polygon-based annotations (rectangle, polygon, line, polyline, ellipse)
          const isHovered = hoveredAnnotationId === annotation.id;
          let fillColor: [number, number, number, number] = [255, 255, 255, 1];
          let lineColor: [number, number, number, number] = annotation.style.lineColor;
          
          // @ts-ignore - fillColor may exist on line annotations
          if (annotation.style.fillColor) {
            // @ts-ignore
            fillColor = annotation.style.fillColor;
          } else {
            // @ts-ignore
            if (annotation.type === 'polyline') {
              fillColor = [0, 0, 0, 0];
            }
          }

          if (isHovered) {
            fillColor = [0, 120, 255, 100];
            lineColor = [0, 120, 255, 255];
          }

          const isLine = annotation.type === 'line';
          const shouldStroke = !isLine && annotation.style.lineWidth > 0;
          
          // For lines, recalculate polygon based on current zoom for consistent pixel width
          let polygonToRender = annotation.polygon;
          // @ts-ignore - LineAnnotation properties
          if (isLine && annotation.startPoint && annotation.endPoint && annotation.desiredPixelWidth) {
            // @ts-ignore
            const worldWidth = annotation.desiredPixelWidth * Math.pow(2, -viewportZoom);
            // @ts-ignore
            polygonToRender = lineToPolygon(annotation.startPoint, annotation.endPoint, worldWidth);
          }
          
          layers.push(new PolygonLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              polygon: polygonToRender
            }],
            getPolygon: d => d.polygon,
            getFillColor: fillColor,
            getLineColor: lineColor,
            getLineWidth: annotation.style.lineWidth * 10,
            lineWidthScale: 1,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: annotation.style.lineWidth,
            lineWidthMaxPixels: annotation.style.lineWidth,
            stroked: shouldStroke,
            filled: true,
            pickable: true,
          }));
          
          // @ts-ignore - text field exists on all annotation types
          if (annotation.text) {
            const polygon = annotation.polygon;
            const centerX = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length;
            const centerY = polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length;
            const textColor = annotation.style.lineColor || [255, 255, 255, 255];
            
            layers.push(new TextLayer({
              id: `annotation-${annotation.id}-text`,
              data: [{
                // @ts-ignore
                text: annotation.text,
                position: [centerX, centerY, 0],
              }],
              getText: d => d.text,
              getPosition: d => d.position,
              getColor: textColor,
              getBackgroundColor: [0, 0, 0, 150],
              getSize: 14,
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'normal',
              padding: 4,
              pickable: false,
            }));
          }
        }
      });

    return layers;
  }, [annotations, hiddenLayers, hoveredAnnotationId, viewportZoom]);

  // Add annotation layers to the overlay store
  React.useEffect(() => {
    // Clear existing annotation layers from overlay store
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

  // This component renders nothing - it only manages layers in the store
  return null;
};

export { AnnotationRenderer };
