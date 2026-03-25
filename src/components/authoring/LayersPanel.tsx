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
import EllipseIcon from "@/components/shared/icons/ellipse.svg?react";
import EraserIcon from "@/components/shared/icons/eraser.svg?react";
import FolderIcon from "@/components/shared/icons/folder.svg?react";
import LineIcon from "@/components/shared/icons/line.svg?react";
import PointIcon from "@/components/shared/icons/point.svg?react";
import PolygonIcon from "@/components/shared/icons/polygon.svg?react";
import PolylineIcon from "@/components/shared/icons/polyline.svg?react";
import RectangleIcon from "@/components/shared/icons/rectangle.svg?react";
import TextIcon from "@/components/shared/icons/text.svg?react";
import type { Annotation } from "@/lib/stores";
import { useOverlayStore } from "@/lib/stores";

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
  annotation: Annotation,
): [number, number, number, number] => {
  if (annotation.type === "text") {
    return annotation.style.fontColor;
  }
  if (
    annotation.type === "rectangle" ||
    annotation.type === "ellipse" ||
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

interface LayersPanelProps {
  className?: string;
  itemListVariant?: ItemListVariant;
  /** When set, renders one unified top bar: tools + layers actions */
  toolbarSlot?: React.ReactNode;
  /** Waypoint editor only: copy/paste icons (same handlers as Cmd/Ctrl+C/V). */
  waypointClipboardActions?: React.ReactNode;
  /** Used when no annotation is selected (or a group is selected) for the header color control */
  onOpenGlobalColorPicker?: () => void;
  onOpenAnnotationColorPicker?: (
    annotationId: string,
    currentColor: [number, number, number, number],
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
  // Subscribe to annotations and hidden layers from store
  const annotations = useOverlayStore((state) => state.annotations);
  const annotationGroups = useOverlayStore((state) => state.annotationGroups);
  const hiddenLayers = useOverlayStore((state) => state.hiddenLayers);
  const removeAnnotation = useOverlayStore((state) => state.removeAnnotation);
  const updateShapeText = useOverlayStore((state) => state.updateShapeText);
  const updateAnnotationLabel = useOverlayStore(
    (state) => state.updateAnnotationLabel,
  );
  const toggleLayerVisibility = useOverlayStore(
    (state) => state.toggleLayerVisibility,
  );
  const createGroup = useOverlayStore((state) => state.createGroup);
  const deleteGroup = useOverlayStore((state) => state.deleteGroup);
  const removeAnnotationFromGroup = useOverlayStore(
    (state) => state.removeAnnotationFromGroup,
  );
  const setLayersPanelSelectedAnnotationIds = useOverlayStore(
    (state) => state.setLayersPanelSelectedAnnotationIds,
  );
  const setLayersPanelSelectedGroupId = useOverlayStore(
    (state) => state.setLayersPanelSelectedGroupId,
  );
  const setSelectedAnnotation = useOverlayStore(
    (state) => state.setSelectedAnnotation,
  );
  const layersPanelSelectionFlash = useOverlayStore(
    (state) => state.layersPanelSelectionFlash,
  );
  const layersPanelSelectionRequest = useOverlayStore(
    (state) => state.layersPanelSelectionRequest,
  );
  const toggleGroupExpanded = useOverlayStore(
    (state) => state.toggleGroupExpanded,
  );
  const addAnnotationToGroup = useOverlayStore(
    (state) => state.addAnnotationToGroup,
  );
  const brushEditTargetId = useOverlayStore((state) => state.brushEditTargetId);
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

  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(
    null,
  );
  const [selectedAnnotationIds, setSelectedAnnotationIds] = React.useState<
    string[]
  >([]);

  /** Anchor for Shift+click range selection (last plain or Cmd/Ctrl+click on an annotation). */
  const shiftRangeAnchorIdRef = React.useRef<string | null>(null);

  const [flashAnnotationIds, setFlashAnnotationIds] = React.useState<
    Set<string>
  >(new Set());
  const [flashGroupId, setFlashGroupId] = React.useState<string | null>(null);

  /** Single id for header actions that expect one layer, or group id. */
  const selectedLayerId =
    selectedGroupId ??
    (selectedAnnotationIds.length === 1 ? selectedAnnotationIds[0] : null);

  React.useEffect(() => {
    setLayersPanelSelectedAnnotationIds(selectedAnnotationIds);
    setLayersPanelSelectedGroupId(selectedGroupId);
    if (selectedAnnotationIds.length === 1 && selectedGroupId === null) {
      setSelectedAnnotation(selectedAnnotationIds[0]);
    } else {
      setSelectedAnnotation(null);
    }
  }, [
    selectedAnnotationIds,
    selectedGroupId,
    setLayersPanelSelectedAnnotationIds,
    setLayersPanelSelectedGroupId,
    setSelectedAnnotation,
  ]);

  React.useEffect(() => {
    if (!layersPanelSelectionFlash) return;

    setFlashGroupId(layersPanelSelectionFlash.groupId);
    setFlashAnnotationIds(new Set(layersPanelSelectionFlash.annotationIds));

    const t = window.setTimeout(() => {
      setFlashGroupId(null);
      setFlashAnnotationIds(new Set());
    }, 600);
    return () => window.clearTimeout(t);
  }, [layersPanelSelectionFlash]);

  React.useEffect(() => {
    if (!layersPanelSelectionRequest) return;
    setSelectedGroupId(layersPanelSelectionRequest.groupId);
    setSelectedAnnotationIds(layersPanelSelectionRequest.annotationIds);
    shiftRangeAnchorIdRef.current =
      layersPanelSelectionRequest.annotationIds.at(-1) ?? null;
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
      !annotationGroups.some((g) => g.id === selectedGroupId)
    ) {
      setSelectedGroupId(null);
    }
    setSelectedAnnotationIds((prev) => {
      const next = prev.filter((id) => annotations.some((a) => a.id === id));
      return next.length === prev.length ? prev : next;
    });
    const anchor = shiftRangeAnchorIdRef.current;
    if (anchor !== null && !annotations.some((a) => a.id === anchor)) {
      shiftRangeAnchorIdRef.current = null;
    }
  }, [annotations, annotationGroups, selectedGroupId]);

  const getLayerIcon = (annotation: Annotation) => {
    const dim = { width: "14px", height: "14px" } as const;
    switch (annotation.type) {
      case "rectangle":
        return <RectangleIcon style={dim} />;
      case "ellipse":
        return <EllipseIcon style={dim} />;
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
    annotations.forEach((annotation, index) => {
      map.set(annotation.id, index + 1);
    });
    return map;
  }, [annotations]);

  const getLayerName = (annotation: Annotation) => {
    const index = annotationIndexMap.get(annotation.id);
    const defaultLabel = index !== undefined ? `Untitled ${index}` : "Untitled";
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

    const groupIsHidden =
      groupAnnotations.length > 0 &&
      groupAnnotations.every((annotation) => hiddenLayers.has(annotation.id));

    const children: ListItem[] = groupAnnotations.map((annotation) => ({
      id: annotation.id,
      title: getLayerName(annotation),
      isHidden: hiddenLayers.has(annotation.id),
      icon: getLayerIcon(annotation),
      isExpanded: group.isExpanded,
      isActive: selectedAnnotationIds.includes(annotation.id),
      pulse: flashAnnotationIds.has(annotation.id),
      metadata: { annotation, type: "annotation" },
    }));

    return {
      id: group.id,
      title: group.name,
      subtitle: `${groupAnnotations.length} annotations`,
      isHidden: groupIsHidden,
      isExpanded: group.isExpanded,
      isActive: selectedGroupId === group.id,
      pulse: flashGroupId === group.id,
      icon: <FolderIcon style={{ width: "14px", height: "14px" }} />,
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
      isHidden: hiddenLayers.has(annotation.id),
      icon: getLayerIcon(annotation),
      isActive: selectedAnnotationIds.includes(annotation.id),
      pulse: flashAnnotationIds.has(annotation.id),
      metadata: { annotation, type: "annotation" },
    }),
  );

  // Combine groups and ungrouped annotations
  const allItems = [...groupItems, ...annotationItems];

  /** Flat annotation order as rendered (groups top-to-bottom, then ungrouped), for Shift+range select. */
  const orderedAnnotationIdsInPanel = React.useMemo(() => {
    const ids: string[] = [];
    for (const group of annotationGroups) {
      for (const a of annotations) {
        if (group.annotationIds.includes(a.id)) ids.push(a.id);
      }
    }
    for (const a of annotations) {
      const inGroup = annotationGroups.some((g) =>
        g.annotationIds.includes(a.id),
      );
      if (!inGroup) ids.push(a.id);
    }
    return ids;
  }, [annotations, annotationGroups]);

  const handleItemClick = (item: ListItem, event: React.MouseEvent) => {
    const meta = item.metadata;
    if (meta?.type === "group") {
      setSelectedGroupId(item.id);
      setSelectedAnnotationIds([]);
      shiftRangeAnchorIdRef.current = null;
      return;
    }
    if (meta?.type === "annotation") {
      const annId = meta.annotation.id;
      setSelectedGroupId(null);

      if (event.shiftKey) {
        const flat = orderedAnnotationIdsInPanel;
        const anchor =
          shiftRangeAnchorIdRef.current ?? selectedAnnotationIds[0] ?? annId;
        let i0 = flat.indexOf(anchor);
        let i1 = flat.indexOf(annId);
        if (i0 < 0) i0 = i1;
        if (i1 < 0) i1 = i0;
        if (i0 < 0 && i1 < 0) {
          setSelectedAnnotationIds([annId]);
        } else {
          const lo = Math.min(i0, i1);
          const hi = Math.max(i0, i1);
          setSelectedAnnotationIds(flat.slice(lo, hi + 1));
        }
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        setSelectedAnnotationIds((prev) => {
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

      setSelectedAnnotationIds([annId]);
      shiftRangeAnchorIdRef.current = annId;
    }
  };

  const handleToggleVisibility = (itemId: string) => {
    // Find if it's a group or annotation
    const group = annotationGroups.find((g) => g.id === itemId);

    if (group) {
      const allHidden =
        group.annotationIds.length > 0 &&
        group.annotationIds.every((annotationId) =>
          hiddenLayers.has(annotationId),
        );

      group.annotationIds.forEach((annotationId) => {
        const isHidden = hiddenLayers.has(annotationId);

        // If any are visible, hide all; if all are hidden, show all.
        if (allHidden && isHidden) {
          toggleLayerVisibility(annotationId);
        } else if (!allHidden && !isHidden) {
          toggleLayerVisibility(annotationId);
        }
      });
    } else if (
      selectedAnnotationIds.length > 1 &&
      selectedAnnotationIds.includes(itemId)
    ) {
      const ids = selectedAnnotationIds;
      const allHidden =
        ids.length > 0 && ids.every((id) => hiddenLayers.has(id));
      ids.forEach((annotationId) => {
        const isHidden = hiddenLayers.has(annotationId);
        if (allHidden && isHidden) {
          toggleLayerVisibility(annotationId);
        } else if (!allHidden && !isHidden) {
          toggleLayerVisibility(annotationId);
        }
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

  const handleHeaderColorClick = () => {
    const ann = annotations.find((a) => a.id === selectedLayerId);
    if (ann && onOpenAnnotationColorPicker) {
      onOpenAnnotationColorPicker(ann.id, getAnnotationRgba(ann));
      return;
    }
    onOpenGlobalColorPicker?.();
  };

  const headerColorDisabled = (() => {
    if (!selectedLayerId) {
      return true;
    }
    const ann = annotations.find((a) => a.id === selectedLayerId);
    if (ann) {
      return !onOpenAnnotationColorPicker && !onOpenGlobalColorPicker;
    }
    const grp = annotationGroups.find((g) => g.id === selectedLayerId);
    if (grp) {
      return !onOpenGlobalColorPicker;
    }
    return true;
  })();

  const handleHeaderDeleteClick = () => {
    if (selectedGroupId) {
      deleteGroup(selectedGroupId);
      setSelectedGroupId(null);
      setSelectedAnnotationIds([]);
      return;
    }
    if (selectedAnnotationIds.length === 0) {
      return;
    }
    for (const id of selectedAnnotationIds) {
      removeAnnotation(id);
    }
    setSelectedAnnotationIds([]);
  };

  const handleHeaderEditTextClick = () => {
    if (selectedAnnotationIds.length !== 1) return;
    const ann = annotations.find((a) => a.id === selectedAnnotationIds[0]);
    if (ann) {
      handleEditText(ann);
    }
  };

  const headerEditTextDisabled =
    selectedAnnotationIds.length !== 1 ||
    selectedGroupId !== null ||
    !annotations.some((a) => a.id === selectedAnnotationIds[0]);

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
        // First, remove the annotation from any groups it already belongs to
        annotationGroups.forEach((group) => {
          if (group.annotationIds.includes(draggedAnnotationId)) {
            removeAnnotationFromGroup(group.id, draggedAnnotationId);
          }
        });

        // Then add it to the target group if not already present
        if (!targetGroup.annotationIds.includes(draggedAnnotationId)) {
          addAnnotationToGroup(targetId, draggedAnnotationId);
        }
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
              <EraserIcon style={{ width: "14px", height: "14px" }} />
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
          headerColorDisabled
            ? "Select a layer or group to change color"
            : annotations.some((a) => a.id === selectedLayerId)
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
        disabled={!selectedGroupId && selectedAnnotationIds.length === 0}
        title={
          selectedGroupId || selectedAnnotationIds.length > 0
            ? selectedAnnotationIds.length > 1
              ? "Delete selected annotations"
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
