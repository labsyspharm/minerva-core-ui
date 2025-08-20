import * as React from "react";
import { DrawingOverlay } from "./DrawingOverlay";
import { LayersPanel } from "./LayersPanel";
import styles from "./index.module.css";
import { MoveIcon, RectangleIcon } from "./icons";
import { useOverlayStore } from "../../lib/stores";

// Types
import type { Group } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type Props = HashContext & {
  groups: Group[];
  onLayerCreate?: (layer: any) => void;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number] } | null;
};

// Define available tools
const TOOLS = {
  MOVE: 'move',
  RECTANGLE: 'rectangle'
} as const;

type ToolType = typeof TOOLS[keyof typeof TOOLS];

const Overlays = (props: Props) => {
  const { hash, onLayerCreate, currentInteraction } = props;
  const group = props.groups[hash.g];
  
  // Use Zustand store for tool management
  const { activeTool, handleToolChange } = useOverlayStore();

  const handleToolChangeLocal = (tool: ToolType) => {
    handleToolChange(tool);
  };

  const className = [
    styles.center
  ].join(" ");
  
  return (
    <div slot="overlays" className={className}>
      {/* Toolbar with drawing tools - positioned above layers */}
      <div className={styles.toolbar}>
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.MOVE ? styles.active : ''}`}
          title="Move Tool"
          onClick={() => handleToolChangeLocal(TOOLS.MOVE)}
        >
          <MoveIcon />
        </button>
        
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.RECTANGLE ? styles.active : ''}`}
          title="Rectangle Tool (R)"
          onClick={() => handleToolChangeLocal(TOOLS.RECTANGLE)}
        >
          <RectangleIcon />
        </button>
      </div>
      
      {/* Layers Panel - Photoshop style - positioned below toolbar */}
      <LayersPanel />
      
      {/* Drawing overlay component */}
      {onLayerCreate && (
        <DrawingOverlay onLayerCreate={onLayerCreate} activeTool={activeTool} currentInteraction={currentInteraction} />
      )}
    </div>
  );
};

export { Overlays };
export type { ToolType };
export { TOOLS };
