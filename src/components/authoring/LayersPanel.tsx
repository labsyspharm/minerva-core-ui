import * as React from "react";
import styles from "@/components/authoring/DrawingPanel.module.css";
import {
  ItemList,
  type ItemListVariant,
  type ListItem,
} from "@/components/shared/common/ItemList";
import AddBrushIcon from "@/components/shared/icons/add-brush.svg?react";
import AnnotationColorIcon from "@/components/shared/icons/annotation-color.svg?react";
import CursorIcon from "@/components/shared/icons/cursor.svg?react";
import EraserIcon from "@/components/shared/icons/eraser.svg?react";
import FolderIcon from "@/components/shared/icons/folder.svg?react";
import LineIcon from "@/components/shared/icons/line.svg?react";
import PointIcon from "@/components/shared/icons/point.svg?react";
import PolygonIcon from "@/components/shared/icons/polygon.svg?react";
import PolylineIcon from "@/components/shared/icons/polyline.svg?react";
import TextIcon from "@/components/shared/icons/text.svg?react";
import type { Shape } from "@/lib/shapes/shapeModel";
import { useAppStore } from "@/lib/stores/appStore";

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

const TrashIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const getAnnotationRgba = (
  annotation: Shape,
): [number, number, number, number] => {
  if (annotation.type === "text") {
    return annotation.style.fontColor;
  }
  if (
    annotation.type === "polygon" ||
    annotation.type === "line" ||
    annotation.type === "polyline"
  ) {
    return annotation.style.lineColor;
  }
  if (annotation.type === "point") {
    return annotation.style.fillColor;
  }
  return [255, 255, 255, 255];
};

/** Arrows and standalone text use fixed colors; layers header color is disabled. */
const isAnnotationLayerColorLocked = (annotation: Shape): boolean => {
  if (annotation.type === "text") return true;
  if (annotation.type === "line" && annotation.hasArrowHead !== false)
    return true;
  return false;
};

interface LayersPanelProps {
  className?: string;
  itemListVariant?: ItemListVariant;
  /** When set, renders one unified top bar: tools + layers actions */
  toolbarSlot?: React.ReactNode;
  /** Waypoint editor only: copy/paste icons (same handlers as Cmd/Ctrl+C/V). */
  waypointClipboardActions?: React.ReactNode;
  /** Used when no annotation is selected (or a group is selected) for the header color control */
  onOpenGlobalColorPicker?: (anchor: DOMRect) => void;
  onOpenAnnotationColorPicker?: (
    annotationId: string,
    currentColor: [number, number, number, number],
    anchor: DOMRect,
  ) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  className,
  itemListVariant = "default",
  toolbarSlot,
  waypointClipboardActions,
  onOpenGlobalColorPicker,
  onOpenAnnotationColorPicker,
}) => {
  const itemListRootRef = React.useRef<HTMLDivElement | null>(null);
  // Subscribe to shapes and hidden layers from store
  const shapes = useAppStore((state) => state.shapes);
  const shapeGroups = useAppStore((state) => state.shapeGroups);
  const hiddenShapeIds = useAppStore((state) => state.hiddenShapeIds);
  const removeShape = useAppStore((state) => state.removeShape);
  const updateShapeText = useAppStore((state) => state.updateShapeText);
  const updateShapeLabel = useAppStore((state) => state.updateShapeLabel);
  const toggleShapeVisibility = useAppStore(
    (state) => state.toggleShapeVisibility,
  );
  const createGroup = useAppStore((state) => state.createGroup);
  const deleteGroup = useAppStore((state) => state.deleteGroup);
  const removeShapeFromGroup = useAppStore(
    (state) => state.removeShapeFromGroup,
  );
  const setLayersPanelSelectedShapeIds = useAppStore(
    (state) => state.setLayersPanelSelectedShapeIds,
  );
  const setLayersPanelSelectedGroupId = useAppStore(
    (state) => state.setLayersPanelSelectedGroupId,
  );
  const setSelectedShape = useAppStore((state) => state.setSelectedShape);
  const layersPanelSelectionFlash = useAppStore(
    (state) => state.layersPanelSelectionFlash,
  );
  const layersPanelSelectionRequest = useAppStore(
    (state) => state.layersPanelSelectionRequest,
  );
  const toggleGroupExpanded = useAppStore((state) => state.toggleGroupExpanded);
  const addShapeToGroup = useAppStore((state) => state.addShapeToGroup);
  const brushEditTargetId = useAppStore((state) => state.brushEditTargetId);
  const brushEditMode = useAppStore((state) => state.brushEditMode);
  const startBrushEdit = useAppStore((state) => state.startBrushEdit);
  const stopBrushEdit = useAppStore((state) => state.stopBrushEdit);

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

  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(
    null,
  );
  const [selectedShapeIds, setSelectedShapeIds] = React.useState<string[]>([]);

  /** Anchor for Shift+click range selection (last plain or Cmd/Ctrl+click on an annotation). */
  const shiftRangeAnchorIdRef = React.useRef<string | null>(null);

  const [flashShapeIds, setFlashShapeIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [flashGroupId, setFlashGroupId] = React.useState<string | null>(null);

  /** Single id for header actions that expect one layer, or group id. */
  const selectedLayerId =
    selectedGroupId ??
    (selectedShapeIds.length === 1 ? selectedShapeIds[0] : null);

  React.useEffect(() => {
    setLayersPanelSelectedShapeIds(selectedShapeIds);
    setLayersPanelSelectedGroupId(selectedGroupId);
    if (selectedShapeIds.length === 1 && selectedGroupId === null) {
      setSelectedShape(selectedShapeIds[0]);
    } else {
      setSelectedShape(null);
    }
  }, [
    selectedShapeIds,
    selectedGroupId,
    setLayersPanelSelectedShapeIds,
    setLayersPanelSelectedGroupId,
    setSelectedShape,
  ]);

  React.useEffect(() => {
    if (!layersPanelSelectionFlash) return;

    setFlashGroupId(layersPanelSelectionFlash.groupId);
    setFlashShapeIds(new Set(layersPanelSelectionFlash.shapeIds));

    const t = window.setTimeout(() => {
      setFlashGroupId(null);
      setFlashShapeIds(new Set());
    }, 600);
    return () => window.clearTimeout(t);
  }, [layersPanelSelectionFlash]);

  React.useEffect(() => {
    if (!layersPanelSelectionRequest) return;
    setSelectedGroupId(layersPanelSelectionRequest.groupId);
    setSelectedShapeIds(layersPanelSelectionRequest.shapeIds);
    shiftRangeAnchorIdRef.current =
      layersPanelSelectionRequest.shapeIds.at(-1) ?? null;
    // Paste feedback: scroll after new items render. Pasting can enqueue multiple
    // state updates; use a few delayed attempts to catch the scroll container
    // once it becomes scrollable.
    const scrollToBottom = () => {
      const root = itemListRootRef.current;
      if (!root) return;

      const isScrollable = (el: Element) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.scrollHeight <= el.clientHeight) return false;
        const style = window.getComputedStyle(el);
        const oy = style.overflowY || style.overflow;
        return oy === "auto" || oy === "scroll";
      };

      const findScrollParent = (start: Element | null) => {
        let el: Element | null = start;
        while (el) {
          if (isScrollable(el)) return el as HTMLElement;
          el = el.parentElement;
        }
        return null;
      };

      // Default mode: the <ul> inside ItemList is scrollable.
      // Embedded edit-waypoint mode: the scroll container is higher up (collapsible body / panel).
      const ul = root.querySelector("ul");
      const scrollParent = findScrollParent(ul ?? root) ?? (ul as HTMLElement);
      if (!scrollParent) return;
      scrollParent.scrollTop = scrollParent.scrollHeight;
    };

    const raf1 = window.requestAnimationFrame(() => {
      const raf2 = window.requestAnimationFrame(() => {
        scrollToBottom();
      });
      void raf2;
    });

    const t1 = window.setTimeout(scrollToBottom, 50);
    const t2 = window.setTimeout(scrollToBottom, 150);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [layersPanelSelectionRequest]);

  React.useEffect(() => {
    if (
      selectedGroupId !== null &&
      !shapeGroups.some((g) => g.id === selectedGroupId)
    ) {
      setSelectedGroupId(null);
    }
    setSelectedShapeIds((prev) => {
      const next = prev.filter((id) => shapes.some((a) => a.id === id));
      return next.length === prev.length ? prev : next;
    });
    const anchor = shiftRangeAnchorIdRef.current;
    if (anchor !== null && !shapes.some((a) => a.id === anchor)) {
      shiftRangeAnchorIdRef.current = null;
    }
  }, [shapes, shapeGroups, selectedGroupId]);

  const getLayerIcon = (annotation: Shape) => {
    const dim = { width: "14px", height: "14px" } as const;
    switch (annotation.type) {
      case "polygon":
        return <PolygonIcon style={dim} />;
      case "line":
        return <LineIcon style={dim} />;
      case "polyline":
        return <PolylineIcon style={dim} />;
      case "point":
        return <PointIcon style={dim} />;
      case "text":
        return <TextIcon style={dim} />;
      default:
        return <PointIcon style={dim} />;
    }
  };

  // Stable index-based default for "Untitled N" labels
  const annotationIndexMap = React.useMemo(() => {
    const map = new Map<string, number>();
    shapes.forEach((annotation, index) => {
      map.set(annotation.id, index + 1);
    });
    return map;
  }, [shapes]);

  const getLayerName = (annotation: Shape) => {
    const index = annotationIndexMap.get(annotation.id);
    const defaultLabel = index !== undefined ? `Untitled ${index}` : "Untitled";
    const baseLabel = annotation.metadata?.label || defaultLabel;

    // For pure text shapes, just show the label
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

  // Text editing functions
  const handleEditText = (annotation: Shape) => {
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
      // Use updateShapeText which works for both text shapes and shapes with text
      updateShapeText(editingTextId, editTextValue?.trim() || "");
    }
    setEditingTextId(null);
    setEditTextValue("");
    setEditFontSize(14);
    setEditingIsShape(false);
  };

  // Name (label) editing functions
  const handleEditLabel = (annotation: Shape) => {
    setEditLabelValue(annotation.metadata?.label || "");
    setEditingLabelId(annotation.id);
  };

  const handleSubmitLabelEdit = () => {
    if (editingLabelId) {
      updateShapeLabel(editingLabelId, editLabelValue);
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
  const groupItems: ListItem[] = shapeGroups.map((group) => {
    const groupAnnotations = shapes.filter((a) =>
      group.shapeIds.includes(a.id),
    );

    const groupIsHidden =
      groupAnnotations.length > 0 &&
      groupAnnotations.every((annotation) => hiddenShapeIds.has(annotation.id));

    const children: ListItem[] = groupAnnotations.map((annotation) => ({
      id: annotation.id,
      title: getLayerName(annotation),
      isHidden: hiddenShapeIds.has(annotation.id),
      icon: getLayerIcon(annotation),
      isExpanded: group.isExpanded,
      isActive: selectedShapeIds.includes(annotation.id),
      pulse: flashShapeIds.has(annotation.id),
      metadata: { shape: annotation, type: "shape" },
    }));

    return {
      id: group.id,
      title: group.name,
      subtitle: `${groupAnnotations.length} shapes`,
      isHidden: groupIsHidden,
      isExpanded: group.isExpanded,
      isActive: selectedGroupId === group.id,
      pulse: flashGroupId === group.id,
      icon: <FolderIcon style={{ width: "14px", height: "14px" }} />,
      children,
      metadata: { group, type: "group" },
    };
  });

  // Convert ungrouped shapes to ListItem format
  const ungroupedAnnotations = shapes.filter((annotation) => {
    return !shapeGroups.some((group) => group.shapeIds.includes(annotation.id));
  });

  const annotationItems: ListItem[] = ungroupedAnnotations.map(
    (annotation) => ({
      id: annotation.id,
      title: getLayerName(annotation),
      isHidden: hiddenShapeIds.has(annotation.id),
      icon: getLayerIcon(annotation),
      isActive: selectedShapeIds.includes(annotation.id),
      pulse: flashShapeIds.has(annotation.id),
      metadata: { shape: annotation, type: "shape" },
    }),
  );

  // Combine groups and ungrouped shapes
  const allItems = [...groupItems, ...annotationItems];

  /** Flat annotation order as rendered (groups top-to-bottom, then ungrouped), for Shift+range select. */
  const orderedAnnotationIdsInPanel = React.useMemo(() => {
    const ids: string[] = [];
    for (const group of shapeGroups) {
      for (const a of shapes) {
        if (group.shapeIds.includes(a.id)) ids.push(a.id);
      }
    }
    for (const a of shapes) {
      const inGroup = shapeGroups.some((g) => g.shapeIds.includes(a.id));
      if (!inGroup) ids.push(a.id);
    }
    return ids;
  }, [shapes, shapeGroups]);

  const handleItemClick = (item: ListItem, event: React.MouseEvent) => {
    const meta = item.metadata;
    if (meta?.type === "group") {
      setSelectedGroupId(item.id);
      setSelectedShapeIds([]);
      shiftRangeAnchorIdRef.current = null;
      return;
    }
    if (meta?.type === "shape") {
      const annId = meta.shape.id;
      setSelectedGroupId(null);

      if (event.shiftKey) {
        const flat = orderedAnnotationIdsInPanel;
        const anchor =
          shiftRangeAnchorIdRef.current ?? selectedShapeIds[0] ?? annId;
        let i0 = flat.indexOf(anchor);
        let i1 = flat.indexOf(annId);
        if (i0 < 0) i0 = i1;
        if (i1 < 0) i1 = i0;
        if (i0 < 0 && i1 < 0) {
          setSelectedShapeIds([annId]);
        } else {
          const lo = Math.min(i0, i1);
          const hi = Math.max(i0, i1);
          setSelectedShapeIds(flat.slice(lo, hi + 1));
        }
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        setSelectedShapeIds((prev) => {
          const next = new Set(prev);
          if (next.has(annId)) {
            next.delete(annId);
          } else {
            next.add(annId);
          }
          return Array.from(next);
        });
        shiftRangeAnchorIdRef.current = annId;
        return;
      }

      setSelectedShapeIds([annId]);
      shiftRangeAnchorIdRef.current = annId;
    }
  };

  const handleToggleVisibility = (itemId: string) => {
    // Find if it's a group or annotation
    const group = shapeGroups.find((g) => g.id === itemId);

    if (group) {
      const allHidden =
        group.shapeIds.length > 0 &&
        group.shapeIds.every((annotationId) =>
          hiddenShapeIds.has(annotationId),
        );

      group.shapeIds.forEach((annotationId) => {
        const isHidden = hiddenShapeIds.has(annotationId);

        // If any are visible, hide all; if all are hidden, show all.
        if (allHidden && isHidden) {
          toggleShapeVisibility(annotationId);
        } else if (!allHidden && !isHidden) {
          toggleShapeVisibility(annotationId);
        }
      });
    } else if (
      selectedShapeIds.length > 1 &&
      selectedShapeIds.includes(itemId)
    ) {
      const ids = selectedShapeIds;
      const allHidden =
        ids.length > 0 && ids.every((id) => hiddenShapeIds.has(id));
      ids.forEach((annotationId) => {
        const isHidden = hiddenShapeIds.has(annotationId);
        if (allHidden && isHidden) {
          toggleShapeVisibility(annotationId);
        } else if (!allHidden && !isHidden) {
          toggleShapeVisibility(annotationId);
        }
      });
    } else {
      // Toggle visibility for individual annotation
      toggleShapeVisibility(itemId);
    }
  };

  const handleDelete = (itemId: string) => {
    // Find if it's a group or annotation
    const group = shapeGroups.find((g) => g.id === itemId);
    if (group) {
      deleteGroup(itemId);
    } else {
      removeShape(itemId);
    }
  };

  const headerSelectedAnnotation =
    selectedLayerId == null
      ? undefined
      : shapes.find((a) => a.id === selectedLayerId);

  const layerColorLocked =
    headerSelectedAnnotation != null &&
    isAnnotationLayerColorLocked(headerSelectedAnnotation);

  const handleHeaderColorClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const anchor = event.currentTarget.getBoundingClientRect();
    const ann = headerSelectedAnnotation;
    if (ann && isAnnotationLayerColorLocked(ann)) {
      return;
    }
    if (ann && onOpenAnnotationColorPicker) {
      onOpenAnnotationColorPicker(ann.id, getAnnotationRgba(ann), anchor);
      return;
    }
    onOpenGlobalColorPicker?.(anchor);
  };

  const headerColorDisabled = (() => {
    if (!selectedLayerId) {
      return true;
    }
    const ann = headerSelectedAnnotation;
    if (ann) {
      if (isAnnotationLayerColorLocked(ann)) {
        return true;
      }
      return !onOpenAnnotationColorPicker && !onOpenGlobalColorPicker;
    }
    const grp = shapeGroups.find((g) => g.id === selectedLayerId);
    if (grp) {
      return !onOpenGlobalColorPicker;
    }
    return true;
  })();

  const handleHeaderDeleteClick = () => {
    if (selectedGroupId) {
      deleteGroup(selectedGroupId);
      setSelectedGroupId(null);
      setSelectedShapeIds([]);
      return;
    }
    if (selectedShapeIds.length === 0) {
      return;
    }
    for (const id of selectedShapeIds) {
      removeShape(id);
    }
    setSelectedShapeIds([]);
  };

  const handleHeaderEditTextClick = () => {
    if (selectedShapeIds.length !== 1) return;
    const ann = shapes.find((a) => a.id === selectedShapeIds[0]);
    if (ann) {
      handleEditText(ann);
    }
  };

  const headerEditTextDisabled =
    selectedShapeIds.length !== 1 ||
    selectedGroupId !== null ||
    !shapes.some((a) => a.id === selectedShapeIds[0]);

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
      const targetGroup = shapeGroups.find((g) => g.id === targetId);

      if (targetGroup) {
        // First, remove the annotation from any groups it already belongs to
        shapeGroups.forEach((group) => {
          if (group.shapeIds.includes(draggedAnnotationId)) {
            removeShapeFromGroup(group.id, draggedAnnotationId);
          }
        });

        // Then add it to the target group if not already present
        if (!targetGroup.shapeIds.includes(draggedAnnotationId)) {
          addShapeToGroup(targetId, draggedAnnotationId);
        }
      }
    }
    setDraggedAnnotationId(null);
    setDropTargetGroupId(null);
  };

  const itemActions = (item: ListItem) => {
    if (item.metadata?.type === "shape") {
      const annotation = item.metadata.shape;
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
                if (hiddenShapeIds.has(annotation.id)) {
                  toggleShapeVisibility(annotation.id);
                }

                if (isBrushActive) {
                  stopBrushEdit();
                } else {
                  startBrushEdit(annotation.id, "add");
                }
              }}
              title="Brush add to polygon"
            >
              <AddBrushIcon style={{ width: "14px", height: "14px" }} />
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
                if (hiddenShapeIds.has(annotation.id)) {
                  toggleShapeVisibility(annotation.id);
                }

                if (isEraserActive) {
                  stopBrushEdit();
                } else {
                  startBrushEdit(annotation.id, "subtract");
                }
              }}
              title="Brush subtract from polygon"
            >
              <EraserIcon style={{ width: "14px", height: "14px" }} />
            </button>
          )}
        </div>
      );
    }
    return null;
  };

  const handleItemDoubleClick = (item: ListItem) => {
    if (item.metadata?.type === "shape") {
      handleEditLabel(item.metadata.shape);
    }
  };

  const layerMetaButtons = (
    <>
      <button
        type="button"
        className={styles.toolButton}
        onClick={() => createGroup()}
        title="Add group"
      >
        <FolderIcon />
      </button>
      <button
        type="button"
        className={styles.toolButton}
        onClick={handleHeaderEditTextClick}
        disabled={headerEditTextDisabled}
        title={
          headerEditTextDisabled
            ? "Select an annotation to edit text"
            : "Edit text — selected annotation"
        }
      >
        <CursorIcon />
      </button>
      <button
        type="button"
        className={styles.toolButton}
        onClick={handleHeaderColorClick}
        disabled={headerColorDisabled}
        title={
          layerColorLocked
            ? "Color is fixed for arrows and text shapes"
            : headerColorDisabled
              ? "Select a layer or group to change color"
              : shapes.some((a) => a.id === selectedLayerId)
                ? "Color — selected annotation"
                : "Color — global (group selected)"
        }
      >
        <AnnotationColorIcon />
      </button>
      <button
        type="button"
        className={styles.toolButton}
        onClick={handleHeaderDeleteClick}
        disabled={!selectedGroupId && selectedShapeIds.length === 0}
        title={
          selectedGroupId || selectedShapeIds.length > 0
            ? selectedShapeIds.length > 1
              ? "Delete selected shapes"
              : "Delete selected layer or group"
            : "Select a layer or group to delete"
        }
      >
        <TrashIcon />
      </button>
      {waypointClipboardActions}
    </>
  );

  const hasUnifiedChrome = !!toolbarSlot;

  return (
    <div className={styles.layersPanel}>
      {hasUnifiedChrome ? (
        <div className={styles.layersUnifiedTop}>
          <div className={styles.layersToolbarSlot}>{toolbarSlot}</div>
          <div className={styles.layersMetaCluster}>{layerMetaButtons}</div>
        </div>
      ) : null}

      <div ref={itemListRootRef} style={{ minHeight: 0 }}>
        <ItemList
          className={className}
          variant={itemListVariant}
          items={allItems}
          title="Layers"
          noHeader={hasUnifiedChrome}
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
          visibilityToggleLeading={true}
          compactRows={true}
          showDeleteButton={false}
          showExpandToggle={true}
          headerActions={
            hasUnifiedChrome ? undefined : (
              <div className={styles.layersMetaCluster}>{layerMetaButtons}</div>
            )
          }
          itemActions={itemActions}
        />
      </div>

      {/* Text Edit Modal */}
      {editingTextId && (
        <TextEditPanel
          title={editingIsShape ? "Edit Shape Label" : "Edit Text Shape"}
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
            Rename Shape
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
