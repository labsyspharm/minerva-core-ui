import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import { ImageViewer } from "@/components/shared/viewer/ImageViewer";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
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
function useStoryPlaybackLayers({
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

/** Shared ChannelPanel + ImageViewer under Presentation (CDN + Story preview). */
export function StoryPlaybackView(props: StoryPlaybackLoaders) {
  const { omeLoaderEntries } = props;
  const { viewerConfig, loaderList, mainSettingsList, imageLayers } =
    useStoryPlaybackLayers(props);
  const {
    overlayLayers,
    activeTool,
    dragState,
    hoverState,
    handleOverlayInteraction,
  } = useAppStore();

  return (
    <ChannelPanel noLoader={false} hiddenChannel={false}>
      <ImageViewer
        omeLoaderEntries={omeLoaderEntries}
        imageLayers={imageLayers}
        mainSettingsList={mainSettingsList}
        loaderList={loaderList}
        viewerConfig={viewerConfig}
        overlayLayers={overlayLayers}
        activeTool={activeTool}
        isDragging={dragState.isDragging}
        hoveredShapeId={hoverState.hoveredShapeId}
        onOverlayInteraction={handleOverlayInteraction}
      />
    </ChannelPanel>
  );
}
