import * as React from "react";
import { Exporter } from "./exporter";
import { Channel } from "./channel";
import { Presentation } from "./presentation";
import styled from "styled-components";

// Types
import type { Props as ChannelProps } from "./channel";

type MainProps = ChannelProps & {
  ioState: null | string;
  stopExport: () => void;
  presenting: boolean;
  handle: Handle.Dir;
  in_f: string;
}

const ImageDiv = styled.div`
  background-color: white;
  width: 100%;
  height: 100%;
`;

const Main = (props: MainProps) => {
  const { handle, in_f } = props;
  const { stopExport } = props;

  let out = <></>;
  if (props.presenting) {
    const image_div = <ImageDiv/>;
    out = (
      <Presentation {...props}>
        <Channel {...props}/>
        {props.children}
      </Presentation>
    )
  }
  else if (props.ioState == 'IDLE') {
    out = <Channel {...props}/>
  }
  else if (props.ioState == 'EXPORTING') {
    const exporterProps = { 
      handle, in_f, stopExport
    };
    out = <Exporter {...exporterProps}/>;
  }
  return <>{out}</>;
};

export { Main };
