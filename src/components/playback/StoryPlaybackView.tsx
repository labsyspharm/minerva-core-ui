import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import { ImageViewer } from "@/components/shared/viewer/ImageViewer/ImageViewer";
import { useAppStore } from "@/lib/stores/appStore";
import {
  type StoryPlaybackLoaders,
  useStoryPlaybackLayers,
} from "./useStoryPlaybackLayers";

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
