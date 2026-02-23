import * as React from "react";
import styles from "./ItemList.module.css";

// Generic item interface that can be extended
export interface ListItem<T = any> {
  id: string;
  title: string;
  subtitle?: string;
  isActive?: boolean;
  isHidden?: boolean;
  isDragging?: boolean;
  metadata?: T;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: ListItem<T>[];
  isExpanded?: boolean;
}

export interface ItemListProps<T = any> {
  items: ListItem<T>[];
  title: string;
  noHeader?: boolean;
  emptyMessage?: string;
  className?: string;
  onItemClick?: (item: ListItem<T>) => void;
  onToggleVisibility?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
  onToggleExpand?: (itemId: string) => void;
  onDragStart?: (itemId: string, event: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (itemId: string, event: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (targetId: string, draggedId: string) => void;
  showVisibilityToggle?: boolean;
  showDeleteButton?: boolean;
  showExpandToggle?: boolean;
  headerActions?: React.ReactNode;
  itemActions?: (item: ListItem<T>) => React.ReactNode;
  customChildRenderer?: (
    item: ListItem<T>,
    parentItem: ListItem<T>,
  ) => React.ReactNode;
}

const ItemList = <T = React.Component>({
  items,
  title,
  emptyMessage = "No items yet",
  className = "",
  onItemClick,
  onToggleVisibility,
  onDelete,
  onToggleExpand,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  showVisibilityToggle = true,
  showDeleteButton = true,
  showExpandToggle = false,
  headerActions,
  itemActions,
  customChildRenderer,
  noHeader = false,
}: ItemListProps<T>) => {
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);

  const handleDragStart = (itemId: string, event: React.DragEvent) => {
    setDraggedItemId(itemId);
    if (onDragStart) {
      onDragStart(itemId, event);
    }
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDropTargetId(null);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleDragOver = (itemId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(itemId);
    if (onDragOver) {
      onDragOver(itemId, event);
    }
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
    if (onDragLeave) {
      onDragLeave();
    }
  };

  const handleDrop = (targetId: string, event: React.DragEvent) => {
    event.preventDefault();
    if (draggedItemId && draggedItemId !== targetId && onDrop) {
      onDrop(targetId, draggedItemId);
    }
    setDropTargetId(null);
  };

  // Styles - now using CSS classes instead of inline styles

  // All styles now handled by CSS classes

  const renderItem = (item: ListItem<T>, isChild = false) => {
    const isDragging = draggedItemId === item.id;
    const isDropTarget = dropTargetId === item.id;

    // Build CSS class names based on item state
    const itemClasses = [
      styles.item,
      item.isActive ? styles.itemActive : "",
      item.isHidden ? styles.itemHidden : "",
      isDragging ? styles.itemDragging : "",
      isDropTarget ? styles.itemDropTarget : "",
      isChild ? styles.itemChild : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        type="button"
        tabIndex={0}
        key={item.id}
        className={itemClasses}
        draggable={!!onDragStart}
        onDragStart={(e) => handleDragStart(item.id, e)}
        onDragEnd={(_e) => handleDragEnd()}
        onDragOver={(e) => handleDragOver(item.id, e)}
        onDragLeave={(_e) => handleDragLeave()}
        onDrop={(e) => handleDrop(item.id, e)}
        onClick={() => onItemClick?.(item)}
      >
        {/* Icon */}
        {item.icon && <div className={styles.icon}>{item.icon}</div>}

        {/* Expand/Collapse Toggle */}
        {showExpandToggle && item.children && (
          <button type="button"
            className={styles.button}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.(item.id);
            }}
          >
            <svg
              aria-labelledby="expand-title"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`${styles.expandIcon} ${item.isExpanded ? styles.expandIconExpanded : ""}`}
            >
              <title id="expand-title">expand</title>
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </svg>
          </button>
        )}

        {/* Content */}
        <div className={styles.content}>
          <div
            className={`${styles.title} ${item.isActive ? styles.titleActive : ""}`}
          >
            {item.title}
          </div>
          {item.subtitle && (
            <div className={styles.subtitle}>{item.subtitle}</div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {/* Visibility Toggle */}
          {showVisibilityToggle && onToggleVisibility && (
            <button type="button"
              className={styles.button}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(item.id);
              }}
              title={item.isHidden ? "Show" : "Hide"}
            >
              <svg aria-labelledby="show-title"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <title id="show-title">show</title>
                {item.isHidden ? (
                  <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                ) : (
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                )}
              </svg>
            </button>
          )}

          {/* Custom Item Actions */}
          {itemActions?.(item)}

          {/* Delete Button */}
          {showDeleteButton && onDelete && (
            <button type="button"
              className={styles.button}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="Delete"
            >
              <svg aria-labelledby="delete-title"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <title id="delete-title">delete</title>
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          )}
        </div>
      </button>
    );
  };

  const header = (
    <div className={styles.header}>
      <span>
        {title} ({items.length})
      </span>
      {headerActions && (
        <div className={styles.headerActions}>{headerActions}</div>
      )}
    </div>
  );

  return (
    <div className={`${styles.itemList} ${className}`}>
      {/* Header */}
      {noHeader ? "" : header}

      {/* List */}
      <div className={styles.list}>
        {items.length === 0 ? (
          <div className={styles.emptyMessage}>{emptyMessage}</div>
        ) : (
          items.map((item) => (
            <React.Fragment key={item.id}>
              {renderItem(item)}
              {/* Render children if expanded */}
              {item.isExpanded && item.children && (
                item.children.map((child) => (
                    <React.Fragment key={`${item.id}-child-${child.id}`}>
                      {customChildRenderer
                        ? customChildRenderer(child, item)
                        : renderItem(child, true)}
                    </React.Fragment>
                  ))
              )}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
};

export { ItemList };
