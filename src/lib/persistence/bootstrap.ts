import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  createStoryRecord,
  getActiveStoryId,
  getStoryRecord,
  listStorySummaries,
  resolveActiveStoryIdForBootstrap,
  setActiveStoryId,
} from "./storyPersistence";

let inflight: Promise<void> | null = null;

async function runBootstrap(preferredStoryId: string | null): Promise<void> {
  const summaries = await listStorySummaries();

  if (summaries.length === 0) {
    const rec = await createStoryRecord("Untitled Story");
    await setActiveStoryId(rec.id);
    useDocumentStore.getState().hydrateFromDocument(rec.data, rec.id);
    return;
  }

  const preferredOk =
    preferredStoryId !== null &&
    summaries.some((s) => s.id === preferredStoryId);

  let activeId: string | null = preferredOk
    ? preferredStoryId
    : await resolveActiveStoryIdForBootstrap(summaries);
  if (!activeId) {
    const first = summaries[0];
    if (!first) {
      return;
    }
    activeId = first.id;
  }

  const global = await getActiveStoryId();
  const globalValid = global && summaries.some((s) => s.id === global);
  if (!globalValid || preferredOk) {
    await setActiveStoryId(activeId);
  }

  const rec = await getStoryRecord(activeId);
  if (!rec) {
    const created = await createStoryRecord("Untitled Story");
    await setActiveStoryId(created.id);
    useDocumentStore.getState().hydrateFromDocument(created.data, created.id);
    return;
  }

  useDocumentStore.getState().hydrateFromDocument(rec.data, rec.id);
}

/**
 * Load or create the active story from Dexie and hydrate {@link useDocumentStore}.
 * Call once before the main authoring UI mounts. Concurrent callers share one run
 * (avoids duplicate stories under React Strict Mode).
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
