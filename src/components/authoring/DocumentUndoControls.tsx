import RedoIcon from "@/components/shared/icons/redo.svg?react";
import UndoIcon from "@/components/shared/icons/undo.svg?react";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import {
  documentRedo,
  documentUndo,
  useCanDocumentRedo,
  useCanDocumentUndo,
} from "@/lib/stores/documentUndo";
import styles from "./DocumentUndoControls.module.css";

/** Minimal undo/redo controls for the story title bar. */
export function DocumentUndoControls() {
  const canUndo = useCanDocumentUndo();
  const canRedo = useCanDocumentRedo();

  return (
    <fieldset
      className={styles.clusterFieldset}
      aria-label="Document undo and redo"
    >
      <PanelIconButton
        onClick={() => documentUndo()}
        disabled={!canUndo}
        title="Undo"
        aria-label="Undo"
      >
        <UndoIcon aria-hidden />
      </PanelIconButton>
      <PanelIconButton
        onClick={() => documentRedo()}
        disabled={!canRedo}
        title="Redo"
        aria-label="Redo"
      >
        <RedoIcon aria-hidden />
      </PanelIconButton>
    </fieldset>
  );
}
