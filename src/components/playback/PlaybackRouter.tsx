import styled from "styled-components";
import { Presentation } from "@/components/playback/Presentation";
// Types
import type { ChannelPanelProps } from "@/components/shared/channel/ChannelPanel";
//import { ImageExporter } from "@/components/playback/ImageExporter";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";

export type PlaybackRouterProps = ChannelPanelProps & {
  name: string;
  ioState: null | string;
  stopExport: () => void;
  retrievingMetadata: boolean;
  presenting: boolean;
  handles: Handle.File[];
  in_f: string;
};

const _ImageDiv = styled.div`
  background-color: white;
  width: 100%;
  height: 100%;
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
    /*
    const exporterProps = {
      in_f: props.in_f,
      stopExport: props.stopExport,
      directory_handle: props.directory_handle
    };
    out = <ImageExporter {...exporterProps} />;
    */
  }
  return <>{out}</>;
};
