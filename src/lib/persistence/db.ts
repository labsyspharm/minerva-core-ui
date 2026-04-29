import Dexie, { type Table } from "dexie";
import type { FileHandleRow, StoryRecord } from "./types";

export type SettingsRow = {
  key: string;
  value: string;
};

/** Story row as stored in IDB during v3 (handles co-located on row before v4). */
type StoryRecordV3 = StoryRecord & {
  fileHandles?: Record<string, Handle.File>;
};

class MinervaStoriesDB extends Dexie {
  stories!: Table<StoryRecord, string>;
  settings!: Table<SettingsRow, string>;
  /** Local file handles keyed by `handleKey` (separate object store from `stories`). */
  handles!: Table<FileHandleRow, string>;

  constructor() {
    super("minerva-stories");
    this.version(1).stores({
      stories: "id, modifiedAt",
      settings: "key",
    });
    this.version(2).stores({
      stories: "id, modifiedAt",
      settings: "key",
      handles: "id",
    });
    this.version(3)
      .stores({
        stories: "id, modifiedAt",
        settings: "key",
      })
      .upgrade(async (trans) => {
        const parseStoryId = (key: string): string | null => {
          if (!key.startsWith("story:")) return null;
          const parts = key.split(":");
          return parts.length >= 2 && parts[1] ? parts[1] : null;
        };
        type HRow = { id: string; handle: Handle.File };
        const h = trans.table("handles") as Table<HRow, string>;
        let rows: HRow[] = [];
        try {
          rows = await h.toArray();
        } catch {
          return;
        }
        const storyTable = trans.table("stories") as Table<
          StoryRecordV3,
          string
        >;
        for (const { id, handle } of rows) {
          const storyId = parseStoryId(id);
          if (!storyId) continue;
          const story = await storyTable.get(storyId);
          if (!story) continue;
          const fileHandles = { ...(story.fileHandles ?? {}), [id]: handle };
          await storyTable.put({ ...story, fileHandles });
        }
      });
    this.version(4)
      .stores({
        stories: "id, modifiedAt",
        settings: "key",
        handles: "id",
      })
      .upgrade(async (trans) => {
        const storyTable = trans.table("stories") as Table<
          StoryRecordV3,
          string
        >;
        const handleTable = trans.table("handles") as Table<
          FileHandleRow,
          string
        >;
        const stories = await storyTable.toArray();
        for (const story of stories) {
          const fh = story.fileHandles;
          if (!fh) continue;
          for (const [key, handle] of Object.entries(fh)) {
            await handleTable.put({ id: key, handle });
          }
          const { fileHandles: _removed, ...rest } = story;
          await storyTable.put(rest as StoryRecord);
        }
      });
  }
}

export const storyDb = new MinervaStoriesDB();
