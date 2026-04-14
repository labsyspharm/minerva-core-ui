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

const rootRouteApi = getRouteApi("__root__");

/**
 * Keeps `?storyid=<Dexie story uuid>` in sync with {@link useDocumentStore}'s `activeStoryId`.
 * Must render under `RouterProvider` after story persistence has hydrated the document store.
 */
export function StoryIdUrlSync() {
  const search = rootRouteApi.useSearch();
  const navigate = rootRouteApi.useNavigate();
  const activeStoryId = useDocumentStore((s) => s.activeStoryId);
  const switchStory = useDocumentStore((s) => s.switchStory);

  React.useEffect(() => {
    const sid = search.storyid;
    if (sid === undefined) return;
    if (activeStoryId === null) return;
    if (sid === activeStoryId) return;
    void switchStory(sid).catch(() => {});
  }, [search.storyid, activeStoryId, switchStory]);

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
