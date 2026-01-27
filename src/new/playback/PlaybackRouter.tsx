import * as React from "react";
import { Exporter } from "src/components/exporter";
import { ChannelPanel } from "src/new/shared/components/ChannelPanel/ChannelPanel";
import { Presentation } from "src/new/playback/Presentation";
import styled from "styled-components";

// Types
import type { ChannelPanelProps } from "src/new/shared/components/ChannelPanel/ChannelPanel";

export type PlaybackRouterProps = ChannelPanelProps & {
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
    out = <Exporter {...exporterProps}/>;
  }
  return <>{out}</>;
};
