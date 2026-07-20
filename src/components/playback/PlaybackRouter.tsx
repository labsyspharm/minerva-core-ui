import type { ReactNode } from "react";
import styled from "styled-components";
import { AuthorView } from "@/components/authoring/AuthorSidebar";
import { ImageExporter } from "@/components/playback/ImageExporter";
import { Presentation } from "@/components/playback/Presentation";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import type { OmeLoaderEntry } from "@/components/shared/viewer/ImageViewer";
import type { ContrastLimits } from "@/lib/imaging/autoContrast";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type { Config } from "@/lib/imaging/viv";
import type { StoryExportMode } from "@/lib/storyExport/storyBundle";

export type PlaybackRouterProps = {
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

const ModeViewport = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  > * {
    flex: 1;
    min-height: 0;
  }

  animation: modeViewportIn 0.2s ease-out;

  @keyframes modeViewportIn {
    from {
      opacity: 0.88;
    }

    to {
      opacity: 1;
    }
  }
`;

/** Keep Deck mounted under export UI so WebGL layer state is not destroyed. */
const AuthorViewport = styled.div<{ $hidden: boolean }>`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  visibility: ${(p) => (p.$hidden ? "hidden" : "visible")};
  pointer-events: ${(p) => (p.$hidden ? "none" : "auto")};

  > * {
    flex: 1;
    min-height: 0;
  }
`;

const ExportOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
`;

export const PlaybackRouter = (props: PlaybackRouterProps) => {
  const channelPanelProps = {
    hiddenChannel: props.hiddenChannel,
    noLoader: props.noLoader,
  };

  if (props.presenting) {
    return (
      <ModeViewport key="presenting" data-mode="presenting">
        <Presentation exitPlaybackPreview={props.exitPlaybackPreview}>
          <ChannelPanel {...channelPanelProps}>{props.viewer}</ChannelPanel>
        </Presentation>
      </ModeViewport>
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
    <ModeViewport key="author" data-mode={exporting ? "exporting" : "author"}>
      <AuthorViewport $hidden={exporting}>
        <AuthorView
          imagesPanel={props.imagesPanel}
          noLoader={props.noLoader}
          ensureChannelHistograms={props.ensureChannelHistograms}
          ensureChannelGmmContrastLimits={props.ensureChannelGmmContrastLimits}
          viewer={
            <ChannelPanel {...channelPanelProps}>{props.viewer}</ChannelPanel>
          }
        />
      </AuthorViewport>
      {exporting ? (
        <ExportOverlay>
          <ImageExporter {...exporterProps} />
        </ExportOverlay>
      ) : null}
    </ModeViewport>
  );
};
