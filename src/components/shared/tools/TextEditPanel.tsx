import type { FC } from "react";
import styles from "./TextEditPanel.module.css";

export interface TextEditPanelProps {
  title: string;
  textValue: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitButtonText: string;
  /** Allow empty text (for removing labels from shapes). */
  allowEmpty?: boolean;
  /** Show font-size field (default true). */
  showFontSize?: boolean;
  fontSize?: number;
  onFontSizeChange?: (fontSize: number) => void;
  /** Use a single-line input instead of textarea (e.g. rename). */
  singleLine?: boolean;
  placeholder?: string;
}

export const TextEditPanel: FC<TextEditPanelProps> = ({
  title,
  textValue,
  fontSize = 14,
  onTextChange,
  onFontSizeChange,
  onSubmit,
  onCancel,
  submitButtonText,
  allowEmpty = false,
  showFontSize = true,
  singleLine = false,
  placeholder = "Enter your text here...",
}) => {
  const canSubmit = allowEmpty || !!textValue?.trim();
  return (
    <div className={styles.panel}>
      <div className={styles.title}>{title}</div>

      {showFontSize ? (
        <div className={styles.field}>
          <label htmlFor="fontSizeInput" className={styles.label}>
            Font Size:
          </label>
          <input
            aria-label="Font Size"
            id="fontSizeInput"
            type="number"
            value={fontSize}
            onChange={(e) =>
              onFontSizeChange?.(parseInt(e.target.value, 10) || 14)
            }
            min="8"
            max="72"
            className={styles.numberInput}
          />
        </div>
      ) : null}

      {singleLine ? (
        <input
          type="text"
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
          className={styles.textInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit();
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
        />
      ) : (
        <textarea
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
          className={styles.textarea}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              onSubmit();
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
        />
      )}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.buttonCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={
            canSubmit ? styles.buttonSubmit : styles.buttonSubmitDisabled
          }
        >
          {submitButtonText}
        </button>
      </div>
      <div className={styles.hint}>
        {singleLine
          ? "Press Enter to submit, Escape to cancel"
          : "Press Ctrl+Enter to submit, Escape to cancel"}
      </div>
    </div>
  );
};
