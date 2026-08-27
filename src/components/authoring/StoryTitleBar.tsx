import * as React from "react";
import { DocumentUndoControls } from "@/components/authoring/DocumentUndoControls";
import { StoryAuthorOverflowMenu } from "@/components/authoring/StoryAuthorOverflowMenu";
import PlayIcon from "@/components/shared/icons/play.svg?react";
import {
  minervaThemeBarClassName,
  minervaThemeClusterClassName,
  minervaThemeControlClassName,
  minervaThemeFieldClassName,
  StorySpines,
} from "@/components/shared/minervaTheme";
import { saveStoryDocument } from "@/lib/persistence/storyPersistence";
import { useDocumentStore } from "@/lib/stores/documentStore";
import styles from "./StoryTitleBar.module.css";

export type StoryTitleBarProps = {
  onReturnToLibrary: () => void;
  onExport?: () => void;
  onEnterPlaybackPreview?: () => void;
  playbackPreviewDisabled?: boolean;
};

export function StoryTitleBar(props: StoryTitleBarProps) {
  const {
    onReturnToLibrary,
    onExport,
    onEnterPlaybackPreview,
    playbackPreviewDisabled,
  } = props;
  const titleText = useDocumentStore((s) => s.metadata.title ?? "");
  const storyId = useDocumentStore((s) => s.activeStoryId ?? "");
  const setMetadata = useDocumentStore((s) => s.setMetadata);
  const fieldId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [editing, setEditing] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState("");
  const inputSize = Math.min(200, Math.max(16, (draftTitle.length || 13) + 2));

  React.useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }, [editing]);

  return (
    <section
      className={`${minervaThemeBarClassName} ${styles.banner}`}
      aria-label="Story title"
    >
      <div className={minervaThemeClusterClassName}>
        {onExport ? (
          <StoryAuthorOverflowMenu
            onReturnToLibrary={onReturnToLibrary}
            onExport={onExport}
          />
        ) : null}
        <DocumentUndoControls />
      </div>
      <label
        className={styles.titleFieldWrap}
        htmlFor={editing ? fieldId : undefined}
      >
        <StorySpines seed={storyId} />
        {editing ? (
          <input
            ref={inputRef}
            id={fieldId}
            className={`${minervaThemeFieldClassName} ${styles.titleInput}`}
            type="text"
            size={inputSize}
            value={draftTitle}
            placeholder="Untitled story"
            aria-label="Story title"
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={(e) => {
              setEditing(false);
              const trimmed = e.target.value.trim();
              if (trimmed !== titleText) {
                setMetadata({ title: trimmed });
              }
              void (async () => {
                const s = useDocumentStore.getState();
                const id = s.activeStoryId;
                if (!id) return;
                await saveStoryDocument(id, s.toDocumentData());
              })();
            }}
            autoComplete="off"
            spellCheck={false}
          />
        ) : (
          <button
            type="button"
            className={`${minervaThemeFieldClassName} ${styles.titleDisplay}`}
            aria-label="Story title"
            onClick={() => {
              setDraftTitle(titleText);
              setEditing(true);
            }}
          >
            {titleText.trim() ? (
              titleText
            ) : (
              <span className={styles.titlePlaceholder}>Untitled story</span>
            )}
          </button>
        )}
      </label>
      {onEnterPlaybackPreview ? (
        <button
          type="button"
          className={minervaThemeControlClassName}
          onClick={onEnterPlaybackPreview}
          disabled={playbackPreviewDisabled}
          title={
            playbackPreviewDisabled
              ? "Add a waypoint to preview"
              : "Preview playback"
          }
          aria-label={
            playbackPreviewDisabled
              ? "Add a waypoint to preview"
              : "Preview playback"
          }
        >
          <PlayIcon width={14} height={14} aria-hidden />
        </button>
      ) : null}
    </section>
  );
}
