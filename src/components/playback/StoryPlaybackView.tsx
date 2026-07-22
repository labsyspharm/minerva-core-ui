import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import { ImageViewer } from "@/components/shared/viewer/ImageViewer";
import type { ConfigProps } from "@/lib/authoring/config";
import { useAppStore } from "@/lib/stores/appStore";
import {
  type StoryPlaybackLoaders,
  useStoryPlaybackLayers,
} from "./useStoryPlaybackLayers";

/** ChannelPanel requires these; playback reads channels from the document store. */
const PLAYBACK_PANEL = {
  authorMode: false as const,
  editable: false,
  noLoader: false,
  hiddenChannel: false,
  setHiddenChannel: () => {},
  startExport: () => {},
  channelItemElement: "div",
  controlPanelElement: "div",
  config: {
    ID: "playback",
    ItemRegistry: {
      Name: "",
      ChannelGroups: [],
      Stories: [],
      SourceChannels: [],
      SourceDistributions: [],
    },
  } satisfies ConfigProps,
};

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
    <ChannelPanel {...PLAYBACK_PANEL}>
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
        groups={[]}
      />
    </ChannelPanel>
  );
}
