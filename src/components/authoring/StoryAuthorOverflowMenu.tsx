import * as React from "react";
import MenuIcon from "@/components/shared/icons/menu.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import { applyOmeRoisFromAnnotationXmlString } from "@/lib/shapes/applyOmeRoisToDocument";
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
  const [xmlFeedback, setXmlFeedback] = React.useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const xmlInputRef = React.useRef<HTMLInputElement>(null);
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

  const onAnnotationXmlSelected: React.ChangeEventHandler<HTMLInputElement> = (
    e,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file
      .text()
      .then((text) => {
        const r = applyOmeRoisFromAnnotationXmlString(text);
        if (r.success === false) {
          setXmlFeedback({ type: "err", text: r.error });
          return;
        }
        setXmlFeedback({
          type: "ok",
          text: `Imported ${r.shapeCount} annotation${r.shapeCount === 1 ? "" : "s"}.`,
        });
        close();
      })
      .catch((err: unknown) => {
        setXmlFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Could not read the file.",
        });
      });
  };

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <PanelIconButton
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
      </PanelIconButton>
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
          <button
            type="button"
            role="menuitem"
            className={`${minervaTheme.menuItem} ${styles.menuItemGap}`}
            onClick={(e) => {
              e.stopPropagation();
              setXmlFeedback(null);
              xmlInputRef.current?.click();
            }}
          >
            Upload annotations (OME-XML)
          </button>
        </div>
      ) : null}
      <input
        ref={xmlInputRef}
        className={styles.hiddenFileInput}
        type="file"
        accept=".xml,application/xml,text/xml"
        aria-label="OME-XML annotations file"
        onChange={onAnnotationXmlSelected}
      />
      {xmlFeedback ? (
        <output
          className={
            xmlFeedback.type === "ok"
              ? styles.xmlFeedbackOk
              : styles.xmlFeedbackErr
          }
        >
          {xmlFeedback.text}
        </output>
      ) : null}
    </div>
  );
}
