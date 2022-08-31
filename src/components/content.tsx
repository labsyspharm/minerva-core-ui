import * as React from "react";
import { useHash } from "../lib/hashUtil";
import { Waypoint } from "./waypoint";
import { Info } from "./info";

// Types
import type { Props } from "./waypoint";

const Main = (props: Props) => {
  const hash = useHash();
  if (hash.i >= 0) {
    return <Info/>;
  }
  return <Waypoint {...props}/>;
};

export {Main};
