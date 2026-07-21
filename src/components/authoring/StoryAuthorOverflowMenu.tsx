import * as React from "react";
import type { DocumentData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import styles from "./StoryAuthorOverflowMenu.module.css";

function downloadStoryJsonExport(
  data: DocumentData,
  filename = "document.json",
): void {
  const clone = JSON.parse(JSON.stringify(data)) as unknown;
  const doc = validateDocumentData(clone);
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type StoryAuthorOverflowMenuProps = {
  onReturnToLibrary: () => void;
  onExport: () => void;
  exportLabel?: string;
  /** Shown when the story can keep remote OME-TIFF URLs instead of baking pyramids. */
  onExportRemoteUrl?: () => void;
};

/**
 * Hamburger + overflow actions (library, export dialog, JSON download) aligned with the top
 * story banner; behavior matches the former nav tab-row menu.
 */
export function StoryAuthorOverflowMenu(props: StoryAuthorOverflowMenuProps) {
  const {
    onReturnToLibrary,
    onExport,
    exportLabel = "Export",
    onExportRemoteUrl,
  } = props;
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const waypointsOk = useDocumentStore((s) => s.waypoints.length > 0);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const w = wrapRef.current;
      if (w && !w.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.hamburgButton}
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 14"
          width="20"
          height="14"
          aria-hidden="true"
        >
          <rect x="0" y="0" width="20" height="2" rx="1" fill="currentColor" />
          <rect x="0" y="6" width="20" height="2" rx="1" fill="currentColor" />
          <rect x="0" y="12" width="20" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>
      <div
        className={[styles.dropdown, open ? styles.dropdownOpen : null]
          .filter(Boolean)
          .join(" ")}
        role="menu"
        aria-hidden={!open}
      >
        <button
          type="button"
          role="menuitem"
          className={styles.menuItem}
          onClick={(e) => {
            e.stopPropagation();
            close();
            onReturnToLibrary();
          }}
        >
          Return to Library
        </button>
        <button
          type="button"
          role="menuitem"
          className={`${styles.menuItem} ${styles.menuItemDivided}`}
          onClick={(e) => {
            e.stopPropagation();
            close();
            onExport();
          }}
        >
          {exportLabel}
        </button>
        {onExportRemoteUrl ? (
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={(e) => {
              e.stopPropagation();
              close();
              onExportRemoteUrl();
            }}
          >
            Export with remote OME URL
          </button>
        ) : null}
        <button
          type="button"
          role="menuitem"
          className={`${styles.menuItem} ${styles.menuItemDivided}`}
          disabled={!waypointsOk}
          onClick={(e) => {
            e.stopPropagation();
            if (!waypointsOk) return;
            close();
            downloadStoryJsonExport(
              useDocumentStore.getState().toDocumentData(),
            );
          }}
        >
          Save document as JSON
        </button>
      </div>
    </div>
  );
}
