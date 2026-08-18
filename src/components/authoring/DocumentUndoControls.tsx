import {
  documentRedo,
  documentUndo,
  useCanDocumentRedo,
  useCanDocumentUndo,
} from "@/lib/stores/documentUndo";
import styles from "./DocumentUndoControls.module.css";

function UndoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M6.2 2.1a.75.75 0 0 1 0 1.06L4.56 4.8H8.5a4.25 4.25 0 1 1 0 8.5H7a.75.75 0 0 1 0-1.5h1.5a2.75 2.75 0 1 0 0-5.5H4.56l1.64 1.64a.75.75 0 1 1-1.06 1.06L2.22 5.72a.75.75 0 0 1 0-1.06l2.92-2.92a.75.75 0 0 1 1.06 0Z"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M7.8 2.1a.75.75 0 0 0 0 1.06L9.44 4.8H5.5a4.25 4.25 0 1 0 0 8.5H7a.75.75 0 0 0 0-1.5H5.5a2.75 2.75 0 1 1 0-5.5h3.94L7.8 7.94a.75.75 0 1 0 1.06 1.06l2.92-2.92a.75.75 0 0 0 0-1.06L8.86 2.1a.75.75 0 0 0-1.06 0Z"
      />
    </svg>
  );
}

/** Minimal undo/redo controls for the story title bar. */
export function DocumentUndoControls() {
  const canUndo = useCanDocumentUndo();
  const canRedo = useCanDocumentRedo();

  return (
    <fieldset className={styles.group} aria-label="Document undo and redo">
      <button
        type="button"
        className={styles.button}
        onClick={() => documentUndo()}
        disabled={!canUndo}
        title="Undo"
        aria-label="Undo"
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => documentRedo()}
        disabled={!canRedo}
        title="Redo"
        aria-label="Redo"
      >
        <RedoIcon />
      </button>
    </fieldset>
  );
}
