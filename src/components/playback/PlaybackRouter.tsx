import * as React from "react";
import { ImageExporter } from "@/components/playback/ImageExporter";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import { Presentation } from "@/components/playback/Presentation";
import styled from "styled-components";

// Types
import type { ChannelPanelProps } from "@/components/shared/channel/ChannelPanel";

export type PlaybackRouterProps = ChannelPanelProps & {
  name: string;
  ioState: null | string;
  stopExport: () => void;
  retrievingMetadata: boolean;
  presenting: boolean;
  handle: Handle.Dir;
  in_f: string;
}

const ImageDiv = styled.div`
  background-color: white;
  width: 100%;
  height: 100%;
`;

export const PlaybackRouter = (props: PlaybackRouterProps) => {
  const { handle, in_f } = props;
  const { stopExport } = props;

  let out = <></>;
  if (props.presenting) {
    const image_div = <ImageDiv/>;
    out = (
      <Presentation {...props}>
        <ChannelPanel {...props}/>
      </Presentation>
    )
  }
  else if (props.ioState == 'IDLE') {
    out = <ChannelPanel {...props}/>
  }
  else if (props.ioState == 'EXPORTING') {
    const exporterProps = { 
      handle, in_f, stopExport
    };
    out = <ImageExporter {...exporterProps}/>;
  }
  return <>{out}</>;
};
