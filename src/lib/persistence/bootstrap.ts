import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  getStoryRecord,
  listStorySummaries,
  setActiveStoryId,
} from "./storyPersistence";

let inflight: Promise<void> | null = null;

async function runLibraryBootstrap(): Promise<void> {
  await setActiveStoryId(null);
  useDocumentStore.getState().clearForLibraryView();
}

async function runAuthorBootstrap(preferredStoryId: string): Promise<void> {
  const summaries = await listStorySummaries();
  const ok = summaries.some((s) => s.id === preferredStoryId);
  if (!ok) {
    await runLibraryBootstrap();
    return;
  }

  const rec = await getStoryRecord(preferredStoryId);
  if (!rec) {
    await runLibraryBootstrap();
    return;
  }

  await setActiveStoryId(preferredStoryId);
  useDocumentStore.getState().hydrateFromDocument(rec.data, rec.id);
}

async function runBootstrap(preferredStoryId: string | null): Promise<void> {
  if (preferredStoryId !== null && preferredStoryId !== "") {
    await runAuthorBootstrap(preferredStoryId);
    return;
  }
  await runLibraryBootstrap();
}

/**
 * Load persisted state for {@link useDocumentStore}.
 * - No `storyid` in the URL → Minerva Library: clear active story and document slices.
 * - With `storyid` → hydrate that story from Dexie (or fall back to Library if missing).
 *
 * Call once before the main UI mounts. Concurrent callers share one run
 * (avoids duplicate work under React Strict Mode).
 */
export async function bootstrapStoryPersistence(
  preferredStoryId?: string | null,
): Promise<void> {
  if (inflight) return inflight;
  const preferred = preferredStoryId ?? null;
  inflight = runBootstrap(preferred).finally(() => {
    inflight = null;
  });
  return inflight;
}
