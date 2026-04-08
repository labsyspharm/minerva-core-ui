/**
 * **Exhibit story document** in Zustand: one narrative over an image.
 *
 * Naming is consistently **camelCase** here and in `story.json` wire types
 * (`groupId`, `shapeIds`, `StoryShape.id`, …). Legacy exhibit blobs may still
 * carry `UUID` / `Group` / `ShapeIds` until {@link hydrateConfigWaypoint} runs.
 *
 * - **Channel model** — `channelGroups` (`ConfigGroup.id`), `sourceChannels` (`ConfigSourceChannel.id`)
 * - **Geometry registry** — `shapes` (`StoryShape` entries keyed by `id`)
 * - **Waypoints** — `waypoints` (each row: `groupId`, `shapeIds`, …)
 * - **Image space** — `imageWidth`, `imageHeight`
 * - **Cached export** — `storyDocument`
 *
 * Ephemeral UI stays in {@link useAppStore}.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  exportStoryDocument,
  type StoreStoryWaypoint,
  type StoryDocument,
} from "../story/storyDocument";
import type { StoryShape } from "../story/storyShapes";

type ExpandedState = {
  Expanded: boolean;
};
type GroupState = ExpandedState;
type GroupChannelState = ExpandedState;

type Color = Record<"R" | "G" | "B", number>;

/** One channel row inside a channel group (contrast, color, link to source). */
export type GroupChannel = {
  id: string;
  LowerRange: number;
  UpperRange: number;
  Color: Color;
  sourceChannelId: string;
  groupId: string;
  State: GroupChannelState;
};

export type ConfigGroup = {
  id: string;
  Name: string;
  GroupChannels: GroupChannel[];
  State: GroupState;
};

/** Histogram curve payload (lazy-loaded on OME-TIFF). */
export type SourceDistributionData = {
  id: string;
  YValues: number[];
  XScale: string;
  YScale: string;
  LowerRange: number;
  UpperRange: number;
};

export type ConfigSourceChannel = {
  id: string;
  Name: string;
  SourceIndex: number;
  Samples: number;
  /** Typically the loader / modality key used for visibility matching. */
  sourceImageId: string;
  sourceDataTypeId: string;
  sourceDistribution?: SourceDistributionData;
};

export type SetGroupChannelRangeInput = {
  LowerRange: number;
  UpperRange: number;
  groupId: string;
  channelId: string;
};

/** Embedded author UI still passes `group_uuid` / `channel_uuid` attributes. */
export type SetGroupChannelRangePayload =
  | SetGroupChannelRangeInput
  | {
      LowerRange: number;
      UpperRange: number;
      group_uuid: string;
      channel_uuid: string;
    };

const emptyStoryDocument: StoryDocument = {
  version: "2",
  waypoints: [],
  shapes: [],
};

export interface DocumentStore {
  channelGroups: ConfigGroup[];
  sourceChannels: ConfigSourceChannel[];
  setChannelGroups: (groups: ConfigGroup[]) => void;
  setSourceChannels: (channels: ConfigSourceChannel[]) => void;
  setGroupChannelRange: (input: SetGroupChannelRangePayload) => void;

  waypoints: StoreStoryWaypoint[];
  shapes: StoryShape[];
  setShapes: (shapes: StoryShape[]) => void;

  imageWidth: number;
  imageHeight: number;
  setImageDimensions: (width: number, height: number) => void;

  storyDocument: StoryDocument;
  syncStoryDocument: () => void;
}

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    (set, get) => ({
      channelGroups: [],
      sourceChannels: [],
      waypoints: [],
      shapes: [],
      imageWidth: 0,
      imageHeight: 0,
      storyDocument: emptyStoryDocument,

      setChannelGroups: (channelGroups: ConfigGroup[]) => {
        set({ channelGroups });
      },

      setGroupChannelRange: (raw: SetGroupChannelRangePayload) => {
        const LowerRange = raw.LowerRange;
        const UpperRange = raw.UpperRange;
        const groupId =
          "groupId" in raw && raw.groupId !== undefined
            ? raw.groupId
            : (raw as { group_uuid: string }).group_uuid;
        const channelId =
          "channelId" in raw && raw.channelId !== undefined
            ? raw.channelId
            : (raw as { channel_uuid: string }).channel_uuid;
        set((state) => {
          const channelGroups = state.channelGroups.map((group) => {
            if (group.id !== groupId) {
              return group;
            }
            group.GroupChannels = group.GroupChannels.map((channel) => {
              if (channel.id !== channelId) {
                return channel;
              }
              channel.LowerRange = LowerRange;
              channel.UpperRange = UpperRange;
              return channel;
            });
            return group;
          });
          return { channelGroups };
        });
      },

      setSourceChannels: (sourceChannels: ConfigSourceChannel[]) => {
        set({ sourceChannels });
      },

      setShapes: (shapes: StoryShape[]) => {
        set({ shapes });
        get().syncStoryDocument();
      },

      setImageDimensions: (imageWidth: number, imageHeight: number) => {
        set({ imageWidth, imageHeight });
        get().syncStoryDocument();
      },

      syncStoryDocument: () => {
        const { waypoints, shapes } = get();
        set({
          storyDocument: exportStoryDocument(waypoints, shapes ?? []),
        });
      },
    }),
    { name: "document-store" },
  ),
);
