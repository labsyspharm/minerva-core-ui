import * as React from "react";
import styled from "styled-components";
import { StoryAuthorOverflowMenu } from "@/components/authoring/StoryAuthorOverflowMenu";
import PlayIcon from "@/components/shared/icons/play.svg?react";
import { storyChromeBannerBarCss } from "@/components/shared/storyChromeBanner";
import { saveStoryDocument } from "@/lib/persistence/storyPersistence";
import { useDocumentStore } from "@/lib/stores/documentStore";

const BannerShell = styled.div`
  position: relative;
  z-index: 20;
  ${storyChromeBannerBarCss}
`;

const TitleFieldWrap = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
`;

const TitleInput = styled.input`
  box-sizing: border-box;
  margin: 0;
  padding: 2px 6px;
  width: 100%;
  min-width: 0;
  max-width: min(720px, 100%);
  field-sizing: content;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgb(248 250 252 / 0.98);
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-align: center;
  font-family: inherit;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &::placeholder {
    color: rgb(255 255 255 / 0.4);
    font-weight: 500;
  }

  &:focus {
    outline: none;
    cursor: text;
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: 2px;
  }

  &:read-only {
    cursor: text;
    user-select: none;
  }
`;

const BannerPreviewButton = styled.button`
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

export type StoryTitleBarProps = {
  /** Registered `author-*` custom element tag; powers export dialog + overflow menu. */
  authorUiTagName?: string;
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
  const { authorUiTagName, onEnterPlaybackPreview, playbackPreviewDisabled } =
    props;
  /** Subscribe to the title primitive so updates re-render even if metadata identity were ever reused. */
  const titleText = useDocumentStore((s) => s.metadata.title ?? "");
  const setMetadata = useDocumentStore((s) => s.setMetadata);
  const fieldId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [editing, setEditing] = React.useState(false);
  /** Approximate width for browsers without `field-sizing: content` on `<input>`. */
  const inputSize = Math.min(200, Math.max(14, titleText.length || 13));

  React.useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }, [editing]);

  return (
    <BannerShell role="region" aria-label="Story title">
      {authorUiTagName ? (
        <StoryAuthorOverflowMenu authorUiTagName={authorUiTagName} />
      ) : null}
      <TitleFieldWrap
        onClick={() => {
          if (!editing) setEditing(true);
        }}
      >
        <TitleInput
          ref={inputRef}
          id={fieldId}
          type="text"
          size={inputSize}
          readOnly={!editing}
          value={titleText}
          placeholder="Untitled story"
          aria-label="Story title"
          onChange={(e) => setMetadata({ title: e.target.value })}
          onBlur={(e) => {
            setEditing(false);
            const raw = e.target.value;
            const trimmed = raw.trim();
            if (trimmed !== raw) setMetadata({ title: trimmed });
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
      </TitleFieldWrap>
      {onEnterPlaybackPreview ? (
        <BannerPreviewButton
          type="button"
          onClick={onEnterPlaybackPreview}
          disabled={playbackPreviewDisabled}
          title="Preview playback"
          aria-label="Preview playback"
        >
          <PlayIcon width={14} height={14} aria-hidden />
        </BannerPreviewButton>
      ) : null}
    </BannerShell>
  );
}
