import { css } from "styled-components";

/**
 * Shared top “story chrome” strip (author title bar + preview-mode ribbon).
 * One source of truth for padding/height so author and preview match.
 */
export const storyChromeBannerBarCss = css`
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 5px 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  background: var(
    --dark-main-glass,
    color-mix(in xyz, var(--theme-dark-main-color, navy), transparent 20%)
  );
  border-bottom: 1px solid rgb(255 255 255 / 0.18);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 0 -1px 0 rgb(0 0 0 / 0.15);
`;
