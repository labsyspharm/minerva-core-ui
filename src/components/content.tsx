import * as React from "react";
import { Exporter } from "./exporter";
import { Channel } from "./channel";

// Types
import type { Props as ChannelProps } from "./channel";

type MainProps = ChannelProps & {
  ioState: null | string;
  stopExport: () => void;
  handle: Handle.Dir;
  in_f: string;
}

const Main = (props: MainProps) => {
  const { handle, in_f } = props;
  const { stopExport } = props;

  let out = <></>;
  if (props.ioState == 'IDLE') {
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
