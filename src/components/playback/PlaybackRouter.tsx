import type { ReactNode } from "react";
import styled from "styled-components";
import { AuthorView } from "@/components/authoring/AuthorSidebar";
import { ImageExporter } from "@/components/playback/ImageExporter";
import { Presentation } from "@/components/playback/Presentation";
import type { ChannelPanelProps } from "@/components/shared/channel/ChannelPanel";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import type {
  ItemRegistryGroup,
  OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type { Config } from "@/lib/imaging/viv";

export type PlaybackRouterProps = {
  viewer: ReactNode;
  imagesPanel: ReactNode;
  hiddenChannel: boolean;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  name: string;
  ioState: null | string;
  stopExport: () => void;
  presenting: boolean;
  handles: Handle.File[];
  in_f: string;
  viewerConfig: Config;
  groups: ItemRegistryGroup[];
  directory_handle: FileSystemDirectoryHandle;
  exitPlaybackPreview?: () => void;
  dicomIndexList: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
};

const ModeViewport = styled.div`
  height: 100%;
  min-height: 0;
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

export const PlaybackRouter = (props: PlaybackRouterProps) => {
  const channelPanelProps: Omit<ChannelPanelProps, "children"> = {
    hiddenChannel: props.hiddenChannel,
    noLoader: props.noLoader,
  };

  let out = <></>;
  if (props.presenting) {
    out = (
      <Presentation
        name={props.name}
        exitPlaybackPreview={props.exitPlaybackPreview}
      >
        <ChannelPanel {...channelPanelProps}>{props.viewer}</ChannelPanel>
      </Presentation>
    );
  } else if (props.ioState === "IDLE") {
    out = (
      <AuthorView
        imagesPanel={props.imagesPanel}
        noLoader={props.noLoader}
        ensureChannelHistograms={props.ensureChannelHistograms}
        viewer={
          <ChannelPanel {...channelPanelProps}>{props.viewer}</ChannelPanel>
        }
      />
    );
  } else if (props.ioState === "EXPORTING") {
    out = (
      <ImageExporter
        in_f={props.in_f}
        groups={props.groups}
        handles={props.handles}
        stopExport={props.stopExport}
        viewerConfig={props.viewerConfig}
        dicomIndexList={props.dicomIndexList}
        omeLoaderEntries={props.omeLoaderEntries}
        directory_handle={props.directory_handle}
      />
    );
  }
  const modeKey = props.presenting
    ? "presenting"
    : props.ioState === "IDLE"
      ? "author"
      : "other";

  return (
    <ModeViewport key={modeKey} data-mode={modeKey}>
      {out}
    </ModeViewport>
  );
};
