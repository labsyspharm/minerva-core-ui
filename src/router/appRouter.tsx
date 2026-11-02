import {
  createRootRoute,
  createRouter,
  getRouteApi,
} from "@tanstack/react-router";
import type { ComponentType } from "react";
import * as React from "react";
import { z } from "zod";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { classifyViewerLaunchUrl } from "@/lib/viewer/launchUrl";

/**
 * The app's whole query: `?storyid=<uuid>` names a library story; `?src=<url>`
 * opens a story JSON, OME-TIFF or DICOMweb series (and becomes a `storyid`).
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
 * Keeps `?storyid=` in sync with {@link useDocumentStore}'s `activeStoryId` while a
 * story is open, and opens the story the URL names (back/forward, edited URL).
 */
export function StoryIdUrlSync() {
  const search = rootRouteApi.useSearch();
  const navigate = rootRouteApi.useNavigate();
  const activeStoryId = useDocumentStore((s) => s.activeStoryId);
  const switchStory = useDocumentStore((s) => s.switchStory);

  React.useEffect(() => {
    const sid = search.storyid;
    if (sid === undefined || activeStoryId === sid) return;
    // Back in the library (e.g. right after "Return to Library"): drop the
    // stale id rather than reopen the story we just left.
    if (activeStoryId === null) {
      navigate({ search: {}, replace: true } as never);
      return;
    }
    void (async () => {
      useAppStore.getState().resetStoryViewerSession();
      try {
        await switchStory(sid);
      } catch {
        navigate({ search: {}, replace: true } as never);
      }
    })();
  }, [search.storyid, activeStoryId, switchStory, navigate]);

  React.useEffect(() => {
    if (activeStoryId === null) return;
    if (search.storyid === activeStoryId && search.src === undefined) return;
    navigate({ search: { storyid: activeStoryId }, replace: true } as never);
  }, [activeStoryId, navigate, search.storyid, search.src]);

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
