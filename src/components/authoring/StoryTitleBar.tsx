import * as React from "react";
import { DocumentUndoControls } from "@/components/authoring/DocumentUndoControls";
import { StoryAuthorOverflowMenu } from "@/components/authoring/StoryAuthorOverflowMenu";
import PlayIcon from "@/components/shared/icons/play.svg?react";
import {
  StoryBannerBar,
  storyBannerTitleClassName,
} from "@/components/shared/StoryBannerBar";
import { saveStoryDocument } from "@/lib/persistence/storyPersistence";
import { useDocumentStore } from "@/lib/stores/documentStore";
import styles from "./StoryTitleBar.module.css";

export type StoryTitleBarProps = {
  onReturnToLibrary: () => void;
  onExport?: () => void;
  onEnterPlaybackPreview?: () => void;
  /** When true, disables the preview control (e.g. no waypoints). */
  playbackPreviewDisabled?: boolean;
};

/**
 * Full-width story title (`metadata.title`) at the top of the shell, matching the preview ribbon,
 * plus author-only overflow (library / export / JSON) beside the playback control row.
 * Editable in author mode only — when playback preview is active, the title is shown in
 * `Presentation`’s ribbon instead; this component is not mounted then.
 */
export function StoryTitleBar(props: StoryTitleBarProps) {
  const {
    onReturnToLibrary,
    onExport,
    onEnterPlaybackPreview,
    playbackPreviewDisabled,
  } = props;
  /** Subscribe to the title primitive so updates re-render even if metadata identity were ever reused. */
  const titleText = useDocumentStore((s) => s.metadata.title ?? "");
  const setMetadata = useDocumentStore((s) => s.setMetadata);
  const fieldId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [editing, setEditing] = React.useState(false);
  /** Local draft while focused so keystrokes are one undo step on blur, not per character. */
  const [draftTitle, setDraftTitle] = React.useState("");
  const displayTitle = editing ? draftTitle : titleText;
  /** Approximate width for browsers without `field-sizing: content` on `<input>`. */
  const inputSize = Math.min(200, Math.max(14, displayTitle.length || 13));

  React.useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }, [editing]);

  return (
    <StoryBannerBar
      as="section"
      className={styles.bannerShell}
      aria-label="Story title"
    >
      {onExport ? (
        <StoryAuthorOverflowMenu
          onReturnToLibrary={onReturnToLibrary}
          onExport={onExport}
        />
      ) : null}
      <DocumentUndoControls />
      <label className={styles.titleFieldWrap} htmlFor={fieldId}>
        <input
          ref={inputRef}
          id={fieldId}
          className={`${storyBannerTitleClassName} ${styles.titleInput}`}
          type="text"
          size={inputSize}
          readOnly={!editing}
          value={displayTitle}
          placeholder="Untitled story"
          aria-label="Story title"
          onFocus={() => {
            if (!editing) {
              setDraftTitle(titleText);
              setEditing(true);
            }
          }}
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
      </label>
      {onEnterPlaybackPreview ? (
        <button
          type="button"
          className={styles.previewButton}
          onClick={onEnterPlaybackPreview}
          disabled={playbackPreviewDisabled}
          title="Preview playback"
          aria-label="Preview playback"
        >
          <PlayIcon width={14} height={14} aria-hidden />
        </button>
      ) : null}
    </StoryBannerBar>
  );
}
