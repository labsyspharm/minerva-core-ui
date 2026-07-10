import type { FC } from "react";

export interface TextEditPanelProps {
  title: string;
  textValue: string;
  fontSize: number;
  onTextChange: (text: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitButtonText: string;
  /** Allow empty text (for removing labels from shapes). */
  allowEmpty?: boolean;
}

export const TextEditPanel: FC<TextEditPanelProps> = ({
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
          aria-label="Font Size"
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
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#999" }}>
        Press Ctrl+Enter to submit, Escape to cancel
      </div>
    </div>
  );
};
