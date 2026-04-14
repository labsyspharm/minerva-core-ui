import type { DocumentData } from "@/lib/stores/documentSchema";

/** Row in Dexie `stories` table — canonical document only (no denormalized listing fields). */
export type StoryRecord = {
  id: string;
  createdAt: string;
  modifiedAt: string;
  data: DocumentData;
};

/** Listing projection derived from `StoryRecord.data` when needed (e.g. story picker). */
export type StorySummary = {
  id: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  thumbnail?: string;
};

export const SETTINGS_ACTIVE_STORY_KEY = "activeStoryId";
