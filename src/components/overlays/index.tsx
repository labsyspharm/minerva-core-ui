import * as React from "react";
import { DrawingOverlay } from "./DrawingOverlay";
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
      {/* Toolbar with drawing tools */}
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
      
      <div>Active Tool: {activeTool}</div>
      <div>Active Group: {group?.name || "None"}</div>
      
      {/* Simple instruction */}
      {activeTool === 'rectangle' && (
        <div style={{ 
          color: 'orange', 
          textAlign: 'center',
          padding: '8px',
          backgroundColor: 'rgba(255, 165, 0, 0.1)',
          borderRadius: '4px',
          margin: '8px 0',
          fontSize: '14px'
        }}>
          Rectangle tool selected - green overlay visible
        </div>
      )}
      
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
