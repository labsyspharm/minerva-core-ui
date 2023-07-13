import * as React from "react";
import { useState, useEffect } from "react";
import { useHash } from "./lib/hashUtil";
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { Config } from "./lib/exhibit";

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
  });
  return (
    <Index {...{
      exhibit, setExhibit,
      ...hashContext
    }} />
  );
};

export { Main };
