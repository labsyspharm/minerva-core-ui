import * as React from "react";
import { Exporter } from "./exporter";
import { Waypoint } from "./waypoint";
import { Info } from "./info";

// Types
import type { Props } from "./waypoint";

type MainProps = Props & {
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
      out = <Waypoint {...props}/>;
    }
  }
  return <>{out}</>;
};

export { Main };
