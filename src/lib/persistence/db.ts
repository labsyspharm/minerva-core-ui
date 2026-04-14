import Dexie, { type Table } from "dexie";
import type { StoryRecord } from "./types";

export type SettingsRow = {
  key: string;
  value: string;
};

class MinervaStoriesDB extends Dexie {
  stories!: Table<StoryRecord, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super("minerva-stories");
    this.version(1).stores({
      stories: "id, modifiedAt",
      settings: "key",
    });
  }
}

export const storyDb = new MinervaStoriesDB();
