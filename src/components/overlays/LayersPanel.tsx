import * as React from "react";
import { useOverlayStore } from "../../lib/stores";
import type { Annotation, TextAnnotation } from "../../lib/stores";
import styles from "./index.module.css";

// Shared Text Edit Panel Component (same as in DrawingOverlay)
interface TextEditPanelProps {
  title: string;
  textValue: string;
  fontSize: number;
  onTextChange: (text: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitButtonText: string;
}

const TextEditPanel: React.FC<TextEditPanelProps> = ({
  title,
  textValue,
  fontSize,
  onTextChange,
  onFontSizeChange,
  onSubmit,
  onCancel,
  submitButtonText
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#2c2c2c',
        border: '2px solid #444',
        borderRadius: '8px',
        padding: '20px',
        zIndex: 1000,
        minWidth: '300px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div style={{ marginBottom: '15px', color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
        {title}
      </div>
      
      {/* Font Size Input */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ color: 'white', fontSize: '14px', marginBottom: '5px', display: 'block' }}>
          Font Size:
        </label>
        <input
          type="number"
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 14)}
          min="8"
          max="72"
          style={{
            width: '80px',
            padding: '5px',
            border: '1px solid #555',
            borderRadius: '4px',
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>
      
      {/* Text Input */}
      <textarea
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Enter your text here..."
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '10px',
          border: '1px solid #555',
          borderRadius: '4px',
          backgroundColor: '#1a1a1a',
          color: 'white',
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          resize: 'vertical',
          outline: 'none',
        }}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            onSubmit();
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      
      <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: '#555',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!textValue.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: textValue.trim() ? '#4CAF50' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: textValue.trim() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
          }}
        >
          {submitButtonText}
        </button>
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
        Press Ctrl+Enter to submit, Escape to cancel
      </div>
    </div>
  );
};

interface LayersPanelProps {
  className?: string;
  onOpenAnnotationColorPicker?: (annotationId: string, currentColor: [number, number, number, number]) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ className, onOpenAnnotationColorPicker }) => {
  // Subscribe to annotations and hidden layers from store
  const annotations = useOverlayStore(state => state.annotations);
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);
  const removeAnnotation = useOverlayStore(state => state.removeAnnotation);
  const updateAnnotation = useOverlayStore(state => state.updateAnnotation);
  const updateTextAnnotation = useOverlayStore(state => state.updateTextAnnotation);
  const updateTextAnnotationColor = useOverlayStore(state => state.updateTextAnnotationColor);
  const clearAnnotations = useOverlayStore(state => state.clearAnnotations);
  const toggleLayerVisibility = useOverlayStore(state => state.toggleLayerVisibility);
  
  // Local state for text editing
  const [editingTextId, setEditingTextId] = React.useState<string | null>(null);
  const [editTextValue, setEditTextValue] = React.useState('');
  const [editFontSize, setEditFontSize] = React.useState(14);
  
  
  // Note: All annotations are shown in the list, but hidden ones are dimmed
  
  const handleDeleteLayer = (annotationId: string) => {
    removeAnnotation(annotationId);
    // Hidden state is automatically cleaned up when annotation is removed
  };

  const handleEditText = (annotationId: string, currentText: string, currentFontSize: number) => {
    setEditingTextId(annotationId);
    setEditTextValue(currentText);
    setEditFontSize(currentFontSize);
  };

  const handleSaveTextEdit = () => {
    if (editingTextId && editTextValue.trim()) {
      updateTextAnnotation(editingTextId, editTextValue.trim(), editFontSize);
    }
    setEditingTextId(null);
    setEditTextValue('');
    setEditFontSize(14);
  };

  const handleCancelTextEdit = () => {
    setEditingTextId(null);
    setEditTextValue('');
    setEditFontSize(14);
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
      case 'polyline':
        return '∠';
      case 'text':
        return 'T';
      case 'point':
        return '●';
      default:
        return '●';
    }
  };
  
  const getLayerName = (annotation: Annotation) => {
    if (annotation.metadata?.label) {
      return annotation.metadata.label;
    }
    
    // Generate default names based on type
    switch (annotation.type) {
      case 'rectangle':
        return 'Rectangle';
      case 'polygon':
        return 'Polygon';
      case 'line':
        return 'Line';
      case 'polyline':
        return 'Polyline';
      case 'point':
        return 'Point';
      case 'text':
        return annotation.text.length > 20 ? `${annotation.text.substring(0, 20)}...` : annotation.text;
      default:
        return 'Annotation';
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
                    {getLayerName(annotation)}
                  </div>
                  <div style={{ color: '#999', fontSize: '10px' }}>
                    {annotation.metadata?.createdAt && formatDate(annotation.metadata.createdAt)}
                    {annotation.type === 'text' && (
                      <span style={{ marginLeft: '8px' }}>
                        Size: {(annotation as TextAnnotation).style.fontSize}px
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Edit button for text annotations */}
                {annotation.type === 'text' && (
                  <button
                    style={{
                      ...deleteButtonStyle,
                      color: '#4CAF50',
                      backgroundColor: 'transparent',
                      marginRight: '4px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (annotation.type === 'text') {
                        handleEditText(annotation.id, annotation.text, annotation.style.fontSize);
                      }
                    }}
                    title="Edit text"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                )}
                
                {/* Color picker button for all annotations */}
                <button
                  style={{
                    ...deleteButtonStyle,
                    color: '#4CAF50',
                    backgroundColor: 'transparent',
                    marginRight: '4px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenAnnotationColorPicker) {
                      let currentAnnotationColor: [number, number, number, number];
                      
                      if (annotation.type === 'text') {
                        currentAnnotationColor = annotation.style.fontColor;
                      } else if (annotation.type === 'rectangle' || annotation.type === 'polygon' || annotation.type === 'line' || annotation.type === 'polyline') {
                        currentAnnotationColor = annotation.style.lineColor;
                      } else if (annotation.type === 'point') {
                        currentAnnotationColor = annotation.style.fillColor;
                      } else {
                        currentAnnotationColor = [255, 255, 255, 255]; // Default white
                      }
                      
                      onOpenAnnotationColorPicker(annotation.id, currentAnnotationColor);
                    }
                  }}
                  title="Change annotation color"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                  </svg>
                </button>
                
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
      
      {/* Text Edit Modal */}
      {editingTextId && (
        <TextEditPanel
          title="Edit Text Annotation"
          textValue={editTextValue}
          fontSize={editFontSize}
          onTextChange={setEditTextValue}
          onFontSizeChange={setEditFontSize}
          onSubmit={handleSaveTextEdit}
          onCancel={handleCancelTextEdit}
          submitButtonText="Save Changes"
        />
      )}
      
    </div>
  );
};

export { LayersPanel };
export type { LayersPanelProps };
