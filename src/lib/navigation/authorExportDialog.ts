/** Matches `EXPORT-DIALOG` in `nav-config` / nav overflow menu. */
export const AUTHOR_EXPORT_DIALOG_ID = "EXPORT-DIALOG";

export type AuthorChromeElement = HTMLElement & {
  elementState?: { dialog?: string };
};

/** Opens the author export path dialog on the root `author-*` custom element. */
export function openAuthorExportDialog(
  authorUiTagName: string | undefined,
): void {
  if (!authorUiTagName) return;
  const el = document.querySelector(
    authorUiTagName,
  ) as AuthorChromeElement | null;
  if (el?.elementState) {
    el.elementState.dialog = AUTHOR_EXPORT_DIALOG_ID;
  }
}
