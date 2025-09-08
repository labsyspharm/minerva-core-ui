import * as React from "react";
import { PolygonLayer, LineLayer } from '@deck.gl/layers';
import { useOverlayStore } from "../../lib/stores";

interface DrawingOverlayProps {
  onLayerCreate: (layer: PolygonLayer | LineLayer) => void;
  activeTool: string;
  onInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number]) => void;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number] } | null;
}

const getLineWidthPx = () => 3; // always 3px

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ onLayerCreate, activeTool, currentInteraction }) => {
  // Use Zustand store for drawing state
  const { drawingState, finalizeLasso } = useOverlayStore();
  const { isDrawing, dragStart, dragEnd } = drawingState;

  // Local state for lasso tool
  const [lassoPoints, setLassoPoints] = React.useState<[number, number][]>([]);
  const [isLassoDrawing, setIsLassoDrawing] = React.useState(false);

  // Clear lasso state when tool changes
  React.useEffect(() => {
    setLassoPoints([]);
    setIsLassoDrawing(false);
  }, [activeTool]);

  // Note: Interaction handling is now managed by the Zustand store
  // The store automatically updates drawingState based on currentInteraction

  // Handle lasso tool interactions
  React.useEffect(() => {
    if (currentInteraction && activeTool === 'lasso') {
      const { type, coordinate } = currentInteraction;
      const [x, y] = coordinate;

      console.log('DrawingOverlay: Received lasso interaction:', type, 'at coordinate:', [x, y]);

      switch (type) {
        case 'click':
          // Add point to lasso
          if (!isLassoDrawing) {
            setIsLassoDrawing(true);
          }
          setLassoPoints(prev => [...prev, [x, y] as [number, number]]);
          console.log('DrawingOverlay: Added lasso point:', [x, y]);
          break;
        case 'dragStart':
          // Start lasso drawing
          if (!isLassoDrawing) {
            setIsLassoDrawing(true);
            setLassoPoints([[x, y] as [number, number]]);
          }
          break;
        case 'drag':
          // Update lasso with drag points for smooth drawing
          if (isLassoDrawing) {
            setLassoPoints(prev => [...prev, [x, y] as [number, number]]);
          }
          break;
        case 'dragEnd':
          // Finish lasso drawing
          if (isLassoDrawing) {
            // Keep the final point
            const finalPoints: [number, number][] = [...lassoPoints, [x, y] as [number, number]];
            setLassoPoints(finalPoints);
            console.log('DrawingOverlay: Finished lasso with points:', finalPoints);
            
            // Finalize the lasso as an annotation
            if (finalPoints.length >= 3) {
              finalizeLasso(finalPoints);
              setIsLassoDrawing(false);
              setLassoPoints([]);
            }
          }
          break;
      }
    }
  }, [currentInteraction, activeTool, isLassoDrawing, lassoPoints, finalizeLasso]);

  // Create green rectangle overlay layer based on drawing state
  const greenRectangleLayer = React.useMemo(() => {
    if (activeTool !== 'rectangle') {
      return null;
    }

    console.log('DrawingOverlay: Creating green rectangle layer with state:', {
      isDrawing,
      dragStart,
      dragEnd
    });

    // Only show rectangle when actively drawing or when drawing is complete
    if (isDrawing && dragStart && dragEnd) {
      const [startX, startY] = dragStart;
      const [endX, endY] = dragEnd;

      // Ensure proper rectangle coordinates (start can be anywhere relative to end)
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      console.log('DrawingOverlay: Creating dynamic rectangle from', [minX, minY], 'to', [maxX, maxY]);

      return new PolygonLayer({
        id: 'green-rectangle',
        data: [{
          polygon: [
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY], // Close the polygon
          ]
        }],
        getPolygon: d => d.polygon,
        getFillColor: [0, 255, 0, 50], // Green with low opacity
        getLineColor: [0, 255, 0, 255], // Solid green border
        getLineWidth: 3,
        stroked: true,
        filled: true,
      });
    }

    // No default rectangle - only show when drawing
    console.log('DrawingOverlay: No rectangle to show - waiting for user interaction');
    return null;
  }, [activeTool, isDrawing, dragStart, dragEnd]);

  // Create lasso polygon overlay layer
  const lassoLayer = React.useMemo(() => {
    if (activeTool !== 'lasso') {
      return null;
    }

    console.log('DrawingOverlay: Creating lasso layer with points:', lassoPoints);

    // Only show lasso when actively drawing or when drawing is complete
    if (isLassoDrawing && lassoPoints.length >= 3) {
      // Close the polygon by adding the first point at the end
      const closedPoints = [...lassoPoints, lassoPoints[0]];

      return new PolygonLayer({
        id: 'green-lasso',
        data: [{
          polygon: closedPoints
        }],
        getPolygon: d => d.polygon,
        getFillColor: [255, 165, 0, 50], // Orange with low opacity
        getLineColor: [255, 165, 0, 255], // Solid orange border
        getLineWidth: getLineWidthPx(),
        lineWidthScale: 1,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: getLineWidthPx(),
        lineWidthMaxPixels: getLineWidthPx(),
        stroked: true,
        filled: true,
      });
    }

    // No lasso to show - waiting for user interaction
    console.log('DrawingOverlay: No lasso to show - waiting for user interaction');
    return null;
  }, [activeTool, isLassoDrawing, lassoPoints]);

  // Create green line overlay layer based on drawing state
  const greenLineLayer = React.useMemo(() => {
    if (activeTool !== 'line') {
      return null;
    }

    console.log('DrawingOverlay: Creating green line layer with state:', {
      isDrawing,
      dragStart,
      dragEnd
    });

    // Only show line when actively drawing or when drawing is complete
    if (isDrawing && dragStart && dragEnd) {
      const [startX, startY] = dragStart;
      const [endX, endY] = dragEnd;

      console.log('DrawingOverlay: Creating dynamic line from', [startX, startY], 'to', [endX, endY]);

      return new LineLayer({
        id: 'green-line',
        data: [{
          sourcePosition: [startX, startY],
          targetPosition: [endX, endY],
        }],
        getSourcePosition: d => d.sourcePosition,
        getTargetPosition: d => d.targetPosition,
        getColor: [0, 255, 255, 255], // Cyan line
        getWidth: getLineWidthPx(),
        lineWidthScale: 1,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: getLineWidthPx(),
        lineWidthMaxPixels: getLineWidthPx(),
      });
    }

    // No default line - only show when drawing
    console.log('DrawingOverlay: No line to show - waiting for user interaction');
    return null;
  }, [activeTool, isDrawing, dragStart, dragEnd]);

  // Get annotations from store with proper reactivity
  const annotations = useOverlayStore(state => state.annotations);

  // Get hidden layers from store
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);

  // Create persistent annotation layers from stored annotations (excluding hidden ones)
  const annotationLayers = React.useMemo(() => {
    return annotations
      .filter(annotation => !hiddenLayers.has(annotation.id)) // Filter out hidden annotations
      .map(annotation => {
        if (annotation.type === 'rectangle') {
          const { start, end } = annotation.coordinates;
          const [startX, startY] = start;
          const [endX, endY] = end;

          // Ensure proper rectangle coordinates
          const minX = Math.min(startX, endX);
          const maxX = Math.max(startX, endX);
          const minY = Math.min(startY, endY);
          const maxY = Math.max(startY, endY);

          return new PolygonLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              polygon: [
                [minX, minY],
                [maxX, minY],
                [maxX, maxY],
                [minX, maxY],
                [minX, minY], // Close the polygon
              ]
            }],
            getPolygon: d => d.polygon,
            getFillColor: [0, 0, 0, 0], // Transparent fill
            getLineColor: [255, 255, 255, 255], // White stroke
            getLineWidth: annotation.style.lineWidth,
            lineWidthScale: 1,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: annotation.style.lineWidth,
            lineWidthMaxPixels: annotation.style.lineWidth,
            stroked: true,
            filled: true,
          });
        } else if (annotation.type === 'polygon') {
          // Close the polygon by adding the first point at the end
          const closedPoints = [...annotation.coordinates, annotation.coordinates[0]];

          return new PolygonLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              polygon: closedPoints
            }],
            getPolygon: d => d.polygon,
            getFillColor: [0, 0, 0, 0], // Transparent fill
            getLineColor: [255, 255, 255, 255], // White stroke
            getLineWidth: annotation.style.lineWidth,
            lineWidthScale: 1,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: annotation.style.lineWidth,
            lineWidthMaxPixels: annotation.style.lineWidth,
            stroked: true,
            filled: true,
          });
        } else if (annotation.type === 'line') {
          const { start, end } = annotation.coordinates;

          return new LineLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              sourcePosition: start,
              targetPosition: end,
            }],
            getSourcePosition: d => d.sourcePosition,
            getTargetPosition: d => d.targetPosition,
            getColor: [255, 255, 255, 255], // White line
            getWidth: annotation.style.lineWidth,
            lineWidthScale: 1,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: annotation.style.lineWidth,
            lineWidthMaxPixels: annotation.style.lineWidth,
          });
        }
        return null;
      }).filter(Boolean);
  }, [annotations, hiddenLayers]);

  // Notify parent when drawing layer is created or removed
  React.useEffect(() => {
    let layerToCreate = null;

    if (activeTool === 'rectangle' && greenRectangleLayer) {
      layerToCreate = greenRectangleLayer;
      console.log('DrawingOverlay: Notifying parent of green rectangle layer');
    } else if (activeTool === 'lasso' && lassoLayer) {
      layerToCreate = lassoLayer;
      console.log('DrawingOverlay: Notifying parent of lasso layer');
    } else if (activeTool === 'line' && greenLineLayer) {
      layerToCreate = greenLineLayer;
      console.log('DrawingOverlay: Notifying parent of green line layer');
    }

    if (layerToCreate) {
      onLayerCreate(layerToCreate);
    } else {
      // When no tool is active or no layer to show, notify parent to remove layers
      console.log('DrawingOverlay: Notifying parent to remove drawing layers');
      onLayerCreate(null);
    }
  }, [greenRectangleLayer, lassoLayer, greenLineLayer, activeTool, onLayerCreate]);

  // Handle annotation layers - they are now managed through the overlay layers system
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

  return null; // This component doesn't render anything visible
};

export { DrawingOverlay };
export type { DrawingOverlayProps };
