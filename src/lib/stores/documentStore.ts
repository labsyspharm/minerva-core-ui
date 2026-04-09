/**
 * Exhibit document state: normalized entity maps plus explicit `*Order` id lists,
 * UI selection, and authoring bridges (`ConfigWaypoint` ↔ store rows).
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { ConfigWaypoint } from "../authoring/config";
import type {
  Channel,
  DocumentData,
  Group,
  GroupChannel,
  Id,
  Image,
  ImageChannel,
  JsonExport,
  Shape,
  Waypoint,
} from "./documentSchema";
import { parseJsonExport, sourceChannelsFromImages } from "./documentSchema";
import type { StoreWaypoint } from "./documentStoreTypes";
import {
  configWaypointToExportRow,
  exportRowToConfigWaypoint,
  hydrateConfigWaypoint,
  type JsonExportWaypointRow,
} from "./storeUtils";
import { validateDocumentData } from "./validateDocument";

export {
  findChannelInImages,
  findSourceChannel,
  sourceChannelsFromImages,
} from "./documentSchema";

/** Normalized document slice: entities keyed by `id` string. */
export type EntityMap<T> = Record<string, T>;

/** Keyed by each item's `id`. Callers must pass entities that have a string `id` at runtime. */
export function toEntityMap<T>(items: T[]): EntityMap<T> {
  return Object.fromEntries(
    items.map((item) => [(item as { id: string }).id, item]),
  );
}

export type {
  Channel,
  DocumentData,
  ExhibitImage,
  Group,
  GroupChannel,
  Id,
  Image,
  ImageChannel,
  JsonExport,
  Shape,
  SourceDistributionData,
  StoryShape,
  Waypoint,
} from "./documentSchema";

export type { StoreWaypoint } from "./documentStoreTypes";
export type { JsonExportWaypointRow } from "./storeUtils";

export type SetGroupChannelRangeInput = {
  LowerRange: number;
  UpperRange: number;
  groupId: string;
  channelId: string;
};

export type SetGroupChannelRangePayload =
  | SetGroupChannelRangeInput
  | {
      LowerRange: number;
      UpperRange: number;
      group_uuid: string;
      channel_uuid: string;
    };

export type AuthoringViewportPx = { width: number; height: number };

export type DocumentState = {
  waypointOrder: Id[];
  groupOrder: Id[];
  imageOrder: Id[];
  shapeOrder: Id[];
  waypoints: EntityMap<StoreWaypoint>;
  shapes: EntityMap<Shape>;
  groups: EntityMap<Group>;
  images: EntityMap<Image>;
  imageWidth: number;
  imageHeight: number;
};

export type UiState = {
  selectedWaypointId: Id | null;
  selectedShapeId: Id | null;
  selectedGroupId: Id | null;
  selectedImageId: Id | null;
};

export type DocumentStore = {
  document: DocumentState;
  ui: UiState;

  loadDocument: (input: unknown) => void;
  toDocumentData: () => DocumentData;
  toJsonExport: () => JsonExport;
  resetDocument: () => void;

  selectWaypoint: (id: Id | null) => void;
  selectShape: (id: Id | null) => void;
  selectGroup: (id: Id | null) => void;
  selectImage: (id: Id | null) => void;

  upsertWaypoint: (waypoint: StoreWaypoint) => void;
  upsertShape: (shape: Shape) => void;
  upsertGroup: (group: Group) => void;
  upsertImage: (image: Image) => void;

  removeWaypoint: (id: Id) => void;
  removeShape: (id: Id) => void;
  removeGroup: (id: Id) => void;
  removeImage: (id: Id) => void;

  addShapeToWaypoint: (waypointId: Id, shapeId: Id) => void;
  removeShapeFromWaypoint: (waypointId: Id, shapeId: Id) => void;

  addChannelToGroup: (groupId: Id, channel: GroupChannel) => void;
  removeChannelFromGroup: (groupId: Id, channelEntryId: Id) => void;

  setGroups: (groups: Group[]) => void;
  /** Replace nested `channels` for one image (persisted slice). */
  setImageChannels: (imageId: Id, channels: ImageChannel[]) => void;
  /**
   * Accepts flattened runtime rows (synthetic `id`) and writes nested `Image.channels`
   * per `imageId` (OME / extractChannels output).
   */
  setSourceChannels: (channels: Channel[]) => void;
  setGroupChannelRange: (input: SetGroupChannelRangePayload) => void;

  setShapes: (shapes: Shape[]) => void;
  setImages: (images: Image[]) => void;
  setImageDimensions: (width: number, height: number) => void;

  setStoriesFromConfig: (
    configWaypoints: ConfigWaypoint[],
    viewerSize: AuthoringViewportPx,
  ) => void;
  setWaypointRows: (rows: JsonExportWaypointRow[]) => void;
  appendStoryFromConfig: (
    configWaypoint: ConfigWaypoint,
    viewerSize: AuthoringViewportPx,
  ) => void;
  updateStoryAtIndex: (
    index: number,
    updates: Partial<ConfigWaypoint>,
    viewerSize: AuthoringViewportPx,
  ) => void;
  removeWaypointAtIndex: (index: number) => void;
  reorderWaypoints: (fromIndex: number, toIndex: number) => void;

  replaceStoryDocument: (next: StoryDocumentState) => void;
};

export type StoryDocumentState = {
  document: DocumentState;
  ui: UiState;
};

function createEmptyDocumentState(): DocumentState {
  return {
    waypointOrder: [],
    groupOrder: [],
    imageOrder: [],
    shapeOrder: [],
    waypoints: {},
    shapes: {},
    groups: {},
    images: {},
    imageWidth: 0,
    imageHeight: 0,
  };
}

function createEmptyUiState(): UiState {
  return {
    selectedWaypointId: null,
    selectedShapeId: null,
    selectedGroupId: null,
    selectedImageId: null,
  };
}

/** Entity maps + parallel `*Order` arrays: resolve ids to entities in list order. */
function orderedFromMap<T>(order: Id[], map: EntityMap<T>): T[] {
  return order.map((id) => map[id]).filter((x): x is T => x != null);
}

function hydrateDocumentFromData(data: DocumentData): DocumentState {
  const waypointsList: StoreWaypoint[] = data.waypoints.map((w) => ({
    ...w,
    thumbnail: w.thumbnail ?? "",
  }));
  return {
    waypointOrder: waypointsList.map((w) => w.id),
    groupOrder: data.groups.map((g) => g.id),
    imageOrder: data.images.map((im) => im.id),
    shapeOrder: data.shapes.map((s) => s.id),
    waypoints: toEntityMap(waypointsList),
    shapes: toEntityMap(data.shapes),
    groups: toEntityMap(data.groups),
    images: toEntityMap(data.images),
    imageWidth: data.imageWidth,
    imageHeight: data.imageHeight,
  };
}

function stripStoreWaypoint(w: StoreWaypoint): Waypoint {
  const { authoring: _a, ...rest } = w;
  return rest;
}

export function selectOrderedWaypoints(s: DocumentStore): StoreWaypoint[] {
  return orderedFromMap(s.document.waypointOrder, s.document.waypoints);
}

export function selectOrderedGroups(s: DocumentStore): Group[] {
  return orderedFromMap(s.document.groupOrder, s.document.groups);
}

export function selectOrderedChannels(s: DocumentStore): Channel[] {
  return sourceChannelsFromImages(s.document.imageOrder, s.document.images);
}

export function selectOrderedShapes(s: DocumentStore): Shape[] {
  return orderedFromMap(s.document.shapeOrder, s.document.shapes);
}

/** `selectOrdered*` allocates a new array each read; use these hooks in components so snapshots stay stable. */
export function useOrderedWaypoints(): StoreWaypoint[] {
  return useDocumentStore(useShallow(selectOrderedWaypoints));
}

export function useOrderedGroups(): Group[] {
  return useDocumentStore(useShallow(selectOrderedGroups));
}

export function useOrderedChannels(): Channel[] {
  return useDocumentStore(useShallow(selectOrderedChannels));
}

export function useOrderedShapes(): Shape[] {
  return useDocumentStore(useShallow(selectOrderedShapes));
}

export function takeStoryDocumentSnapshot(
  store: DocumentStore,
): StoryDocumentState {
  return {
    document: {
      ...store.document,
      waypoints: { ...store.document.waypoints },
      shapes: { ...store.document.shapes },
      groups: { ...store.document.groups },
      images: { ...store.document.images },
    },
    ui: { ...store.ui },
  };
}

export const useDocumentStore = create<DocumentStore>()(
  devtools((set, get) => ({
    document: createEmptyDocumentState(),
    ui: createEmptyUiState(),

    loadDocument: (input) => {
      const data = validateDocumentData(input);
      set({
        document: hydrateDocumentFromData(data),
      });
    },

    toDocumentData: () => {
      const { document: d } = get();
      return {
        imageWidth: d.imageWidth,
        imageHeight: d.imageHeight,
        waypoints: orderedFromMap(d.waypointOrder, d.waypoints).map(
          stripStoreWaypoint,
        ),
        shapes: orderedFromMap(d.shapeOrder, d.shapes),
        groups: orderedFromMap(d.groupOrder, d.groups),
        images: orderedFromMap(d.imageOrder, d.images),
      };
    },

    toJsonExport: () => {
      const data = get().toDocumentData();
      return parseJsonExport({
        version: "2",
        waypoints: data.waypoints,
        shapes: data.shapes,
      });
    },

    resetDocument: () => {
      set({
        document: createEmptyDocumentState(),
        ui: createEmptyUiState(),
      });
    },

    selectWaypoint: (id) =>
      set((s) => ({ ui: { ...s.ui, selectedWaypointId: id } })),

    selectShape: (id) => set((s) => ({ ui: { ...s.ui, selectedShapeId: id } })),

    selectGroup: (id) => set((s) => ({ ui: { ...s.ui, selectedGroupId: id } })),

    selectImage: (id) => set((s) => ({ ui: { ...s.ui, selectedImageId: id } })),

    upsertWaypoint: (waypoint) =>
      set((s) => {
        const had = s.document.waypointOrder.includes(waypoint.id);
        const waypointOrder = had
          ? s.document.waypointOrder
          : [...s.document.waypointOrder, waypoint.id];
        return {
          document: {
            ...s.document,
            waypointOrder,
            waypoints: {
              ...s.document.waypoints,
              [waypoint.id]: waypoint,
            },
          },
        };
      }),

    upsertShape: (shape) =>
      set((s) => {
        const had = s.document.shapeOrder.includes(shape.id);
        const shapeOrder = had
          ? s.document.shapeOrder
          : [...s.document.shapeOrder, shape.id];
        return {
          document: {
            ...s.document,
            shapeOrder,
            shapes: { ...s.document.shapes, [shape.id]: shape },
          },
        };
      }),

    upsertGroup: (group) =>
      set((s) => {
        const had = s.document.groupOrder.includes(group.id);
        const groupOrder = had
          ? s.document.groupOrder
          : [...s.document.groupOrder, group.id];
        return {
          document: {
            ...s.document,
            groupOrder,
            groups: { ...s.document.groups, [group.id]: group },
          },
        };
      }),

    upsertImage: (image) =>
      set((s) => {
        const had = s.document.imageOrder.includes(image.id);
        const imageOrder = had
          ? s.document.imageOrder
          : [...s.document.imageOrder, image.id];
        return {
          document: {
            ...s.document,
            imageOrder,
            images: { ...s.document.images, [image.id]: image },
          },
        };
      }),

    removeWaypoint: (id) =>
      set((s) => {
        const nextWaypoints = { ...s.document.waypoints };
        delete nextWaypoints[id];
        return {
          document: {
            ...s.document,
            waypoints: nextWaypoints,
            waypointOrder: s.document.waypointOrder.filter((x) => x !== id),
          },
          ui: {
            ...s.ui,
            selectedWaypointId:
              s.ui.selectedWaypointId === id ? null : s.ui.selectedWaypointId,
          },
        };
      }),

    removeShape: (id) =>
      set((s) => {
        const nextShapes = { ...s.document.shapes };
        delete nextShapes[id];
        const nextWaypointsEntries = Object.entries(s.document.waypoints).map(
          ([wid, wp]) => {
            if (!wp) return [wid, wp] as const;
            return [
              wid,
              {
                ...wp,
                shapeIds: wp.shapeIds.filter((sid) => sid !== id),
              },
            ] as const;
          },
        );
        return {
          document: {
            ...s.document,
            shapes: nextShapes,
            shapeOrder: s.document.shapeOrder.filter((x) => x !== id),
            waypoints: Object.fromEntries(nextWaypointsEntries),
          },
          ui: {
            ...s.ui,
            selectedShapeId:
              s.ui.selectedShapeId === id ? null : s.ui.selectedShapeId,
          },
        };
      }),

    removeGroup: (id) =>
      set((s) => {
        const nextGroups = { ...s.document.groups };
        delete nextGroups[id];
        return {
          document: {
            ...s.document,
            groups: nextGroups,
            groupOrder: s.document.groupOrder.filter((x) => x !== id),
          },
          ui: {
            ...s.ui,
            selectedGroupId:
              s.ui.selectedGroupId === id ? null : s.ui.selectedGroupId,
          },
        };
      }),

    removeImage: (id) =>
      set((s) => {
        const removed = s.document.images[id];
        const removedChannelIds = new Set(
          (removed?.channels ?? []).map((c) => c.id),
        );
        const nextImages = { ...s.document.images };
        delete nextImages[id];
        const nextGroupsEntries = Object.entries(s.document.groups).map(
          ([gid, group]) => {
            if (!group) return [gid, group] as const;
            return [
              gid,
              {
                ...group,
                channels: group.channels.filter(
                  (e) => !removedChannelIds.has(e.channelId),
                ),
              },
            ] as const;
          },
        );
        return {
          document: {
            ...s.document,
            images: nextImages,
            imageOrder: s.document.imageOrder.filter((x) => x !== id),
            groups: Object.fromEntries(nextGroupsEntries),
          },
          ui: {
            ...s.ui,
            selectedImageId:
              s.ui.selectedImageId === id ? null : s.ui.selectedImageId,
          },
        };
      }),

    addShapeToWaypoint: (waypointId, shapeId) =>
      set((s) => {
        const waypoint = s.document.waypoints[waypointId];
        if (!waypoint) return s;
        if (waypoint.shapeIds.includes(shapeId)) return s;
        return {
          document: {
            ...s.document,
            waypoints: {
              ...s.document.waypoints,
              [waypointId]: {
                ...waypoint,
                shapeIds: [...waypoint.shapeIds, shapeId],
              },
            },
          },
        };
      }),

    removeShapeFromWaypoint: (waypointId, shapeId) =>
      set((s) => {
        const waypoint = s.document.waypoints[waypointId];
        if (!waypoint) return s;
        return {
          document: {
            ...s.document,
            waypoints: {
              ...s.document.waypoints,
              [waypointId]: {
                ...waypoint,
                shapeIds: waypoint.shapeIds.filter((x) => x !== shapeId),
              },
            },
          },
        };
      }),

    addChannelToGroup: (groupId, channel) =>
      set((s) => {
        const group = s.document.groups[groupId];
        if (!group) return s;
        if (group.channels.some((e) => e.channelId === channel.channelId)) {
          return s;
        }
        return {
          document: {
            ...s.document,
            groups: {
              ...s.document.groups,
              [groupId]: {
                ...group,
                channels: [...group.channels, channel],
              },
            },
          },
        };
      }),

    removeChannelFromGroup: (groupId, channelEntryId) =>
      set((s) => {
        const group = s.document.groups[groupId];
        if (!group) return s;
        return {
          document: {
            ...s.document,
            groups: {
              ...s.document.groups,
              [groupId]: {
                ...group,
                channels: group.channels.filter((e) => e.id !== channelEntryId),
              },
            },
          },
        };
      }),

    setGroups: (groups) =>
      set((s) => ({
        document: {
          ...s.document,
          groups: toEntityMap(groups),
          groupOrder: groups.map((g) => g.id),
        },
      })),

    setImageChannels: (imageId, channels) =>
      set((s) => {
        const im = s.document.images[imageId];
        if (!im) return s;
        return {
          document: {
            ...s.document,
            images: {
              ...s.document.images,
              [imageId]: { ...im, channels },
            },
          },
        };
      }),

    setSourceChannels: (flat) =>
      set((s) => {
        const byImage = new Map<string, ImageChannel[]>();
        for (const row of flat) {
          const {
            id,
            imageId,
            index,
            name,
            samples,
            sourceDataTypeId,
            sourceDistribution,
          } = row;
          const slice: ImageChannel = {
            id: id && id.length > 0 ? id : crypto.randomUUID(),
            index,
            name,
            ...(samples !== undefined ? { samples } : {}),
            ...(sourceDataTypeId !== undefined ? { sourceDataTypeId } : {}),
            ...(sourceDistribution !== undefined ? { sourceDistribution } : {}),
          };
          const list = byImage.get(imageId) ?? [];
          list.push(slice);
          byImage.set(imageId, list);
        }
        const nextImages = { ...s.document.images };
        const nextOrder = [...s.document.imageOrder];
        for (const [imId, chans] of byImage) {
          chans.sort((a, b) => a.index - b.index);
          const existing = nextImages[imId];
          if (existing) {
            nextImages[imId] = { ...existing, channels: chans };
          } else {
            nextImages[imId] = {
              id: imId,
              sizeX: 1,
              sizeY: 1,
              sizeC: chans.length,
              omeXmlHash: "",
              basename: "",
              channels: chans,
            };
            if (!nextOrder.includes(imId)) nextOrder.push(imId);
          }
        }
        return {
          document: {
            ...s.document,
            images: nextImages,
            imageOrder: nextOrder,
          },
        };
      }),

    setGroupChannelRange: (raw) => {
      const lower = raw.LowerRange;
      const upper = raw.UpperRange;
      const groupId =
        "groupId" in raw && raw.groupId !== undefined
          ? raw.groupId
          : (raw as { group_uuid: string }).group_uuid;
      const channelEntryId =
        "channelId" in raw && raw.channelId !== undefined
          ? raw.channelId
          : (raw as { channel_uuid: string }).channel_uuid;
      set((s) => ({
        document: {
          ...s.document,
          groups: Object.fromEntries(
            Object.entries(s.document.groups).map(([gid, group]) => {
              if (!group || group.id !== groupId) return [gid, group];
              return [
                gid,
                {
                  ...group,
                  channels: group.channels.map((e) =>
                    e.id === channelEntryId
                      ? { ...e, lowerLimit: lower, upperLimit: upper }
                      : e,
                  ),
                },
              ];
            }),
          ),
        },
      }));
    },

    setShapes: (shapes) =>
      set((s) => ({
        document: {
          ...s.document,
          shapes: toEntityMap(shapes),
          shapeOrder: shapes.map((sh) => sh.id),
        },
      })),

    setImages: (images) =>
      set((s) => ({
        document: {
          ...s.document,
          images: toEntityMap(images),
          imageOrder: images.map((im) => im.id),
        },
      })),

    setImageDimensions: (imageWidth, imageHeight) =>
      set((s) => ({
        document: {
          ...s.document,
          imageWidth,
          imageHeight,
        },
      })),

    setStoriesFromConfig: (configWaypoints, viewerSize) => {
      const { document: d } = get();
      const orderedGroups = d.groupOrder
        .map((id) => d.groups[id])
        .filter((g): g is Group => g != null);
      const rows = configWaypoints.map((w) =>
        configWaypointToExportRow(
          hydrateConfigWaypoint(w, orderedGroups),
          d.imageWidth,
          d.imageHeight,
          viewerSize.width,
          viewerSize.height,
        ),
      );
      get().setWaypointRows(rows);
    },

    setWaypointRows: (rows) => {
      set((s) => {
        const waypoints = toEntityMap(rows);
        return {
          document: {
            ...s.document,
            waypoints,
            waypointOrder: rows.map((r) => r.id),
          },
        };
      });
    },

    appendStoryFromConfig: (configWaypoint, viewerSize) => {
      const { document: d } = get();
      const orderedGroups = d.groupOrder
        .map((id) => d.groups[id])
        .filter((g): g is Group => g != null);
      const row = configWaypointToExportRow(
        hydrateConfigWaypoint(configWaypoint, orderedGroups),
        d.imageWidth,
        d.imageHeight,
        viewerSize.width,
        viewerSize.height,
      );
      set((s) => ({
        document: {
          ...s.document,
          waypoints: { ...s.document.waypoints, [row.id]: row },
          waypointOrder: [...s.document.waypointOrder, row.id],
        },
      }));
    },

    updateStoryAtIndex: (index, updates, viewerSize) => {
      const shouldDropLegacyViewKeys = Object.hasOwn(updates, "Bounds");
      const cw = viewerSize.width;
      const ch = viewerSize.height;
      set((s) => {
        const order = s.document.waypointOrder;
        const id = order[index];
        if (id == null) return s;
        const row = s.document.waypoints[id];
        if (!row) return s;
        const { imageWidth: iw, imageHeight: ih } = s.document;
        const asConfig = exportRowToConfigWaypoint(row);
        let merged: ConfigWaypoint = { ...asConfig, ...updates };
        if (shouldDropLegacyViewKeys) {
          const { Pan: _pan, Zoom: _zoom, ...withoutPanZoom } = merged;
          if (Object.hasOwn(updates, "ViewState")) {
            merged = withoutPanZoom as ConfigWaypoint;
          } else {
            const { ViewState: _vs, ...rest } = withoutPanZoom;
            merged = rest as ConfigWaypoint;
          }
        }
        const nextRow = configWaypointToExportRow(merged, iw, ih, cw, ch);
        return {
          document: {
            ...s.document,
            waypoints: { ...s.document.waypoints, [id]: nextRow },
          },
        };
      });
    },

    removeWaypointAtIndex: (index) => {
      const id = get().document.waypointOrder[index];
      if (id) get().removeWaypoint(id);
    },

    reorderWaypoints: (fromIndex, toIndex) =>
      set((s) => {
        const next = [...s.document.waypointOrder];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { document: { ...s.document, waypointOrder: next } };
      }),

    replaceStoryDocument: (next) => {
      set({
        document: { ...next.document },
        ui: { ...next.ui },
      });
    },
  })),
);
