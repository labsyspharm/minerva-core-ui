import * as React from "react";
import { useOverlayStore } from "../../lib/stores";
import type { Annotation } from "../../lib/stores";
import styles from "./index.module.css";

interface LayersPanelProps {
  className?: string;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ className }) => {
  // Subscribe to annotations and hidden layers from store
  const annotations = useOverlayStore(state => state.annotations);
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);
  const removeAnnotation = useOverlayStore(state => state.removeAnnotation);
  const updateAnnotation = useOverlayStore(state => state.updateAnnotation);
  const clearAnnotations = useOverlayStore(state => state.clearAnnotations);
  const toggleLayerVisibility = useOverlayStore(state => state.toggleLayerVisibility);
  
  // Note: All annotations are shown in the list, but hidden ones are dimmed
  
  const handleDeleteLayer = (annotationId: string) => {
    removeAnnotation(annotationId);
    // Hidden state is automatically cleaned up when annotation is removed
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const getLayerIcon = (annotation: Annotation) => {
    switch (annotation.type) {
      case 'rectangle':
        return '▭';
      case 'polygon':
        return '⬡';
      case 'line':
        return '—';
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
    flex: '1 1 auto',
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
    flex: '1 1 auto',
    overflowY: 'auto',
    minHeight: '0',
    maxHeight: 'none',
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
                style={{
                  ...layerItemStyle,
                  opacity: isHidden ? 0.5 : 1,
                  backgroundColor: isHidden ? '#1c1c1c' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#404040';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHidden ? '#1c1c1c' : 'transparent';
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
                  {isHidden ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.66 4.02 5.02 7 9 7 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.02c.33-1.31-.08-2.69-1.26-3.87-1.18-1.18-2.56-1.59-3.87-1.26l-.02.02z"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  )}
                </button>
                
                <span style={{ fontSize: '16px', color: '#4CAF50' }}>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
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
