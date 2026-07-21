import type { ReactNode } from "react";
import { AuthorView } from "@/components/authoring/AuthorSidebar";
import { ImageExporter } from "@/components/playback/ImageExporter";
import { Presentation } from "@/components/playback/Presentation";
import { StoryPlaybackView } from "@/components/playback/StoryPlaybackView";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import type { ContrastLimits } from "@/lib/imaging/autoContrast";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type { OmeLoaderEntry } from "@/lib/imaging/loaderEntries";
import type { Config } from "@/lib/imaging/viv";
import type { StoryExportMode } from "@/lib/storyExport/storyBundle";
import styles from "./PlaybackModeView.module.css";
import type { StoryPlaybackLoaders } from "./useStoryPlaybackLayers";

export type PlaybackModeViewProps = StoryPlaybackLoaders & {
  viewer: ReactNode;
  imagesPanel: ReactNode;
  hiddenChannel: boolean;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  ensureChannelGmmContrastLimits?: (
    channelIds: string[],
    opts?: { overwriteExistingLimits?: boolean },
  ) => Promise<Map<string, ContrastLimits>>;
  ioState: null | string;
  stopExport: () => void;
  presenting: boolean;
  handles: Handle.File[];
  in_f: string;
  viewerConfig: Config;
  directory_handle: FileSystemDirectoryHandle;
  exitPlaybackPreview?: () => void;
  dicomIndexList: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
  exportMode?: StoryExportMode;
};

export const PlaybackModeView = (props: PlaybackModeViewProps) => {
  const channelPanelProps = {
    hiddenChannel: props.hiddenChannel,
    noLoader: props.noLoader,
  };

  if (props.presenting) {
    return (
      <div
        key="presenting"
        className={styles.modeViewport}
        data-mode="presenting"
      >
        <Presentation exitPlaybackPreview={props.exitPlaybackPreview}>
          <StoryPlaybackView
            jpegLoaderEntries={props.jpegLoaderEntries}
            setJpegLoaderEntries={props.setJpegLoaderEntries}
            omeLoaderEntries={props.omeLoaderEntries}
            dicomIndexList={props.dicomIndexList}
          />
        </Presentation>
      </div>
    );
  }

  const exporting = props.ioState === "EXPORTING";
  const exporterProps = {
    in_f: props.in_f,
    handles: props.handles,
    stopExport: props.stopExport,
    viewerConfig: props.viewerConfig,
    dicomIndexList: props.dicomIndexList,
    omeLoaderEntries: props.omeLoaderEntries,
    directory_handle: props.directory_handle,
    exportMode: props.exportMode,
  };

  return (
    <div
      key="author"
      className={styles.modeViewport}
      data-mode={exporting ? "exporting" : "author"}
    >
      <div
        className={[
          styles.authorViewport,
          exporting ? styles.authorViewportHidden : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <AuthorView
          imagesPanel={props.imagesPanel}
          noLoader={props.noLoader}
          ensureChannelHistograms={props.ensureChannelHistograms}
          ensureChannelGmmContrastLimits={props.ensureChannelGmmContrastLimits}
          viewer={
            <ChannelPanel {...channelPanelProps}>{props.viewer}</ChannelPanel>
          }
        />
      </div>
      {exporting ? (
        <div className={styles.exportOverlay}>
          <ImageExporter {...exporterProps} />
        </div>
      ) : null}
    </div>
  );
};
