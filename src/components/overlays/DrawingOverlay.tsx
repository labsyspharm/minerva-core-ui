import * as React from "react";
import { PolygonLayer } from '@deck.gl/layers';

interface DrawingOverlayProps {
  onLayerCreate: (layer: PolygonLayer) => void;
  activeTool: string;
}

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ onLayerCreate, activeTool }) => {
  // Create green rectangle overlay layer only when rectangle tool is active
  const greenRectangleLayer = React.useMemo(() => {
    if (activeTool !== 'rectangle') {
      return null;
    }

    console.log('DrawingOverlay: Creating green rectangle layer');

    return new PolygonLayer({
      id: 'green-rectangle',
      data: [{
        polygon: [
          [0, 0],
          [5000, 0],
          [5000, 5000],
          [0, 5000],
          [0, 0], // Close the polygon
        ]
      }],
      getPolygon: d => d.polygon,
      getFillColor: [0, 255, 0, 50], // Green with low opacity
      getLineColor: [0, 255, 0, 255], // Solid green border
      getLineWidth: 3,
      stroked: true,
      filled: true,
    });
  }, [activeTool]);

  // Notify parent when layer is created or removed
  React.useEffect(() => {
    if (greenRectangleLayer) {
      // console.log('DrawingOverlay: Notifying parent of green rectangle layer');
      onLayerCreate(greenRectangleLayer);
    } else {
      // When tool is not rectangle, notify parent to remove the layer
      // console.log('DrawingOverlay: Notifying parent to remove green rectangle layer');
      onLayerCreate(null);
    }
  }, [greenRectangleLayer, onLayerCreate]);

  return null; // This component doesn't render anything visible
};

export { DrawingOverlay };
export type { DrawingOverlayProps };
