import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import { ImageViewer } from "@/components/shared/viewer/ImageViewer";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import { useSyncJpegChannelFolders } from "@/lib/imaging/loadJpegFromDocument";
import { paintUngroupedExportColors } from "@/lib/imaging/psudoPalette";
import { useViewerLayers } from "@/lib/imaging/viewerLayers";
import { useAppStore } from "@/lib/stores/appStore";
import {
  flattenImageChannelsInDocumentOrder,
  type Image,
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
function useStoryPlaybackLayers(
  {
    jpegLoaderEntries,
    setJpegLoaderEntries,
    omeLoaderEntries,
    dicomIndexList,
  }: StoryPlaybackLoaders,
  images: Image[],
) {
  const channelGroups = useDocumentStore((s) => s.channelGroups);
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
    images,
  });
}

/** CDN player's ChannelPanel + ImageViewer under Presentation. */
export function StoryPlaybackView(props: StoryPlaybackLoaders) {
  const { omeLoaderEntries } = props;
  const storeImages = useDocumentStore((s) => s.images);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const [displayImages, setDisplayImages] = useState(storeImages);
  useEffect(() => {
    let cancelled = false;
    void paintUngroupedExportColors(storeImages, channelGroups).then(
      (painted) => {
        if (!cancelled) setDisplayImages(painted);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storeImages, channelGroups]);
  const { loaderList, mainSettingsList, imageLayers } = useStoryPlaybackLayers(
    props,
    displayImages,
  );
  const {
    overlayLayers,
    activeTool,
    dragState,
    hoverState,
    handleOverlayInteraction,
  } = useAppStore();

  return (
    <ChannelPanel noLoader={false} hiddenChannel={false} images={displayImages}>
      <ImageViewer
        omeLoaderEntries={omeLoaderEntries}
        imageLayers={imageLayers}
        mainSettingsList={mainSettingsList}
        loaderList={loaderList}
        overlayLayers={overlayLayers}
        activeTool={activeTool}
        isDragging={dragState.isDragging}
        hoveredShapeId={hoverState.hoveredShapeId}
        onOverlayInteraction={handleOverlayInteraction}
      />
    </ChannelPanel>
  );
}
