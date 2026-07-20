import { css } from "styled-components";

/**
 * Shared top story banner strip (author title bar + preview-mode ribbon).
 * One source of truth for padding/height so author and preview match.
 * {@link STORY_BANNER_CONTROL_SIZE_PX} is the play / Back control height.
 */
export const STORY_BANNER_CONTROL_SIZE_PX = 28;

export const storyBannerBarCss = css`
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
  /* 5 + 28 + 5 — same total height whether the bar has Back / play / title-only. */
  min-height: ${5 + STORY_BANNER_CONTROL_SIZE_PX + 5}px;
  padding: 5px 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  /* Solid fallback so CDN (no author-ui globals) never drops the ribbon bar. */
  background: var(
    --dark-main-glass,
    color-mix(in xyz, var(--theme-dark-main-color, hwb(240 10% 50%)), transparent 60%)
  );
  border-bottom: 1px solid rgb(255 255 255 / 0.18);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 0 -1px 0 rgb(0 0 0 / 0.15);
`;

/**
 * Title type metrics shared by author input + preview ribbon label.
 * Use line-height: 1 — larger line-boxes leave empty descender space that
 * makes glyphs look high when the box is flex-centered in the bar.
 */
export const storyBannerTitleTextCss = css`
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  font-family: inherit;
`;
