import styled from "styled-components";
import { ImageExporter } from "@/components/playback/ImageExporter";
import { Presentation } from "@/components/playback/Presentation";
import { StoryPlaybackView } from "@/components/playback/StoryPlaybackView";
import type { ChannelPanelProps } from "@/components/shared/channel/ChannelPanel";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import type { ItemRegistryGroup } from "@/components/shared/viewer/ImageViewer";
import type { Config } from "@/lib/imaging/viv";
import type { StoryExportMode } from "@/lib/storyExport/storyBundle";
import type { StoryPlaybackLoaders } from "./useStoryPlaybackLayers";

export type PlaybackRouterProps = ChannelPanelProps &
  StoryPlaybackLoaders & {
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
    exportMode?: StoryExportMode;
  };

const ModeViewport = styled.div`
  position: relative;
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

/** Keep Deck mounted under export UI so WebGL layer state is not destroyed. */
const AuthorViewport = styled.div<{ $hidden: boolean }>`
  height: 100%;
  min-height: 0;
  visibility: ${(p) => (p.$hidden ? "hidden" : "visible")};
  pointer-events: ${(p) => (p.$hidden ? "none" : "auto")};
`;

const ExportOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
`;

export const PlaybackRouter = (props: PlaybackRouterProps) => {
  if (props.presenting) {
    return (
      <ModeViewport key="presenting" data-mode="presenting">
        <Presentation
          name={props.name}
          exitPlaybackPreview={props.exitPlaybackPreview}
        >
          <StoryPlaybackView
            jpegLoaderEntries={props.jpegLoaderEntries}
            setJpegLoaderEntries={props.setJpegLoaderEntries}
            omeLoaderEntries={props.omeLoaderEntries}
            dicomIndexList={props.dicomIndexList}
          />
        </Presentation>
      </ModeViewport>
    );
  }

  const exporting = props.ioState === "EXPORTING";
  return (
    <ModeViewport key="author" data-mode={exporting ? "exporting" : "author"}>
      <AuthorViewport $hidden={exporting}>
        <ChannelPanel {...props}>{props.children}</ChannelPanel>
      </AuthorViewport>
      {exporting ? (
        <ExportOverlay>
          <ImageExporter
            in_f={props.in_f}
            groups={props.groups}
            handles={props.handles}
            stopExport={props.stopExport}
            viewerConfig={props.viewerConfig}
            dicomIndexList={props.dicomIndexList}
            omeLoaderEntries={props.omeLoaderEntries}
            directory_handle={props.directory_handle}
            exportMode={props.exportMode}
          />
        </ExportOverlay>
      ) : null}
    </ModeViewport>
  );
};
