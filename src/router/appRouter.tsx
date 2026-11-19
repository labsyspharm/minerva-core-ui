import {
  createRootRoute,
  createRouter,
  getRouteApi,
  useLocation,
} from "@tanstack/react-router";
import type { ComponentType } from "react";
import * as React from "react";
import { z } from "zod";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { classifyViewerLaunchUrl } from "@/lib/viewer/launchUrl";

/**
 * The app's whole query: `?storyid=<uuid>` names a library story; `?src=<url>`
 * opens a story JSON, OME-TIFF or DICOMweb series as a library story. The
 * address bar keeps `?src=`; the story it opened is `srcStoryId` in history
 * state.
 */
type RootSearch = { storyid?: string; src?: string };

const uuidSchema = z.string().uuid();

/**
 * `src` is everything after `src=`, verbatim, so the address bar reads
 * `?src=https://…/document.json` and a signed URL keeps its own `&…`.
 * Invalid values are dropped.
 */
export function parseRootSearch(search: string): RootSearch {
  const query = search.replace(/^\?/, "");
  const srcAt = /(?:^|&)src=/.exec(query);
  const out: RootSearch = {};
  const storyid = new URLSearchParams(
    srcAt ? query.slice(0, srcAt.index) : query,
  ).get("storyid");
  if (storyid && uuidSchema.safeParse(storyid).success) out.storyid = storyid;
  const src = srcAt ? query.slice(srcAt.index + srcAt[0].length).trim() : "";
  if (src && classifyViewerLaunchUrl(src)) out.src = src;
  return out;
}

/** Inverse of {@link parseRootSearch}: `src` goes last, as written. */
function stringifyRootSearch({ storyid, src }: RootSearch): string {
  const parts: string[] = [];
  if (storyid) parts.push(`storyid=${storyid}`);
  if (src) parts.push(`src=${src}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const rootRouteApi = getRouteApi("__root__");

/**
 * The library story a location names: `?storyid=`, else the story a `?src=`
 * entry was opened as. Null means the library (or a `?src=` not yet opened).
 */
function storyIdForLocation(
  search: RootSearch,
  historyState: unknown,
): string | null {
  if (search.storyid) return search.storyid;
  if (!search.src) return null;
  const id = uuidSchema.safeParse(
    (historyState as { srcStoryId?: unknown } | null)?.srcStoryId,
  );
  return id.success ? id.data : null;
}

/** {@link storyIdForLocation} for the router's current location. */
export function useUrlStoryId(): string | null {
  return useLocation({
    select: (l) => storyIdForLocation(l.search as RootSearch, l.state),
  });
}

/**
 * `?src=` of the router's current location. Read it here, not with
 * `rootRouteApi.useSearch()`: on back/forward the route match keeps the old
 * search for a render, so the library would see the `src` it just left and
 * open it again.
 */
export function useUrlSrc(): string | undefined {
  return useLocation({ select: (l) => (l.search as RootSearch).src });
}

/**
 * Opens the story the URL names, and closes it when the URL names none, so
 * back/forward and "Return to Library" move between the library and stories.
 * Navigation that opens a story itself (the library) switches the store
 * first; this then sees a match.
 */
export function StoryIdUrlSync() {
  const urlStoryId = useUrlStoryId();
  const navigate = rootRouteApi.useNavigate();
  const wantRef = React.useRef(urlStoryId);
  const queueRef = React.useRef(Promise.resolve());

  React.useEffect(() => {
    wantRef.current = urlStoryId;
    // One step at a time, each toward the latest URL.
    queueRef.current = queueRef.current
      .then(async () => {
        const want = wantRef.current;
        const doc = useDocumentStore.getState();
        if (want === doc.activeStoryId) return;
        useAppStore.getState().resetStoryViewerSession();
        if (want === null) return doc.closeStory();
        try {
          await doc.switchStory(want);
        } catch {
          // Not in this library (deleted, or another browser's id). A `?src=`
          // entry falls back to opening its source again.
          navigate({
            search: (prev: RootSearch) => ({ src: prev.src }),
            replace: true,
          } as never);
        }
      })
      .catch((e) => console.error("[StoryIdUrlSync]", e));
  }, [urlStoryId, navigate]);

  return null;
}

/** Strip trailing slash and trailing `/index.html` (GitHub Pages). */
function normalizeLoadedPathname(pathname: string): string {
  let path = pathname.replace(/\/$/, "") || "/";
  if (path.endsWith("/index.html")) {
    path = path.slice(0, -"/index.html".length).replace(/\/$/, "") || "/";
  }
  return path === "" ? "/" : path;
}

/**
 * With `base: './'`, TanStack `basepath` must be the **static deploy directory**, not extra pathname segments.
 * This app only uses query (`?storyid=`), so `/repo/extra` should still use basename `/repo`.
 * Exception: GitHub Pages PR previews live under `…/pr-preview/pr-<n>/` ([rossjrw/pr-preview-action]), which must be kept in full.
 */
function deploymentBasenameFromNormalizedPath(normalizedPath: string): string {
  if (normalizedPath === "/") return "/";
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) return "/";

  const prPreviewIdx = segments.indexOf("pr-preview");
  const next = segments[prPreviewIdx + 1];
  if (prPreviewIdx >= 0 && next !== undefined && /^pr-\d+$/.test(next)) {
    return `/${segments.slice(0, prPreviewIdx + 2).join("/")}`;
  }

  return `/${segments[0]}`;
}

export function routerBasepath(): string {
  const b =
    typeof import.meta.env.BASE_URL === "string"
      ? import.meta.env.BASE_URL
      : "/";
  // `base: './'` — derive deploy folder from `location` (see TanStack basepath).
  if (b === "./") {
    if (typeof window === "undefined") return "/";
    const path = normalizeLoadedPathname(window.location.pathname);
    return deploymentBasenameFromNormalizedPath(path);
  }
  const trimmed = b.replace(/\/$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * `Main` is passed from the entry module so this file does not import `@/components/Main`
 * (avoids a circular dependency with `main.tsx` importing from here).
 */
export function createAppRouter<P extends object>(
  MainComponent: ComponentType<P>,
  mainProps: P,
) {
  const rootRoute = createRootRoute({
    component: function RootLayout() {
      return <MainComponent {...mainProps} />;
    },
  });

  return createRouter({
    routeTree: rootRoute,
    basepath: routerBasepath(),
    parseSearch: parseRootSearch,
    stringifySearch: stringifyRootSearch,
  } as never);
}
