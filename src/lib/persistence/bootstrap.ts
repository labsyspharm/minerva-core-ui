import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  emptyDocumentData,
  getStoryRecord,
  listStorySummaries,
  saveStoryDocument,
  setActiveStoryId,
} from "./storyPersistence";

let inflight: Promise<void> | null = null;

/** Stable id so `pnpm run demo` always has one spine on the library shelf. */
const DEMO_SHELF_STORY_ID = "018fd3a0-0000-7000-8000-00000000de11";

/** Mirrors `exhibit_config.Name` in `index.tsx` for the CRC demo build. */
const DEMO_SHELF_TITLE =
  "Multiplexed 3D atlas of state transitions and immune interactions in colorectal cancer";

async function ensureDemoShelfStory(): Promise<void> {
  if (import.meta.env.MODE !== "demo") return;
  const existing = await getStoryRecord(DEMO_SHELF_STORY_ID);
  if (existing) return;
  await saveStoryDocument(DEMO_SHELF_STORY_ID, {
    ...emptyDocumentData(),
    metadata: { title: DEMO_SHELF_TITLE },
  });
}

async function runLibraryBootstrap(): Promise<void> {
  await setActiveStoryId(null);
  useDocumentStore.getState().clearForLibraryView();
}

async function runAuthorBootstrap(preferredStoryId: string): Promise<void> {
  const summaries = await listStorySummaries();
  const ok = summaries.some((s) => s.id === preferredStoryId);
  if (!ok) {
    await runLibraryBootstrap();
    await ensureDemoShelfStory();
    return;
  }

  const rec = await getStoryRecord(preferredStoryId);
  if (!rec) {
    await runLibraryBootstrap();
    await ensureDemoShelfStory();
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
  await ensureDemoShelfStory();
}

/**
 * Load persisted state for {@link useDocumentStore}.
 * - No `storyid` in the URL → Minerva Library: clear active story and document slices.
 * - With `storyid` → hydrate that story from Dexie (or fall back to Library if missing).
 * - In `vite --mode demo`, ensures one shelf row exists (Dexie) if the DB had none for that id.
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
