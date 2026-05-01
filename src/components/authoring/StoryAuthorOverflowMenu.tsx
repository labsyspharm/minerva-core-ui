import * as React from "react";
import styled from "styled-components";
import { openAuthorExportDialog } from "@/lib/navigation/authorExportDialog";
import { RETURN_TO_LIBRARY_EVENT } from "@/lib/navigation/returnToLibraryEvent";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { downloadStoryJsonExport } from "@/lib/stores/downloadStoryJson";

const MenuWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

/** Icon-only match to author nav `.hamburger` (no border / focus ring) */
const HamburgButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: auto;
  min-width: 28px;
  padding: 6px 2px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  line-height: 0;
  flex-shrink: 0;
  box-shadow: none;
  transition: opacity 0.15s ease, transform 0.1s ease;

  &:hover {
    opacity: 0.88;
  }

  &[aria-expanded="true"] {
    opacity: 1;
  }

  &:active {
    transform: scale(0.97);
    opacity: 0.82;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: none;
  }
`;

const Dropdown = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? "block" : "none")};
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  min-width: 200px;
  z-index: 50;
  padding: 6px;
  border-radius: var(--radius-0001, 8px);
  border: 1px solid
    color-mix(in srgb, var(--theme-glass-edge, #444) 80%, transparent);
  background-color: color-mix(in srgb, var(--dark-glass, #1a1a1a) 94%, black);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.45),
    0 0 0 1px color-mix(in srgb, white 6%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
`;

const MenuItem = styled.button`
  display: block;
  width: 100%;
  margin: 0;
  padding: 10px 14px;
  border: none;
  border-radius: var(--radius-0001, 6px);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.95em;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: var(--dim-gray-glass);
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, #6ae);
    outline-offset: -2px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const MenuItemDivided = styled(MenuItem)`
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid
    color-mix(in srgb, var(--theme-glass-edge, #444) 65%, transparent);
`;

export type StoryAuthorOverflowMenuProps = {
  authorUiTagName: string;
  exportLabel?: string;
};

/**
 * Hamburger + overflow actions (library, export dialog, JSON download) aligned with the top
 * story chrome; behavior matches the former nav tab-row menu.
 */
export function StoryAuthorOverflowMenu(props: StoryAuthorOverflowMenuProps) {
  const { authorUiTagName, exportLabel = "Export" } = props;
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const waypointsOk = useDocumentStore((s) => s.waypoints.length > 0);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const w = wrapRef.current;
      if (w && !w.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <MenuWrap ref={wrapRef}>
      <HamburgButton
        type="button"
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 14"
          width="20"
          height="14"
          aria-hidden="true"
        >
          <rect x="0" y="0" width="20" height="2" rx="1" fill="currentColor" />
          <rect x="0" y="6" width="20" height="2" rx="1" fill="currentColor" />
          <rect x="0" y="12" width="20" height="2" rx="1" fill="currentColor" />
        </svg>
      </HamburgButton>
      <Dropdown $open={open} role="menu" aria-hidden={!open}>
        <MenuItem
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            close();
            window.dispatchEvent(new CustomEvent(RETURN_TO_LIBRARY_EVENT));
          }}
        >
          Return to Library
        </MenuItem>
        <MenuItemDivided
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            close();
            openAuthorExportDialog(authorUiTagName);
          }}
        >
          {exportLabel}
        </MenuItemDivided>
        <MenuItemDivided
          type="button"
          role="menuitem"
          disabled={!waypointsOk}
          onClick={(e) => {
            e.stopPropagation();
            if (!waypointsOk) return;
            close();
            downloadStoryJsonExport(
              useDocumentStore.getState().toDocumentData(),
            );
          }}
        >
          Save document as JSON
        </MenuItemDivided>
      </Dropdown>
    </MenuWrap>
  );
}
