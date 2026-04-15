import {
  createRootRoute,
  createRouter,
  getRouteApi,
} from "@tanstack/react-router";
import type { ComponentType } from "react";
import * as React from "react";
import { z } from "zod";
import { useDocumentStore } from "@/lib/stores/documentStore";

const storySearchSchema = z.object({
  storyid: z.string().uuid().optional(),
});

/** Root route search: optional Dexie story UUID in `storyid`. */
export function parseRootSearch(raw: Record<string, unknown>) {
  const r = storySearchSchema.safeParse(raw);
  if (!r.success) return {};
  return { storyid: r.data.storyid } as { storyid?: string };
}

const uuidParamSchema = z.string().uuid();

/**
 * Reads optional `storyid` (Dexie story UUID) from the current location search params.
 * Invalid values are treated as absent.
 */
export function parsePreferredStoryIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("storyid");
  if (raw === null || raw === "") return null;
  const r = uuidParamSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export const rootRouteApi = getRouteApi("__root__");

/**
 * Keeps `?storyid=<Dexie story uuid>` in sync with {@link useDocumentStore}'s `activeStoryId`
 * while a story is open. Does **not** write `storyid` when `activeStoryId` is null (Minerva Library).
 */
export function StoryIdUrlSync() {
  const search = rootRouteApi.useSearch();
  const navigate = rootRouteApi.useNavigate();
  const activeStoryId = useDocumentStore((s) => s.activeStoryId);
  const switchStory = useDocumentStore((s) => s.switchStory);

  React.useEffect(() => {
    const sid = search.storyid;
    if (sid === undefined) return;
    if (activeStoryId === sid) return;
    /**
     * Library / cleared document: store has no active story but the URL still has
     * `?storyid=` (e.g. right after "Return to Library" before navigate). Strip the
     * param — do not call `switchStory`, which would reload the story we left.
     */
    if (activeStoryId === null) {
      navigate({
        search: (prev: { storyid?: string }) => {
          const next = { ...prev };
          delete next.storyid;
          return next;
        },
        replace: true,
      } as never);
      return;
    }
    void switchStory(sid).catch(() => {
      navigate({
        search: (prev: { storyid?: string }) => {
          const next = { ...prev };
          delete next.storyid;
          return next;
        },
        replace: true,
      } as never);
    });
  }, [search.storyid, activeStoryId, switchStory, navigate]);

  React.useEffect(() => {
    if (activeStoryId === null) return;
    if (search.storyid === activeStoryId) return;
    navigate({
      search: (prev: { storyid?: string }) => ({
        ...prev,
        storyid: activeStoryId,
      }),
      replace: true,
    } as never);
  }, [activeStoryId, navigate, search.storyid]);

  return null;
}

function routerBasepath(): string {
  const b =
    typeof import.meta.env?.BASE_URL === "string"
      ? import.meta.env.BASE_URL
      : "/";
  const trimmed = b.replace(/\/$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * `Main` is passed from the entry module so this file does not import `@/components/main`
 * (avoids a circular dependency with `main.tsx` importing from here).
 */
export function createAppRouter<P extends object>(
  MainComponent: ComponentType<P>,
  mainProps: P,
) {
  const rootRoute = createRootRoute({
    validateSearch: parseRootSearch,
    component: function RootLayout() {
      return <MainComponent {...mainProps} />;
    },
  });

  return createRouter({
    routeTree: rootRoute,
    basepath: routerBasepath(),
  } as never);
}
