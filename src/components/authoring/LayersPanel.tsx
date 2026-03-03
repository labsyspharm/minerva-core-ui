import * as React from "react";
import { useOverlayStore } from "@/lib/stores";
import type { Annotation } from "@/lib/stores";
import { ItemList, type ListItem } from "@/components/shared/common/ItemList";
import RectangleIcon from "@/components/shared/icons/rectangle.svg?react";
import EllipseIcon from "@/components/shared/icons/ellipse.svg?react";
import PolylineIcon from "@/components/shared/icons/polyline.svg?react";
import PolygonIcon from "@/components/shared/icons/polygon.svg?react";
import LineIcon from "@/components/shared/icons/line.svg?react";
import GroupIcon from "@/components/shared/icons/group.svg?react";
import PointIcon from "@/components/shared/icons/point.svg?react";
import TextIcon from "@/components/shared/icons/text.svg?react";
import BrushIcon from "@/components/shared/icons/brush.svg?react";
import styles from "@/components/authoring/DrawingPanel.module.css";

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
  allowEmpty = false,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "#2c2c2c",
        border: "2px solid #444",
        borderRadius: "8px",
        padding: "20px",
        zIndex: 1000,
        minWidth: "300px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div
        style={{
          marginBottom: "15px",
          color: "white",
          fontSize: "16px",
          fontWeight: "bold",
        }}
      >
        {title}
      </div>

      {/* Font Size Input */}
      <div style={{ marginBottom: "15px" }}>
        <label
          htmlFor="fontSizeInput"
          style={{
            color: "white",
            fontSize: "14px",
            marginBottom: "5px",
            display: "block",
          }}
        >
          Font Size:
        </label>
        <input
          id="fontSizeInput"
          type="number"
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value, 10) || 14)}
          min="8"
          max="72"
          style={{
            width: "80px",
            padding: "5px",
            border: "1px solid #555",
            borderRadius: "4px",
            backgroundColor: "#1a1a1a",
            color: "white",
            fontSize: "14px",
            outline: "none",
          }}
        />
      </div>

      {/* Text Input */}
      <textarea
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Enter your text here..."
        style={{
          width: "100%",
          minHeight: "80px",
          padding: "10px",
          border: "1px solid #555",
          borderRadius: "4px",
          backgroundColor: "#1a1a1a",
          color: "white",
          fontSize: "14px",
          fontFamily: "Arial, sans-serif",
          resize: "vertical",
          outline: "none",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            onSubmit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
      />

      <div
        style={{
          marginTop: "15px",
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            backgroundColor: "#555",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!allowEmpty && !textValue?.trim()}
          style={{
            padding: "8px 16px",
            backgroundColor:
              allowEmpty || textValue?.trim() ? "#4CAF50" : "#666",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: allowEmpty || textValue?.trim() ? "pointer" : "not-allowed",
            fontSize: "14px",
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
  onOpenAnnotationColorPicker?: (
    annotationId: string,
    currentColor: [number, number, number, number],
  ) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  className,
  onOpenAnnotationColorPicker,
}) => {
  // Subscribe to annotations and hidden layers from store
  const annotations = useOverlayStore((state) => state.annotations);
  const annotationGroups = useOverlayStore((state) => state.annotationGroups);
  const hiddenLayers = useOverlayStore((state) => state.hiddenLayers);
  const removeAnnotation = useOverlayStore((state) => state.removeAnnotation);
  const updateShapeText = useOverlayStore((state) => state.updateShapeText);
  const updateAnnotationLabel = useOverlayStore(
    (state) => state.updateAnnotationLabel,
  );
  const clearAnnotations = useOverlayStore((state) => state.clearAnnotations);
  const toggleLayerVisibility = useOverlayStore(
    (state) => state.toggleLayerVisibility,
  );
  const createGroup = useOverlayStore((state) => state.createGroup);
  const deleteGroup = useOverlayStore((state) => state.deleteGroup);
  const toggleGroupExpanded = useOverlayStore(
    (state) => state.toggleGroupExpanded,
  );
  const addAnnotationToGroup = useOverlayStore(
    (state) => state.addAnnotationToGroup,
  );
  const brushEditTargetId = useOverlayStore(
    (state) => state.brushEditTargetId,
  );
  const brushEditMode = useOverlayStore((state) => state.brushEditMode);
  const startBrushEdit = useOverlayStore((state) => state.startBrushEdit);
  const stopBrushEdit = useOverlayStore((state) => state.stopBrushEdit);

  // Local state for text editing
  const [editingTextId, setEditingTextId] = React.useState<string | null>(null);
  const [editTextValue, setEditTextValue] = React.useState("");
  const [editFontSize, setEditFontSize] = React.useState(14);
  const [editingIsShape, setEditingIsShape] = React.useState(false); // Track if editing a shape (vs pure text annotation)

  // Local state for name (label) editing
  const [editingLabelId, setEditingLabelId] = React.useState<string | null>(
    null,
  );
  const [editLabelValue, setEditLabelValue] = React.useState("");

  // Local state for drag and drop
  const [draggedAnnotationId, setDraggedAnnotationId] = React.useState<
    string | null
  >(null);
  const [_dropTargetGroupId, setDropTargetGroupId] = React.useState<
    string | null
  >(null);

  const getLayerIcon = (annotation: Annotation) => {
    switch (annotation.type) {
      case "rectangle":
        return <RectangleIcon style={{ width: "16px", height: "16px" }} />;
      case "ellipse":
        return <EllipseIcon style={{ width: "16px", height: "16px" }} />;
      case "polygon":
        return <PolygonIcon style={{ width: "16px", height: "16px" }} />;
      case "line":
        return <LineIcon style={{ width: "16px", height: "16px" }} />;
      case "polyline":
        return <PolylineIcon style={{ width: "16px", height: "16px" }} />;
      case "point":
        return <PointIcon style={{ width: "16px", height: "16px" }} />;
      case "text":
        return <TextIcon style={{ width: "16px", height: "16px" }} />;
      default:
        return <PointIcon style={{ width: "16px", height: "16px" }} />;
    }
  };

  // Stable index-based default for "Untitled N" labels
  const annotationIndexMap = React.useMemo(() => {
    const map = new Map<string, number>();
    annotations.forEach((annotation, index) => {
      map.set(annotation.id, index + 1);
    });
    return map;
  }, [annotations]);

  const getLayerName = (annotation: Annotation) => {
    const index = annotationIndexMap.get(annotation.id);
    const defaultLabel =
      index !== undefined ? `Untitled ${index}` : "Untitled";
    const baseLabel = annotation.metadata?.label || defaultLabel;

    // For pure text annotations, just show the label
    if (annotation.type === "text") {
      return baseLabel;
    }

    // For shapes/points, append any text as a description
    if (annotation.text) {
      const textPreview =
        annotation.text.length > 20
          ? `${annotation.text.substring(0, 20)}...`
          : annotation.text;
      return `${baseLabel}: ${textPreview}`;
    }

    return baseLabel;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Text editing functions
  const handleEditText = (annotation: Annotation) => {
    let currentText = "";
    let currentFontSize = 14;

    if (annotation.type === "text") {
      currentText = annotation.text;
      currentFontSize = annotation.style.fontSize;
      setEditingIsShape(false);
    } else {
      currentText = annotation.text || "";
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
      updateShapeText(editingTextId, editTextValue?.trim() || "");
    }
    setEditingTextId(null);
    setEditTextValue("");
    setEditFontSize(14);
    setEditingIsShape(false);
  };

  // Name (label) editing functions
  const handleEditLabel = (annotation: Annotation) => {
    setEditLabelValue(annotation.metadata?.label || "");
    setEditingLabelId(annotation.id);
  };

  const handleSubmitLabelEdit = () => {
    if (editingLabelId) {
      updateAnnotationLabel(editingLabelId, editLabelValue);
    }
    setEditingLabelId(null);
    setEditLabelValue("");
  };

  const handleCancelLabelEdit = () => {
    setEditingLabelId(null);
    setEditLabelValue("");
  };

  const handleCancelTextEdit = () => {
    setEditingTextId(null);
    setEditTextValue("");
    setEditFontSize(14);
    setEditingIsShape(false);
  };

  // Convert groups to ListItem format
  const groupItems: ListItem[] = annotationGroups.map((group) => {
    const groupAnnotations = annotations.filter((a) =>
      group.annotationIds.includes(a.id),
    );

    const children: ListItem[] = groupAnnotations.map((annotation) => ({
      id: annotation.id,
      title: getLayerName(annotation),
      subtitle: formatDate(annotation.metadata?.createdAt || new Date()),
      isHidden: hiddenLayers.has(annotation.id),
      icon: getLayerIcon(annotation),
      isExpanded: group.isExpanded,
      metadata: { annotation, type: "annotation" },
    }));

    return {
      id: group.id,
      title: group.name,
      subtitle: `${groupAnnotations.length} annotations`,
      isExpanded: group.isExpanded,
      children,
      metadata: { group, type: "group" },
    };
  });

  // Convert ungrouped annotations to ListItem format
  const ungroupedAnnotations = annotations.filter((annotation) => {
    return !annotationGroups.some((group) =>
      group.annotationIds.includes(annotation.id),
    );
  });

  const annotationItems: ListItem[] = ungroupedAnnotations.map(
    (annotation) => ({
      id: annotation.id,
      title: getLayerName(annotation),
      subtitle: formatDate(annotation.metadata?.createdAt || new Date()),
      isHidden: hiddenLayers.has(annotation.id),
      icon: getLayerIcon(annotation),
      metadata: { annotation, type: "annotation" },
    }),
  );

  // Combine groups and ungrouped annotations
  const allItems = [...groupItems, ...annotationItems];

  const handleItemClick = (item: ListItem) => {
    if (item.metadata?.type === "group") {
      toggleGroupExpanded(item.id);
    }
    // For annotations, we could add selection logic here if needed
  };

  const handleToggleVisibility = (itemId: string) => {
    // Find if it's a group or annotation
    const group = annotationGroups.find((g) => g.id === itemId);
    if (group) {
      // Toggle visibility for all annotations in the group
      group.annotationIds.forEach((annotationId) => {
        toggleLayerVisibility(annotationId);
      });
    } else {
      // Toggle visibility for individual annotation
      toggleLayerVisibility(itemId);
    }
  };

  const handleDelete = (itemId: string) => {
    // Find if it's a group or annotation
    const group = annotationGroups.find((g) => g.id === itemId);
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
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedAnnotationId(null);
    setDropTargetGroupId(null);
  };

  const handleDragOver = (itemId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetGroupId(itemId);
  };

  const handleDragLeave = () => {
    setDropTargetGroupId(null);
  };

  const handleDrop = (targetId: string, _draggedId: string) => {
    // Handle drag and drop between groups
    if (draggedAnnotationId && draggedAnnotationId !== targetId) {
      // Find if target is a group
      const targetGroup = annotationGroups.find((g) => g.id === targetId);
      if (targetGroup) {
        // Add annotation to group
        addAnnotationToGroup(targetId, draggedAnnotationId);
      }
    }
    setDraggedAnnotationId(null);
    setDropTargetGroupId(null);
  };

  const itemActions = (item: ListItem) => {
    if (item.metadata?.type === "annotation") {
      const annotation = item.metadata.annotation;
      const isPolygon = annotation.type === "polygon";
      const isBrushActive =
        isPolygon &&
        brushEditTargetId === annotation.id &&
        brushEditMode === "add";
      const isEraserActive =
        isPolygon &&
        brushEditTargetId === annotation.id &&
        brushEditMode === "subtract";

      return (
        <div style={{ display: "flex", gap: "4px" }}>
          {/* Brush add mode */}
          {isPolygon && (
            <button
              type="button"
              style={{
                background: isBrushActive ? "#444" : "none",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onClick={(e) => {
                e.stopPropagation();

                // Ensure polygon is visible before editing
                if (hiddenLayers.has(annotation.id)) {
                  toggleLayerVisibility(annotation.id);
                }

                if (isBrushActive) {
                  stopBrushEdit();
                } else {
                  startBrushEdit(annotation.id, "add");
                }
              }}
              title="Brush add to polygon"
            >
              <BrushIcon style={{ width: "14px", height: "14px" }} />
            </button>
          )}

          {/* Brush subtract (eraser) mode */}
          {isPolygon && (
            <button
              type="button"
              style={{
                background: isEraserActive ? "#444" : "none",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onClick={(e) => {
                e.stopPropagation();

                // Ensure polygon is visible before editing
                if (hiddenLayers.has(annotation.id)) {
                  toggleLayerVisibility(annotation.id);
                }

                if (isEraserActive) {
                  stopBrushEdit();
                } else {
                  startBrushEdit(annotation.id, "subtract");
                }
              }}
              title="Brush subtract from polygon"
            >
              {/* Simple eraser glyph */}
              <svg
                aria-label="Eraser"
                role="img"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M16.24 3.56a2 2 0 0 0-2.83 0L3.56 13.41a2 2 0 0 0 0 2.83L7.76 20.44a2 2 0 0 0 2.83 0l9.85-9.85a2 2 0 0 0 0-2.83L16.24 3.56zm-7.78 15.02-3.18-3.18L9.41 11l3.18 3.18-4.13 4.4zM14 18h6v2h-7.5L14 18z" />
              </svg>
            </button>
          )}

          {/* Text Edit Button */}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#ccc",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditText(annotation);
            }}
            title="Edit text"
          >
            <TextIcon style={{ width: "14px", height: "14px" }} />
          </button>

          {/* Color Picker Button */}
          {onOpenAnnotationColorPicker && (
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onClick={(e) => {
                e.stopPropagation();
                let currentAnnotationColor: [number, number, number, number];

                if (annotation.type === "text") {
                  currentAnnotationColor = annotation.style.fontColor;
                } else if (
                  annotation.type === "rectangle" ||
                  annotation.type === "ellipse" ||
                  annotation.type === "polygon" ||
                  annotation.type === "line" ||
                  annotation.type === "polyline"
                ) {
                  currentAnnotationColor = annotation.style.lineColor;
                } else if (annotation.type === "point") {
                  currentAnnotationColor = annotation.style.fillColor;
                } else {
                  currentAnnotationColor = [255, 255, 255, 255]; // Default white
                }

                onOpenAnnotationColorPicker(
                  annotation.id,
                  currentAnnotationColor,
                );
              }}
              title="Change annotation color"
            >
              <svg
                aria-label="Change annotation color"
                role="img"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
              </svg>
            </button>
          )}
        </div>
      );
    }
    return null;
  };

  const handleItemDoubleClick = (item: ListItem) => {
    if (item.metadata?.type === "annotation") {
      handleEditLabel(item.metadata.annotation);
    }
  };

  const headerActions = (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <button
        type="button"
        style={{
          background: "#4CAF50",
          border: "none",
          color: "white",
          cursor: "pointer",
          padding: "6px 12px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "12px",
        }}
        onClick={() => createGroup()}
        title="Create group"
      >
        <GroupIcon style={{ width: "12px", height: "12px" }} />
        Group
      </button>
      {annotations.length > 0 && (
        <button
          type="button"
          style={{
            background: "#f44336",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "12px",
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
        onItemDoubleClick={handleItemDoubleClick}
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

      {/* Name (label) Edit Modal */}
      {editingLabelId && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#2c2c2c",
            border: "2px solid #444",
            borderRadius: "8px",
            padding: "20px",
            zIndex: 1000,
            minWidth: "300px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            style={{
              marginBottom: "15px",
              color: "white",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            Rename Annotation
          </div>
          <input
            type="text"
            value={editLabelValue}
            onChange={(e) => setEditLabelValue(e.target.value)}
            placeholder="Enter layer name"
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #555",
              borderRadius: "4px",
              backgroundColor: "#1a1a1a",
              color: "white",
              fontSize: "14px",
              outline: "none",
              marginBottom: "15px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSubmitLabelEdit();
              } else if (e.key === "Escape") {
                handleCancelLabelEdit();
              }
            }}
          />
          <div
            style={{
              marginTop: "15px",
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={handleCancelLabelEdit}
              style={{
                padding: "8px 16px",
                backgroundColor: "#555",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitLabelEdit}
              style={{
                padding: "8px 16px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { LayersPanel };
export type { LayersPanelProps };
