import * as React from "react";
import { PolygonLayer } from '@deck.gl/layers';

interface DrawingOverlayProps {
  onLayerCreate: (layer: PolygonLayer) => void;
  activeTool: string;
  onInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number]) => void;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number] } | null;
}

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ onLayerCreate, activeTool, currentInteraction }) => {
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<[number, number] | null>(null);
  const [dragEnd, setDragEnd] = React.useState<[number, number] | null>(null);

  // Handle interaction events from parent
  React.useEffect(() => {
    if (currentInteraction && activeTool === 'rectangle') {
      const { type, coordinate } = currentInteraction;
      const [x, y] = coordinate;
      
      console.log('DrawingOverlay: Received interaction:', type, 'at coordinate:', [x, y]);
      
      switch (type) {
        case 'click':
          // Start drawing
          setIsDrawing(true);
          setDragStart([x, y]);
          setDragEnd([x, y]);
          break;
        case 'dragStart':
          // Start drawing
          setIsDrawing(true);
          setDragStart([x, y]);
          setDragEnd([x, y]);
          break;
        case 'drag':
          // Update drawing
          if (isDrawing) {
            setDragEnd([x, y]);
            console.log('DrawingOverlay: Updated drag end to:', [x, y]);
          }
          break;
        case 'dragEnd':
          // Finish drawing but keep the final position
          if (isDrawing) {
            setDragEnd([x, y]);
            // Don't reset isDrawing - keep the rectangle visible at final position
            console.log('DrawingOverlay: Finished drawing rectangle from', dragStart, 'to', [x, y]);
          }
          break;
      }
    }
  }, [currentInteraction, activeTool, isDrawing, dragStart]);

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

  // Notify parent when layer is created or removed
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

  return null; // This component doesn't render anything visible
};

export { DrawingOverlay };
export type { DrawingOverlayProps };
