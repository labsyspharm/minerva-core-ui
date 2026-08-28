import * as React from "react";
import MenuIcon from "@/components/shared/icons/menu.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
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
};

export function StoryAuthorOverflowMenu(props: StoryAuthorOverflowMenuProps) {
  const { onReturnToLibrary, onExport } = props;
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
        className={minervaTheme.control}
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MenuIcon aria-hidden />
      </button>
      {open ? (
        <div className={minervaTheme.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={minervaTheme.menuItem}
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
            className={`${minervaTheme.menuItem} ${styles.menuItemGap}`}
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
            Save Config
          </button>
          <button
            type="button"
            role="menuitem"
            className={minervaTheme.menuItem}
            disabled={!waypointsOk}
            title={
              waypointsOk
                ? "Save a playable story folder (index.html + images)"
                : "Add a waypoint before exporting"
            }
            onClick={(e) => {
              e.stopPropagation();
              if (!waypointsOk) return;
              close();
              onExport();
            }}
          >
            Export Story
          </button>
        </div>
      ) : null}
    </div>
  );
}
