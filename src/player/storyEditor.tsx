import "../../index.css";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot, type Root } from "react-dom/client";
import { Main } from "@/components/Main";
import { getDemoMainProps } from "@/lib/persistence/demo";
import { getStoryRecord } from "@/lib/persistence/storyPersistence";
import { useAppStore } from "@/lib/stores/appStore";
import { importStoryFromUrl } from "@/lib/storyExport/importStoryFolder";
import {
  createAppRouter,
  parsePreferredStoryIdFromLocation,
} from "@/router/appRouter";

// Stable array reference, as in index.tsx (FileHandler restore effect deps).
const OME_TIFF_HANDLE_KEYS = ["img-1"];

/**
 * Copy the published story into this site's library and name the copy in
 * `?storyid=`, so the editor opens it and a reload keeps editing it.
 */
export async function beginEditing(documentUrl: string): Promise<void> {
  useAppStore.getState().resetStoryViewerSession();
  const storyId = await importStoryFromUrl(documentUrl);
  const url = new URL(window.location.href);
  url.searchParams.set("storyid", storyId);
  window.history.replaceState(window.history.state, "", url);
}

/** True when `?storyid=` names a story in this site's library (a reload while editing). */
export async function isEditingOnThisPage(): Promise<boolean> {
  const storyId = parsePreferredStoryIdFromLocation();
  if (!storyId) return false;
  try {
    return !!(await getStoryRecord(storyId));
  } catch {
    return false;
  }
}

/** Mount the author app in `root`, as index.tsx does; it opens `?storyid=`. */
export function mountEditor(root: HTMLElement): Root {
  // Theme rules for the author app are scoped to `#react-output`.
  const host = document.createElement("div");
  host.id = "react-output";
  root.replaceChildren(host);
  const reactRoot = createRoot(host);
  const router = createAppRouter(Main, {
    handleKeys: OME_TIFF_HANDLE_KEYS,
    ...getDemoMainProps(),
  });
  reactRoot.render(<RouterProvider router={router} />);
  return reactRoot;
}
