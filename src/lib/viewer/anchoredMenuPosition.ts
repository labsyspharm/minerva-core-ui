const VIEWPORT_MARGIN = 8;

/**
 * Viewport position for a `position: fixed` menu anchored to `anchor`.
 * Opens below when the menu fits, else above, else clamps on-screen;
 * `align: "end"` lines up right edges instead of left.
 */
export function anchoredMenuPosition(
  anchor: DOMRect,
  menu: { width: number; height: number },
  opts: { gap?: number; align?: "start" | "end" } = {},
): { top: number; left: number } {
  const { gap = 4, align = "start" } = opts;
  const maxTop = window.innerHeight - VIEWPORT_MARGIN - menu.height;
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - menu.height;
  let top = below;
  if (below > maxTop) {
    top = above >= VIEWPORT_MARGIN ? above : maxTop;
  }
  const left = align === "end" ? anchor.right - menu.width : anchor.left;
  const maxLeft = window.innerWidth - VIEWPORT_MARGIN - menu.width;
  return {
    top: Math.max(VIEWPORT_MARGIN, top),
    left: Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft)),
  };
}
