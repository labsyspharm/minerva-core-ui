import * as React from "react";
import { useOverlayStore } from "../../lib/stores";
import type { Annotation } from "../../lib/stores";
import styles from "./index.module.css";

interface LayersPanelProps {
  className?: string;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ className }) => {
  // Subscribe to annotations from store
  const annotations = useOverlayStore(state => state.annotations);
  const removeAnnotation = useOverlayStore(state => state.removeAnnotation);
  const updateAnnotation = useOverlayStore(state => state.updateAnnotation);
  const clearAnnotations = useOverlayStore(state => state.clearAnnotations);
  
  // Local state for managing layer visibility (could be moved to store later)
  const [hiddenLayers, setHiddenLayers] = React.useState<Set<string>>(new Set());
  
  const toggleLayerVisibility = (annotationId: string) => {
    setHiddenLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(annotationId)) {
        newSet.delete(annotationId);
      } else {
        newSet.add(annotationId);
      }
      return newSet;
    });
  };
  
  const handleDeleteLayer = (annotationId: string) => {
    removeAnnotation(annotationId);
    // Also remove from hidden set if it was hidden
    setHiddenLayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(annotationId);
      return newSet;
    });
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const getLayerIcon = (annotation: Annotation) => {
    switch (annotation.type) {
      case 'rectangle':
        return '▭';
      default:
        return '●';
    }
  };
  
  const panelStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#2c2c2c',
    color: 'white',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '200px',
    maxHeight: '400px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };
  
  const headerStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#3c3c3c',
    borderBottom: '1px solid #444',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold',
  };
  
  const layersListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    minHeight: '0',
  };
  
  const layerItemStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #444',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };
  
  const layerItemHoverStyle: React.CSSProperties = {
    ...layerItemStyle,
    backgroundColor: '#404040',
  };
  
  const eyeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px',
    minWidth: '20px',
    textAlign: 'center',
  };
  
  const deleteButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px',
    marginLeft: 'auto',
  };
  
  const clearButtonStyle: React.CSSProperties = {
    background: '#ff6b6b',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '4px 8px',
    borderRadius: '3px',
  };
  
  return (
    <div className={`${className} ${styles.layersPanel}`} style={panelStyle}>
      <div style={headerStyle}>
        <span>Layers ({annotations.length})</span>
        {annotations.length > 0 && (
          <button
            style={clearButtonStyle}
            onClick={() => clearAnnotations()}
            title="Clear all layers"
          >
            Clear All
          </button>
        )}
      </div>
      
      <div style={layersListStyle}>
        {annotations.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
            No layers yet
          </div>
        ) : (
          annotations.map((annotation, index) => {
            const isHidden = hiddenLayers.has(annotation.id);
            return (
              <div
                key={annotation.id}
                style={layerItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#404040';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <button
                  style={eyeButtonStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisibility(annotation.id);
                  }}
                  title={isHidden ? 'Show layer' : 'Hide layer'}
                >
                  {isHidden ? '🙈' : '👁'}
                </button>
                
                <span style={{ fontSize: '16px' }}>
                  {getLayerIcon(annotation)}
                </span>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    {annotation.metadata?.label || `${annotation.type} ${index + 1}`}
                  </div>
                  <div style={{ color: '#999', fontSize: '10px' }}>
                    {annotation.metadata?.createdAt && formatDate(annotation.metadata.createdAt)}
                  </div>
                </div>
                
                <button
                  style={deleteButtonStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLayer(annotation.id);
                  }}
                  title="Delete layer"
                >
                  🗑
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export { LayersPanel };
export type { LayersPanelProps };
