import * as React from "react";
import { PolygonLayer } from '@deck.gl/layers';
import { useOverlayStore } from "../../lib/stores";

interface DrawingOverlayProps {
  onLayerCreate: (layer: PolygonLayer) => void;
  activeTool: string;
  onInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number]) => void;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number] } | null;
}

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ onLayerCreate, activeTool, currentInteraction }) => {
  // Use Zustand store for drawing state
  const { drawingState } = useOverlayStore();
  const { isDrawing, dragStart, dragEnd } = drawingState;

  // Note: Interaction handling is now managed by the Zustand store
  // The store automatically updates drawingState based on currentInteraction

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
            getFillColor: [0, 0, 0, 0],
            getLineColor: [255, 255, 255, 255],
            getLineWidth: 50,
            stroked: true,
            filled: true,
          });
        }
        return null;
      }).filter(Boolean);
  }, [annotations, hiddenLayers]);

  // Notify parent when drawing layer is created or removed
  React.useEffect(() => {
    if (greenRectangleLayer) {
      console.log('DrawingOverlay: Notifying parent of green rectangle layer');
      onLayerCreate(greenRectangleLayer);
    } else {
      // When tool is not rectangle, notify parent to remove the layer
      console.log('DrawingOverlay: Notifying parent to remove green rectangle layer');
      onLayerCreate(null);
    }
  }, [greenRectangleLayer, onLayerCreate]);

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
