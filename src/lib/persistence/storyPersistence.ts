import type {
  DocumentData,
  DocumentMetadata,
} from "@/lib/stores/documentSchema";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import { storyDb } from "./db";
import type { StoryRecord, StorySummary } from "./types";
import { SETTINGS_ACTIVE_STORY_KEY } from "./types";

const UNTITLED = "Untitled Story";

/**
 * Which story to load on startup: Dexie global active id (shared across tabs),
 * else first story in the list.
 */
export async function resolveActiveStoryIdForBootstrap(
  summaries: StorySummary[],
): Promise<string | null> {
  if (summaries.length === 0) return null;
  const ids = new Set(summaries.map((s) => s.id));
  const global = await getActiveStoryId();
  if (global && ids.has(global)) return global;
  return summaries[0]?.id ?? null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function deriveTitle(data: DocumentData): string {
  const t = data.metadata?.title?.trim();
  return t && t.length > 0 ? t : UNTITLED;
}

/** Listing preview: first non-empty `waypoint.thumbnail` (any row), not only index 0. */
export function deriveThumbnail(data: DocumentData): string | undefined {
  for (const w of data.waypoints) {
    if (typeof w?.thumbnail === "string" && w.thumbnail.length > 0) {
      return w.thumbnail;
    }
  }
  return undefined;
}

function toSummary(r: StoryRecord): StorySummary {
  const data = r.data;
  const m = data.metadata;
  return {
    id: m.id ?? r.id,
    title: deriveTitle(data),
    createdAt: m.createdAt ?? r.createdAt,
    modifiedAt: m.modifiedAt ?? r.modifiedAt,
    thumbnail: deriveThumbnail(data),
  };
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
  return rows.map((r) => toSummary(r));
}

export async function getStoryRecord(
  id: string,
): Promise<StoryRecord | undefined> {
  return storyDb.stories.get(id);
}

/**
 * Merges canonical story fields into `data.metadata` (id, createdAt, modifiedAt) and persists.
 * Row-level timestamps mirror `metadata` for Dexie indexing.
 */
export async function saveStoryDocument(
  id: string,
  data: DocumentData,
): Promise<void> {
  const existing = await storyDb.stories.get(id);
  const t = nowIso();
  const m = data.metadata ?? {};
  const createdAt =
    m.createdAt ??
    existing?.data?.metadata?.createdAt ??
    existing?.createdAt ??
    t;
  const next: DocumentData = {
    ...data,
    metadata: {
      ...m,
      id,
      createdAt,
      modifiedAt: t,
    },
  };
  const validated = validateDocumentData(next);
  const md = validated.metadata;
  const rowCreated = md.createdAt ?? t;
  const rowModified = md.modifiedAt ?? t;
  await storyDb.stories.put({
    id,
    createdAt: rowCreated,
    modifiedAt: rowModified,
    data: validated,
  });
}

export async function createStoryRecord(title?: string): Promise<StoryRecord> {
  const id = crypto.randomUUID();
  const t = nowIso();
  const metadata: DocumentMetadata = {
    id,
    createdAt: t,
    modifiedAt: t,
    ...(title !== undefined && title.trim().length > 0
      ? { title: title.trim() }
      : {}),
  };
  const data = validateDocumentData({
    ...emptyDocumentData(),
    metadata,
  });
  const row: StoryRecord = {
    id,
    createdAt: t,
    modifiedAt: t,
    data,
  };
  await storyDb.stories.put(row);
  return row;
}

export async function deleteStoryRecord(id: string): Promise<void> {
  await storyDb.stories.delete(id);
}
