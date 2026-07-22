import { type Dispatch, type SetStateAction, useMemo } from "react";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import { useSyncJpegChannelFolders } from "@/lib/imaging/loadJpegFromDocument";
import { useViewerLayers } from "@/lib/imaging/viewerLayers";
import { useAppStore } from "@/lib/stores/appStore";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";

/** Loader state shared by CDN player and authoring Story preview. */
export type StoryPlaybackLoaders = {
  jpegLoaderEntries: JpegLoaderEntry[];
  setJpegLoaderEntries: Dispatch<SetStateAction<JpegLoaderEntry[]>>;
  omeLoaderEntries: OmeLoaderEntry[];
  dicomIndexList: DicomIndex[];
};

/** JPEG folder sync + Viv layers for StoryPlaybackView. */
export function useStoryPlaybackLayers({
  jpegLoaderEntries,
  setJpegLoaderEntries,
  omeLoaderEntries,
  dicomIndexList,
}: StoryPlaybackLoaders) {
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const channelVisibilities = useAppStore((s) => s.channelVisibilities);
  const channelGroupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );

  useSyncJpegChannelFolders(
    jpegLoaderEntries,
    images,
    activeChannelGroupId,
    channelGroups,
    setJpegLoaderEntries,
  );

  return useViewerLayers({
    dicomIndexList,
    omeLoaderEntries,
    jpegLoaderEntries,
    sourceChannels,
    channelGroups,
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
  });
}
