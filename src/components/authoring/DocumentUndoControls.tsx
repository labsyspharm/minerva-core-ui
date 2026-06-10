import { faRotateLeft, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styled from "styled-components";
import {
  documentRedo,
  documentUndo,
  useCanDocumentRedo,
  useCanDocumentUndo,
} from "@/lib/stores/documentUndo";

const UndoRedoGroup = styled.div`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const UndoRedoButton = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  box-sizing: border-box;
  background: rgb(0 0 0 / 0.16);
  border: 1px solid rgb(255 255 255 / 0.22);
  border-radius: 5px;
  color: rgb(248 250 252 / 0.98);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgb(0 0 0 / 0.26);
    border-color: rgb(255 255 255 / 0.28);
    color: #fff;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: 2px;
  }
`;

/** Minimal undo/redo controls for the story title bar. */
export function DocumentUndoControls() {
  const canUndo = useCanDocumentUndo();
  const canRedo = useCanDocumentRedo();

  return (
    <UndoRedoGroup aria-label="Document undo and redo">
      <UndoRedoButton
        type="button"
        onClick={() => documentUndo()}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        aria-label="Undo"
      >
        <FontAwesomeIcon icon={faRotateLeft} width={14} height={14} />
      </UndoRedoButton>
      <UndoRedoButton
        type="button"
        onClick={() => documentRedo()}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        aria-label="Redo"
      >
        <FontAwesomeIcon icon={faRotateRight} width={14} height={14} />
      </UndoRedoButton>
    </UndoRedoGroup>
  );
}
