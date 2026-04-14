import * as React from "react";
import styled from "styled-components";
import { useDocumentStore } from "@/lib/stores/documentStore";

/** Matches `grid-template-columns` first track in `author.module.css` (author shell). */
const AUTHOR_PANEL_EM = 30;

/**
 * Flush to the top of the shell. Horizontally centered by default; in author mode, nudges
 * right only when the bar would overlap the left authoring column (see overlap effect).
 */
const Overlay = styled.div<{ $nudgeX: number }>`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(calc(-50% + ${(p) => p.$nudgeX}px));
  max-width: calc(100% - 32px);
  width: fit-content;
  min-width: 0;
  z-index: 20;
  pointer-events: none;
  box-sizing: border-box;

  & > * {
    pointer-events: auto;
  }
`;

const TitleShell = styled.div`
  position: relative;
  display: inline-block;
  vertical-align: top;
  max-width: 100%;
`;

const TitleBody = styled.div<{ $editable: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  min-height: 40px;
  box-sizing: border-box;
  background: rgb(0 0 0);
  border: 2px solid rgb(255 255 255 / 0.24);
  border-top: none;
  border-radius: 0 0 20px 20px;
  padding: 0;
  cursor: ${(p) => (p.$editable ? "text" : "default")};
`;

const TitleInput = styled.input`
  box-sizing: border-box;
  margin: 0;
  padding: 5px 10px;
  min-width: 15ch;
  width: auto;
  max-width: 100%;
  field-sizing: content;
  background: transparent;
  border: none;
  border-radius: 0 0 18px 18px;
  color: rgb(248 250 252 / 0.98);
  font-size: 15px;
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

  &:read-only {
    cursor: text;
    user-select: none;
  }
`;

const TitleReadonly = styled.div`
  box-sizing: border-box;
  margin: 0;
  padding: 10px 10px 12px;
  color: rgb(248 250 252 / 0.96);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

export type AppStoryTitleBarProps = {
  /** When false, show read-only title (e.g. presentation / playback preview). */
  editable: boolean;
};

/**
 * Centered document story title (`metadata.title`) overlaid at the top of the app shell.
 * In author mode: click to edit, blur to lock.
 */
export function AppStoryTitleBar(props: AppStoryTitleBarProps) {
  const { editable } = props;
  /** Subscribe to the title primitive so updates re-render even if metadata identity were ever reused. */
  const titleText = useDocumentStore((s) => s.metadata.title ?? "");
  const setMetadata = useDocumentStore((s) => s.setMetadata);
  const fieldId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const [nudgeX, setNudgeX] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  /** Approximate width for browsers without `field-sizing: content` on `<input>`. */
  const inputSize = Math.min(200, Math.max(14, titleText.length || 13));

  /** Center on the shell by default; nudge right only when math says the centered pill would overlap the 30em author column. ResizeObserver picks up title width changes. */
  React.useLayoutEffect(() => {
    if (!editable) {
      setNudgeX(0);
      return;
    }
    const el = overlayRef.current;
    if (!el) return;

    const gapPx = 8;
    /** Nudge so the island stays right of the author column; derived from centered geometry (stable, no feedback loop). */
    const measure = () => {
      const rootFont =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const panelPx = AUTHOR_PANEL_EM * rootFont;
      const threshold = gapPx + panelPx;
      const parent = el.offsetParent ?? el.parentElement;
      if (!parent) return;
      const pr = parent.getBoundingClientRect();
      const shellW = el.getBoundingClientRect().width;
      const pillW = shellW;
      const leftIfViewportCentered = pr.left + pr.width / 2 - pillW / 2;
      const next =
        leftIfViewportCentered < threshold
          ? Math.ceil(threshold - leftIfViewportCentered)
          : 0;
      setNudgeX(next);
    };

    measure();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [editable]);

  React.useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }, [editing]);

  if (!editable) {
    return (
      <Overlay $nudgeX={0} role="region" aria-label="Story title">
        <TitleShell>
          <TitleBody $editable={false}>
            <TitleReadonly>
              {titleText.trim() ? titleText.trim() : "Untitled story"}
            </TitleReadonly>
          </TitleBody>
        </TitleShell>
      </Overlay>
    );
  }

  return (
    <Overlay
      ref={overlayRef}
      $nudgeX={nudgeX}
      role="region"
      aria-label="Story title"
    >
      <TitleShell>
        <TitleBody
          $editable
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
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </TitleBody>
      </TitleShell>
    </Overlay>
  );
}
