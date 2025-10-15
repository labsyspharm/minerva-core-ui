import * as React from "react";
import ReactMarkdown from 'react-markdown';
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  title: string;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  compact?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  title,
  content,
  onContentChange,
  onSave,
  onCancel,
  isEditing,
  onToggleEdit,
  compact = false
}) => {
  const [editContent, setEditContent] = React.useState(content);

  // Update edit content when content prop changes
  React.useEffect(() => {
    setEditContent(content);
  }, [content]);

  const handleSave = () => {
    onContentChange(editContent);
    onSave();
  };

  const handleCancel = () => {
    setEditContent(content); // Reset to original content
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <div className={`${styles.markdownEditor} ${compact ? styles.compact : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={compact ? styles.titleCompact : styles.title}>{title}</h3>
        <div className={styles.headerActions}>
          {!isEditing ? (
            <button
              className={styles.button}
              onClick={onToggleEdit}
              title="Edit content"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              Edit
            </button>
          ) : (
            <div className={styles.editActions}>
              <button
                className={`${styles.button} ${styles.cancelButton}`}
                onClick={handleCancel}
                title="Cancel editing"
              >
                Cancel
              </button>
              <button
                className={`${styles.button} ${styles.saveButton}`}
                onClick={handleSave}
                title="Save changes (Ctrl+Enter)"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {isEditing ? (
          <textarea
            className={styles.textarea}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter markdown content here..."
            autoFocus
          />
        ) : (
          <div className={styles.markdownContent}>
            {content.trim() ? (
              <ReactMarkdown
                components={{
                  // Customize markdown rendering
                  h1: ({children}) => <h1 className={styles.markdownH1}>{children}</h1>,
                  h2: ({children}) => <h2 className={styles.markdownH2}>{children}</h2>,
                  h3: ({children}) => <h3 className={styles.markdownH3}>{children}</h3>,
                  p: ({children}) => <p className={styles.markdownP}>{children}</p>,
                  ul: ({children}) => <ul className={styles.markdownUl}>{children}</ul>,
                  ol: ({children}) => <ol className={styles.markdownOl}>{children}</ol>,
                  li: ({children}) => <li className={styles.markdownLi}>{children}</li>,
                  strong: ({children}) => <strong className={styles.markdownStrong}>{children}</strong>,
                  em: ({children}) => <em className={styles.markdownEm}>{children}</em>,
                  code: ({children}) => <code className={styles.markdownCode}>{children}</code>,
                  pre: ({children}) => <pre className={styles.markdownPre}>{children}</pre>,
                  blockquote: ({children}) => <blockquote className={styles.markdownBlockquote}>{children}</blockquote>,
                }}
              >
                {content}
              </ReactMarkdown>
            ) : (
              <div className={styles.emptyContent}>
                <p>No content yet. Click "Edit" to add markdown content.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with shortcuts */}
      {isEditing && (
        <div className={styles.footer}>
          <small className={styles.shortcuts}>
            Press <kbd>Ctrl+Enter</kbd> to save, <kbd>Escape</kbd> to cancel
          </small>
        </div>
      )}
    </div>
  );
};

export { MarkdownEditor };
export type { MarkdownEditorProps };
