import * as React from "react";
import { useOverlayStore } from "src/lib/stores";
import type { Annotation, TextAnnotation } from "src/lib/stores";
import { ItemList, type ListItem } from "src/components/shared/components/common/ItemList";
import { RectangleIcon, EllipseIcon, PolylineIcon, PolygonIcon, LineIcon, GroupIcon, PointIcon, TextIcon } from "src/components/viewer/layers/overlays/icons";
import styles from "src/components/viewer/layers/overlays/index.module.css";

// Shared Text Edit Panel Component (same as in original LayersPanel)
interface TextEditPanelProps {
  title: string;
  textValue: string;
  fontSize: number;
  onTextChange: (text: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitButtonText: string;
  allowEmpty?: boolean; // Allow empty text (for removing labels from shapes)
}

const TextEditPanel: React.FC<TextEditPanelProps> = ({
  title,
  textValue,
  fontSize,
  onTextChange,
  onFontSizeChange,
  onSubmit,
  onCancel,
  submitButtonText,
  allowEmpty = false
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
      
      <div style={{ 
        marginTop: '15px', 
        display: 'flex', 
        gap: '10px', 
        justifyContent: 'flex-end' 
      }}>
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
          disabled={!allowEmpty && !textValue?.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: allowEmpty || textValue?.trim() ? '#4CAF50' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: allowEmpty || textValue?.trim() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
          }}
        >
          {submitButtonText}
        </button>
      </div>
    </div>
  );
};

interface LayersPanelProps {
  className?: string;
  onOpenAnnotationColorPicker?: (annotationId: string, currentColor: [number, number, number, number]) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ 
  className, 
  onOpenAnnotationColorPicker 
}) => {
  // Subscribe to annotations and hidden layers from store
  const annotations = useOverlayStore(state => state.annotations);
  const annotationGroups = useOverlayStore(state => state.annotationGroups);
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);
  const removeAnnotation = useOverlayStore(state => state.removeAnnotation);
  const updateAnnotation = useOverlayStore(state => state.updateAnnotation);
  const updateTextAnnotationColor = useOverlayStore(state => state.updateTextAnnotationColor);
  const updateShapeText = useOverlayStore(state => state.updateShapeText);
  const clearAnnotations = useOverlayStore(state => state.clearAnnotations);
  const toggleLayerVisibility = useOverlayStore(state => state.toggleLayerVisibility);
  const createGroup = useOverlayStore(state => state.createGroup);
  const deleteGroup = useOverlayStore(state => state.deleteGroup);
  const toggleGroupExpanded = useOverlayStore(state => state.toggleGroupExpanded);
  const addAnnotationToGroup = useOverlayStore(state => state.addAnnotationToGroup);

  // Local state for text editing
  const [editingTextId, setEditingTextId] = React.useState<string | null>(null);
  const [editTextValue, setEditTextValue] = React.useState('');
  const [editFontSize, setEditFontSize] = React.useState(14);
  const [editingIsShape, setEditingIsShape] = React.useState(false); // Track if editing a shape (vs pure text annotation)
  
  // Local state for drag and drop
  const [draggedAnnotationId, setDraggedAnnotationId] = React.useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = React.useState<string | null>(null);;

  const getLayerIcon = (annotation: Annotation) => {
    switch (annotation.type) {
      case 'rectangle':
        return <RectangleIcon style={{ width: '16px', height: '16px' }} />;
      case 'ellipse':
        return <EllipseIcon style={{ width: '16px', height: '16px' }} />;
      case 'polygon':
        return <PolygonIcon style={{ width: '16px', height: '16px' }} />;
      case 'line':
        return <LineIcon style={{ width: '16px', height: '16px' }} />;
      case 'polyline':
        return <PolylineIcon style={{ width: '16px', height: '16px' }} />;
      case 'point':
        return <PointIcon style={{ width: '16px', height: '16px' }} />;
      case 'text':
        return <TextIcon style={{ width: '16px', height: '16px' }} />;
      default:
        return <PointIcon style={{ width: '16px', height: '16px' }} />;
    }
  };

  const getLayerName = (annotation: Annotation) => {
    // Extract just the shape ID (last part after the last dash)
    const shapeId = annotation.id.split('-').pop() || annotation.id;
    
    switch (annotation.type) {
      case 'rectangle':
        return annotation.text ? `${shapeId}: ${annotation.text}` : shapeId;
      case 'ellipse':
        return annotation.text ? `${shapeId}: ${annotation.text}` : shapeId;
      case 'polygon':
        return annotation.text ? `${shapeId}: ${annotation.text}` : shapeId;
      case 'line':
        return annotation.text ? `${shapeId}: ${annotation.text}` : shapeId;
      case 'polyline':
        return annotation.text ? `${shapeId}: ${annotation.text}` : shapeId;
      case 'point':
        return annotation.text ? `${shapeId}: ${annotation.text}` : shapeId;
      case 'text':
        return annotation.text && annotation.text.length > 20 ? `${shapeId}: ${annotation.text.substring(0, 20)}...` : annotation.text ? `${shapeId}: ${annotation.text}` : shapeId;
      default:
        return shapeId;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Text editing functions
  const handleEditText = (annotation: Annotation) => {
    let currentText = '';
    let currentFontSize = 14;
    
    if (annotation.type === 'text') {
      currentText = annotation.text;
      currentFontSize = annotation.style.fontSize;
      setEditingIsShape(false);
    } else {
      currentText = annotation.text || '';
      currentFontSize = 14; // Default for shapes
      setEditingIsShape(true);
    }
    
    setEditTextValue(currentText);
    setEditFontSize(currentFontSize);
    setEditingTextId(annotation.id);
  };

  const handleSubmitTextEdit = () => {
    if (editingTextId) {
      // Use updateShapeText which works for both text annotations and shapes with text
      updateShapeText(editingTextId, editTextValue?.trim() || '');
    }
    setEditingTextId(null);
    setEditTextValue('');
    setEditFontSize(14);
    setEditingIsShape(false);
  };

  const handleCancelTextEdit = () => {
    setEditingTextId(null);
    setEditTextValue('');
    setEditFontSize(14);
    setEditingIsShape(false);
  };

  // Convert groups to ListItem format
  const groupItems: ListItem[] = annotationGroups.map((group) => {
    const groupAnnotations = annotations.filter(a => group.annotationIds.includes(a.id));
    
    const children: ListItem[] = groupAnnotations.map((annotation) => ({
      id: annotation.id,
      title: getLayerName(annotation),
      subtitle: formatDate(annotation.metadata?.createdAt || new Date()),
      isHidden: hiddenLayers.has(annotation.id),
      icon: getLayerIcon(annotation),
      isExpanded: group.isExpanded,
      metadata: { annotation, type: 'annotation' }
    }));

    return {
      id: group.id,
      title: group.name,
      subtitle: `${groupAnnotations.length} annotations`,
      isExpanded: group.isExpanded,
      children,
      metadata: { group, type: 'group' }
    };
  });

  // Convert ungrouped annotations to ListItem format
  const ungroupedAnnotations = annotations.filter(annotation => {
    return !annotationGroups.some(group => group.annotationIds.includes(annotation.id));
  });

  const annotationItems: ListItem[] = ungroupedAnnotations.map((annotation) => ({
    id: annotation.id,
    title: getLayerName(annotation),
    subtitle: formatDate(annotation.metadata?.createdAt || new Date()),
    isHidden: hiddenLayers.has(annotation.id),
    icon: getLayerIcon(annotation),
    metadata: { annotation, type: 'annotation' }
  }));

  // Combine groups and ungrouped annotations
  const allItems = [...groupItems, ...annotationItems];

  const handleItemClick = (item: ListItem) => {
    if (item.metadata?.type === 'group') {
      toggleGroupExpanded(item.id);
    }
    // For annotations, we could add selection logic here if needed
  };

  const handleToggleVisibility = (itemId: string) => {
    // Find if it's a group or annotation
    const group = annotationGroups.find(g => g.id === itemId);
    if (group) {
      // Toggle visibility for all annotations in the group
      group.annotationIds.forEach(annotationId => {
        toggleLayerVisibility(annotationId);
      });
    } else {
      // Toggle visibility for individual annotation
      toggleLayerVisibility(itemId);
    }
  };

  const handleDelete = (itemId: string) => {
    // Find if it's a group or annotation
    const group = annotationGroups.find(g => g.id === itemId);
    if (group) {
      deleteGroup(itemId);
    } else {
      removeAnnotation(itemId);
    }
  };

  const handleToggleExpand = (itemId: string) => {
    toggleGroupExpanded(itemId);
  };

  const handleDragStart = (itemId: string, event: React.DragEvent) => {
    setDraggedAnnotationId(itemId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (itemId: string, event: React.DragEvent) => {
    setDraggedAnnotationId(null);
    setDropTargetGroupId(null);
  };

  const handleDragOver = (itemId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetGroupId(itemId);
  };

  const handleDragLeave = (itemId: string, event: React.DragEvent) => {
    setDropTargetGroupId(null);
  };

  const handleDrop = (targetId: string, draggedId: string) => {
    // Handle drag and drop between groups
    if (draggedAnnotationId && draggedAnnotationId !== targetId) {
      // Find if target is a group
      const targetGroup = annotationGroups.find(g => g.id === targetId);
      if (targetGroup) {
        // Add annotation to group
        addAnnotationToGroup(targetId, draggedAnnotationId);
      }
    }
    setDraggedAnnotationId(null);
    setDropTargetGroupId(null);
  };

  const itemActions = (item: ListItem) => {
    if (item.metadata?.type === 'annotation') {
      const annotation = item.metadata.annotation as Annotation;
      
      return (
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Text Edit Button */}
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#ccc',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditText(annotation);
            }}
            title="Edit text"
          >
            <TextIcon style={{ width: '14px', height: '14px' }} />
          </button>
          
          {/* Color Picker Button */}
          {onOpenAnnotationColorPicker && (
            <button
              style={{
                background: 'none',
                border: 'none',
                color: '#ccc',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onClick={(e) => {
                e.stopPropagation();
                let currentAnnotationColor: [number, number, number, number];
                
                if (annotation.type === 'text') {
                  currentAnnotationColor = annotation.style.fontColor;
                } else if (annotation.type === 'rectangle' || annotation.type === 'ellipse' || annotation.type === 'polygon' || annotation.type === 'line' || annotation.type === 'polyline') {
                  currentAnnotationColor = annotation.style.lineColor;
                } else if (annotation.type === 'point') {
                  currentAnnotationColor = annotation.style.fillColor;
                } else {
                  currentAnnotationColor = [255, 255, 255, 255]; // Default white
                }
                
                onOpenAnnotationColorPicker(annotation.id, currentAnnotationColor);
              }}
              title="Change annotation color"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </button>
          )}
        </div>
      );
    }
    return null;
  };

  const headerActions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        style={{
          background: '#4CAF50',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '6px 12px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
        }}
        onClick={() => createGroup()}
        title="Create group"
      >
        <GroupIcon style={{ width: '12px', height: '12px' }} />
        Group
      </button>
      {annotations.length > 0 && (
        <button
          style={{
            background: '#f44336',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
          onClick={() => clearAnnotations()}
          title="Clear all layers"
        >
          Clear All
        </button>
      )}
    </div>
  );

  return (
    <div className={styles.layersPanel}>
      <ItemList
        className={className}
        items={allItems}
        title="Layers"
        emptyMessage="No layers yet"
        onItemClick={handleItemClick}
        onToggleVisibility={handleToggleVisibility}
        onDelete={handleDelete}
        onToggleExpand={handleToggleExpand}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        showVisibilityToggle={true}
        showDeleteButton={true}
        showExpandToggle={true}
        headerActions={headerActions}
        itemActions={itemActions}
      />
      
      {/* Text Edit Modal */}
      {editingTextId && (
        <TextEditPanel
          title={editingIsShape ? "Edit Shape Label" : "Edit Text Annotation"}
          textValue={editTextValue}
          fontSize={editFontSize}
          onTextChange={setEditTextValue}
          onFontSizeChange={setEditFontSize}
          onSubmit={handleSubmitTextEdit}
          onCancel={handleCancelTextEdit}
          submitButtonText={editingIsShape ? "Update Label" : "Update Text"}
          allowEmpty={editingIsShape} // Allow empty text for shapes (to remove labels)
        />
      )}
    </div>
  );
};

export { LayersPanel };
export type { LayersPanelProps };
