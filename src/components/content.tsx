import * as React from "react";
import { Waypoint } from "./waypoint";
import { Info } from "./info";

// Types
import type { Props } from "./waypoint";

const Main = (props: Props) => {
  if (props.hash.i >= 0) {
    return <Info {...props}/>;
  }
  return <Waypoint {...props}/>;
};

export {Main};
