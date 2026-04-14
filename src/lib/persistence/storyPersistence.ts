import type { DocumentData } from "@/lib/stores/documentSchema";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import { storyDb } from "./db";
import type { StoryRecord, StorySummary } from "./types";
import { SETTINGS_ACTIVE_STORY_KEY } from "./types";

const UNTITLED = "Untitled Story";

/** Per-tab last active story (IndexedDB `activeStoryId` is shared across tabs). */
const TAB_ACTIVE_STORY_SESSION_KEY = "minerva.tabActiveStoryId";

export function getTabActiveStoryId(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const v = sessionStorage.getItem(TAB_ACTIVE_STORY_SESSION_KEY);
    return v != null && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setTabActiveStoryId(id: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (id == null) {
      sessionStorage.removeItem(TAB_ACTIVE_STORY_SESSION_KEY);
    } else {
      sessionStorage.setItem(TAB_ACTIVE_STORY_SESSION_KEY, id);
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Which story to load on startup: this tab’s last selection (session), else Dexie
 * global active id, else first story in the list.
 */
export async function resolveActiveStoryIdForBootstrap(
  summaries: StorySummary[],
): Promise<string | null> {
  if (summaries.length === 0) return null;
  const ids = new Set(summaries.map((s) => s.id));
  const tabId = getTabActiveStoryId();
  if (tabId && ids.has(tabId)) return tabId;
  const global = await getActiveStoryId();
  if (global && ids.has(global)) return global;
  return summaries[0]?.id ?? null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function deriveTitle(data: DocumentData): string {
  const t = data.metadata?.title?.trim();
  return t && t.length > 0 ? t : UNTITLED;
}

function deriveThumbnail(data: DocumentData): string | undefined {
  const w = data.waypoints[0];
  return typeof w?.thumbnail === "string" && w.thumbnail.length > 0
    ? w.thumbnail
    : undefined;
}

export function emptyDocumentData(): DocumentData {
  return {
    metadata: {},
    waypoints: [],
    shapes: [],
    channelGroups: [],
    images: [],
  };
}

/** Validates `data` from IndexedDB (migration-safe). */
export function parseStoredDocument(data: unknown): DocumentData {
  return validateDocumentData(data);
}

export async function getActiveStoryId(): Promise<string | null> {
  const row = await storyDb.settings.get(SETTINGS_ACTIVE_STORY_KEY);
  return row?.value ?? null;
}

export async function setActiveStoryId(id: string | null): Promise<void> {
  if (id === null) {
    await storyDb.settings.delete(SETTINGS_ACTIVE_STORY_KEY);
    return;
  }
  await storyDb.settings.put({ key: SETTINGS_ACTIVE_STORY_KEY, value: id });
}

export async function listStorySummaries(): Promise<StorySummary[]> {
  const rows = await storyDb.stories.orderBy("modifiedAt").reverse().toArray();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt,
    modifiedAt: r.modifiedAt,
    thumbnail: r.thumbnail,
  }));
}

export async function getStoryRecord(
  id: string,
): Promise<StoryRecord | undefined> {
  return storyDb.stories.get(id);
}

/**
 * Upserts the story row and refreshes listing metadata from `data`.
 */
export async function saveStoryDocument(
  id: string,
  data: DocumentData,
): Promise<void> {
  const validated = validateDocumentData(data);
  const existing = await storyDb.stories.get(id);
  const modifiedAt = nowIso();
  const title = deriveTitle(validated);
  const thumbnail = deriveThumbnail(validated);
  if (existing) {
    await storyDb.stories.put({
      ...existing,
      title,
      thumbnail,
      modifiedAt,
      data: validated,
    });
  } else {
    await storyDb.stories.put({
      id,
      title,
      createdAt: modifiedAt,
      modifiedAt,
      thumbnail,
      data: validated,
    });
  }
}

export async function createStoryRecord(title?: string): Promise<StoryRecord> {
  const id = crypto.randomUUID();
  const t = nowIso();
  let data = emptyDocumentData();
  if (title !== undefined && title.trim().length > 0) {
    data = { ...data, metadata: { ...data.metadata, title: title.trim() } };
  }
  data = validateDocumentData(data);
  const row: StoryRecord = {
    id,
    title: deriveTitle(data),
    createdAt: t,
    modifiedAt: t,
    thumbnail: deriveThumbnail(data),
    data,
  };
  await storyDb.stories.put(row);
  return row;
}

export async function deleteStoryRecord(id: string): Promise<void> {
  await storyDb.stories.delete(id);
}
