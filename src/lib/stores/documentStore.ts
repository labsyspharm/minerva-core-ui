/**
 * Exhibit document state: pure schema-aligned data store.
 * Thin state container with slice-level setters. Callers build new arrays
 * and pass them in; transformation logic lives in pure utilities (`storeUtils`).
 * No UI/ephemeral state -- selection and authoring bridges live in `appStore`.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  Channel,
  DocumentData,
  Group,
  Image,
  JsonExport,
  Shape,
  Waypoint,
} from "./documentSchema";
import { buildJsonExport } from "./documentSchema";
import { flattenImageChannelsInDocumentOrder } from "./storeUtils";
import { validateDocumentData } from "./validateDocument";

export type {
  Channel,
  Group,
  GroupChannel,
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
  waypoints: Waypoint[];
  shapes: Shape[];
  groups: Group[];
  images: Image[];
  imageWidth: number;
  imageHeight: number;
};

export type DocumentStore = DocumentState & {
  loadDocument: (input: unknown) => void;
  toDocumentData: () => DocumentData;
  toJsonExport: () => JsonExport;
  resetDocument: () => void;

  setWaypoints: (waypoints: Waypoint[]) => void;
  setShapes: (shapes: Shape[]) => void;
  setGroups: (groups: Group[]) => void;
  setImages: (images: Image[]) => void;
  setImageDimensions: (width: number, height: number) => void;
};

function createEmptyDocumentState(): DocumentState {
  return {
    waypoints: [],
    shapes: [],
    groups: [],
    images: [],
    imageWidth: 0,
    imageHeight: 0,
  };
}

function hydrateDocumentFromData(data: DocumentData): DocumentState {
  return {
    waypoints: data.waypoints.map((w) => ({
      ...w,
      thumbnail: w.thumbnail ?? "",
    })),
    shapes: [...data.shapes],
    groups: [...data.groups],
    images: [...data.images],
    imageWidth: data.imageWidth,
    imageHeight: data.imageHeight,
  };
}

export function documentWaypoints(s: DocumentStore): Waypoint[] {
  return s.waypoints;
}

export function documentGroups(s: DocumentStore): Group[] {
  return s.groups;
}

/** Flattened channel rows for Viv / UI (derived from `images`). */
export function documentSourceChannels(s: DocumentStore): Channel[] {
  return flattenImageChannelsInDocumentOrder(s.images);
}

export function documentShapes(s: DocumentStore): Shape[] {
  return s.shapes;
}

export function useDocumentWaypoints(): Waypoint[] {
  return useDocumentStore(useShallow(documentWaypoints));
}

export function useDocumentGroups(): Group[] {
  return useDocumentStore(useShallow(documentGroups));
}

/**
 * Flattened channel rows derived from `images`. Uses `useMemo` keyed on the
 * stable `images` reference rather than `useShallow` — `flattenImageChannelsInDocumentOrder`
 * creates new objects per call, which defeats shallow comparison and would
 * cause an infinite re-render loop with `useSyncExternalStore`.
 */
export function useDocumentSourceChannels(): Channel[] {
  const images = useDocumentStore((s) => s.images);
  return useMemo(() => flattenImageChannelsInDocumentOrder(images), [images]);
}

export function useDocumentShapes(): Shape[] {
  return useDocumentStore(useShallow(documentShapes));
}

export const useDocumentStore = create<DocumentStore>()(
  devtools((set, get) => ({
    ...createEmptyDocumentState(),

    loadDocument: (input) => {
      const data = validateDocumentData(input);
      set(hydrateDocumentFromData(data));
    },

    toDocumentData: () => {
      const s = get();
      return {
        imageWidth: s.imageWidth,
        imageHeight: s.imageHeight,
        waypoints: [...s.waypoints],
        shapes: [...s.shapes],
        groups: [...s.groups],
        images: [...s.images],
      };
    },

    toJsonExport: () => buildJsonExport(get().waypoints, get().shapes),

    resetDocument: () => {
      set(createEmptyDocumentState());
    },

    setWaypoints: (waypoints) => set(() => ({ waypoints: [...waypoints] })),

    setShapes: (shapes) => set(() => ({ shapes: [...shapes] })),

    setGroups: (groups) => set(() => ({ groups: [...groups] })),

    setImages: (images) => set(() => ({ images: [...images] })),

    setImageDimensions: (imageWidth, imageHeight) =>
      set(() => ({ imageWidth, imageHeight })),
  })),
);
