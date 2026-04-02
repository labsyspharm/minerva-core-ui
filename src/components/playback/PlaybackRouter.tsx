import styled from "styled-components";
import { ImageExporter } from "@/components/playback/ImageExporter";
import { Presentation } from "@/components/playback/Presentation";
// Types
import type { ChannelPanelProps } from "@/components/shared/channel/ChannelPanel";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";

export type PlaybackRouterProps = ChannelPanelProps & {
  name: string;
  ioState: null | string;
  stopExport: () => void;
  presenting: boolean;
  handles: Handle.File[];
  in_f: string;
  exitPlaybackPreview?: () => void;
};

const _ImageDiv = styled.div`
  background-color: white;
  width: 100%;
  height: 100%;
`;

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
  let out = <></>;
  if (props.presenting) {
    out = (
      <Presentation {...props}>
        <ChannelPanel {...props}>{props.children}</ChannelPanel>
      </Presentation>
    );
  } else if (props.ioState === "IDLE") {
    out = <ChannelPanel {...props}>{props.children}</ChannelPanel>;
  } else if (props.ioState === "EXPORTING") {
    // TODO: no UI yet for user selection of directory_handle
    const exporterProps = {
      in_f: props.in_f,
      handles: props.handles,
      stopExport: props.stopExport,
      directory_handle: props.directory_handle,
    };
    out = <ImageExporter {...exporterProps} />;
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
