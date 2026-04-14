import type { DocumentData } from "@/lib/stores/documentSchema";

/** Row in Dexie `stories` table (full document + listing metadata). */
export type StoryRecord = {
  id: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  thumbnail?: string;
  data: DocumentData;
};

/** Lightweight row for future story-picker UI (no full `data` blob). */
export type StorySummary = Pick<
  StoryRecord,
  "id" | "title" | "createdAt" | "modifiedAt" | "thumbnail"
>;

export const SETTINGS_ACTIVE_STORY_KEY = "activeStoryId";
