import * as React from "react";
import { Exporter } from "./exporter";
import { Channel } from "./channel";
import { Info } from "./info";

// Types
import type { Props as WaypointProps } from "./waypoint";
import type { Props as ChannelProps } from "./channel";

type MainProps = WaypointProps & ChannelProps & {
  ioState: null | string;
  stopExport: () => void;
  handle: Handle.Dir;
  in_f: string;
}

const Main = (props: MainProps) => {
  const { handle, in_f } = props;
  const { stopExport } = props;
  const exporterProps = { 
    handle, in_f, stopExport
  };
  let out = <Exporter {...exporterProps}/>;
  if (props.ioState == 'IDLE') {
    if (props.hash.i >= 0) {
      out = <Info {...props}/>;
    }
    else {
      out = <Channel {...props}/>;
    }
  }
  return <>{out}</>;
};

export { Main };
