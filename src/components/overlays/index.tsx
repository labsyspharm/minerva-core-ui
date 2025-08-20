import * as React from "react";
import { DrawingOverlay } from "./DrawingOverlay";
import styles from "./index.module.css";
import { MoveIcon, RectangleIcon } from "./icons";

// Types
import type { Group } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type Props = HashContext & {
  groups: Group[];
  onLayerCreate?: (layer: any) => void;
  activeTool: string;
  onToolChange: (tool: string) => void;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number] } | null;
};

// Define available tools
const TOOLS = {
  MOVE: 'move',
  RECTANGLE: 'rectangle'
} as const;

type ToolType = typeof TOOLS[keyof typeof TOOLS];

const Overlays = (props: Props) => {
  const { hash, onLayerCreate, activeTool, onToolChange, currentInteraction } = props;
  const group = props.groups[hash.g];

  const handleToolChange = (tool: ToolType) => {
    onToolChange(tool);
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
          onClick={() => handleToolChange(TOOLS.MOVE)}
        >
          <MoveIcon />
        </button>
        
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.RECTANGLE ? styles.active : ''}`}
          title="Rectangle Tool (R)"
          onClick={() => handleToolChange(TOOLS.RECTANGLE)}
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
