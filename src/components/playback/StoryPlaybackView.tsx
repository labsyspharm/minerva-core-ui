import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
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
import styles from "./StoryPlaybackView.module.css";

/** Loader state shared by CDN player and authoring Story preview. */
export type StoryPlaybackLoaders = {
  jpegLoaderEntries: JpegLoaderEntry[];
  setJpegLoaderEntries: Dispatch<SetStateAction<JpegLoaderEntry[]>>;
  omeLoaderEntries: OmeLoaderEntry[];
  dicomIndexList: DicomIndex[];
  /** True while image metadata is still opening. The channel list can render. */
  imagesLoading?: boolean;
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

/** Info-panel row; quiet so readers pass over it. Disabled while the story is copied. */
function EditStoryButton(props: { onEdit: () => Promise<void> }) {
  const [opening, setOpening] = useState(false);
  return (
    <button
      type="button"
      disabled={opening}
      onClick={() => {
        setOpening(true);
        props.onEdit().catch((e: unknown) => {
          console.error("[minerva] could not open the editor", e);
          window.alert(
            e instanceof Error ? e.message : "Could not open the editor",
          );
          setOpening(false);
        });
      }}
    >
      {opening ? "Opening editor…" : "Edit this story"}
    </button>
  );
}

/** CDN player's ChannelPanel + ImageViewer under Presentation. */
export function StoryPlaybackView(
  props: StoryPlaybackLoaders & {
    /** Adds "Edit this story" to the viewer's info panel. */
    onEdit?: () => Promise<void>;
  },
) {
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
        preserveDrawingBuffer={false}
        infoFooter={
          props.onEdit ? <EditStoryButton onEdit={props.onEdit} /> : undefined
        }
      />
      {props.imagesLoading ? (
        <output className={styles.imageLoading} aria-busy="true">
          <div className={minervaTheme.spinner} />
        </output>
      ) : null}
    </ChannelPanel>
  );
}
