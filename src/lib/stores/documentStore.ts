/**
 * Exhibit document state: pure schema-aligned data store.
 * Thin state container with slice-level setters; callers build new arrays
 * and pass them in; transformation logic lives in pure utilities (`storeUtils`).
 * No UI/ephemeral state -- selection and authoring bridges live in `appStore`.
 *
 * `activeStoryId` is the current story. Dexie stores a global “last active” id shared
 * across tabs.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  createStoryRecord,
  deleteStoryRecord,
  getStoryRecord,
  listStorySummaries,
  setActiveStoryId as persistActiveStoryId,
  saveStoryDocument,
} from "../persistence/storyPersistence";
import type {
  Channel,
  ChannelGroup,
  DocumentData,
  DocumentMetadata,
  Image,
  Shape,
  Waypoint,
} from "./documentSchema";
import { flattenImageChannelsInDocumentOrder } from "./storeUtils";
import { validateDocumentData } from "./validateDocument";

export type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
  DocumentMetadata,
  Id,
  Image,
  ImageChannel,
  Waypoint,
} from "./documentSchema";
export {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
} from "./storeUtils";

export type DocumentState = {
  /** Persisted story id (Dexie); not part of `DocumentData` export. */
  activeStoryId: string | null;
  waypoints: Waypoint[];
  shapes: Shape[];
  channelGroups: ChannelGroup[];
  images: Image[];
  metadata: DocumentMetadata;
};

export type DocumentStore = DocumentState & {
  /**
   * Replace the full document from wire JSON (validates via `validateDocumentData`).
   * Does not change `activeStoryId` (use for import / merges).
   */
  loadDocument: (input: unknown) => void;
  /** Replace document slices and set the active persisted story id (bootstrap / hydration). */
  hydrateFromDocument: (input: unknown, activeStoryId: string) => void;
  toDocumentData: () => DocumentData;
  /** Clear document slices; keeps `activeStoryId`. */
  resetDocument: () => void;
  /** Clear all document slices and `activeStoryId` (Minerva Library landing). */
  clearForLibraryView: () => void;

  setActiveStoryId: (id: string | null) => void;

  /** Save current doc, load another story from Dexie, persist active id. */
  switchStory: (id: string) => Promise<void>;
  /** Save current doc, create a new empty story, switch to it. Returns new story id. */
  createStory: (title?: string) => Promise<string>;
  /** Remove a story from Dexie; if it was active, load another or create one. */
  deleteStory: (id: string) => Promise<void>;

  setWaypoints: (waypoints: Waypoint[]) => void;
  setShapes: (shapes: Shape[]) => void;
  setChannelGroups: (channelGroups: ChannelGroup[]) => void;
  setImages: (images: Image[]) => void;
  /** Merge into `metadata`; use when persisting exhibit title/version, etc. */
  setMetadata: (metadata: Partial<DocumentMetadata>) => void;
};

function createEmptyDocumentSlices(): Omit<DocumentState, "activeStoryId"> {
  return {
    waypoints: [],
    shapes: [],
    channelGroups: [],
    images: [],
    metadata: {},
  };
}

function createEmptyDocumentState(): DocumentState {
  return {
    ...createEmptyDocumentSlices(),
    activeStoryId: null,
  };
}

export function documentWaypoints(s: DocumentStore): Waypoint[] {
  return s.waypoints;
}

export function documentChannelGroups(s: DocumentStore): ChannelGroup[] {
  return s.channelGroups;
}

/** Flattened channel rows for Viv / UI (derived from `images`). */
export function documentSourceChannels(s: DocumentStore): Channel[] {
  return flattenImageChannelsInDocumentOrder(s.images);
}

export function documentShapes(s: DocumentStore): Shape[] {
  return s.shapes;
}

export const useDocumentStore = create<DocumentStore>()(
  devtools((set, get) => ({
    ...createEmptyDocumentState(),

    setActiveStoryId: (id) => set({ activeStoryId: id }),

    hydrateFromDocument: (input, activeStoryId) => {
      const data = validateDocumentData(input);
      const m = data.metadata;
      set({
        activeStoryId,
        waypoints: [...data.waypoints],
        shapes: [...data.shapes],
        channelGroups: [...data.channelGroups],
        images: [...data.images],
        metadata: {
          ...m,
          id: m.id ?? activeStoryId,
        },
      });
    },

    loadDocument: (input) => {
      const data = validateDocumentData(input);
      set((state) => {
        const m = data.metadata;
        return {
          waypoints: [...data.waypoints],
          shapes: [...data.shapes],
          channelGroups: [...data.channelGroups],
          images: [...data.images],
          metadata: {
            ...m,
            id: m.id ?? state.activeStoryId ?? undefined,
          },
          activeStoryId: state.activeStoryId,
        };
      });
    },

    toDocumentData: () => {
      const s = get();
      return {
        metadata: { ...s.metadata },
        waypoints: [...s.waypoints],
        shapes: [...s.shapes],
        channelGroups: [...s.channelGroups],
        images: [...s.images],
      };
    },

    resetDocument: () => {
      set((state) => ({
        ...createEmptyDocumentSlices(),
        activeStoryId: state.activeStoryId,
      }));
    },

    clearForLibraryView: () => {
      set({
        ...createEmptyDocumentSlices(),
        activeStoryId: null,
      });
    },

    switchStory: async (id) => {
      const s = get();
      if (s.activeStoryId) {
        await saveStoryDocument(s.activeStoryId, s.toDocumentData());
      }
      const rec = await getStoryRecord(id);
      if (!rec) {
        throw new Error(`Story not found: ${id}`);
      }
      await persistActiveStoryId(rec.id);
      set({
        activeStoryId: rec.id,
        waypoints: [...rec.data.waypoints],
        shapes: [...rec.data.shapes],
        channelGroups: [...rec.data.channelGroups],
        images: [...rec.data.images],
        metadata: { ...rec.data.metadata },
      });
    },

    createStory: async (title) => {
      const s = get();
      if (s.activeStoryId) {
        await saveStoryDocument(s.activeStoryId, s.toDocumentData());
      }
      const rec = await createStoryRecord(title);
      await persistActiveStoryId(rec.id);
      set({
        activeStoryId: rec.id,
        waypoints: [...rec.data.waypoints],
        shapes: [...rec.data.shapes],
        channelGroups: [...rec.data.channelGroups],
        images: [...rec.data.images],
        metadata: { ...rec.data.metadata },
      });
      return rec.id;
    },

    deleteStory: async (id) => {
      await deleteStoryRecord(id);
      const current = get().activeStoryId;
      if (current !== id) return;

      const summaries = await listStorySummaries();
      if (summaries.length === 0) {
        const rec = await createStoryRecord("Untitled Story");
        await persistActiveStoryId(rec.id);
        set({
          activeStoryId: rec.id,
          waypoints: [...rec.data.waypoints],
          shapes: [...rec.data.shapes],
          channelGroups: [...rec.data.channelGroups],
          images: [...rec.data.images],
          metadata: { ...rec.data.metadata },
        });
        return;
      }

      const next = summaries[0];
      if (!next) {
        throw new Error("deleteStory: expected a remaining story");
      }
      const rec = await getStoryRecord(next.id);
      if (!rec) {
        throw new Error(`Story record missing after delete: ${next.id}`);
      }
      await persistActiveStoryId(rec.id);
      set({
        activeStoryId: rec.id,
        waypoints: [...rec.data.waypoints],
        shapes: [...rec.data.shapes],
        channelGroups: [...rec.data.channelGroups],
        images: [...rec.data.images],
        metadata: { ...rec.data.metadata },
      });
    },

    setWaypoints: (waypoints) => set(() => ({ waypoints: [...waypoints] })),

    setShapes: (shapes) => set(() => ({ shapes: [...shapes] })),

    setChannelGroups: (channelGroups) =>
      set(() => ({ channelGroups: [...channelGroups] })),

    setImages: (images) => set(() => ({ images: [...images] })),

    /** Prefer `get()` + object `set` (not `set(fn)`) so devtools middleware always merges metadata reliably. */
    setMetadata: (patch) => {
      const s = get();
      set({ metadata: { ...s.metadata, ...patch } });
    },
  })),
);
