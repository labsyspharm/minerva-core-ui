import * as React from "react";
import { useState, useEffect } from "react";
import { useHash } from "./lib/hashUtil";
//import { useHashHistory } from "use-hash-history";
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { Config } from "./lib/exhibit";

/*const defaultPath = ({ location }) => {
  const { pathname, search } = location;
  return { pathname, search };
};
*/
/*const history = useHashHistory({
  defaultPath: defaultPath(window),
  hashSlash: "#",
  hashRoot: "",
  window,
});*/

type Props = {
  config: Config;
};

const Main = (props: Props) => {
  const firstExhibit = readConfig(props.config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [url, setUrl] = useState(window.location.href);
  const hashContext = useHash(url, exhibit.stories);
  // Handle changes to URL
  window.addEventListener("hashchange", () => {
    setUrl(window.location.href);
    console.error("The hash has changed!");
  });
  return (
    <Index {...{
      exhibit, setExhibit,
      ...hashContext
    }} />
  );
};

export { Main };
