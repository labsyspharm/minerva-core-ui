import * as React from "react";
import { useState } from "react";
import { unstable_HistoryRouter as HistoryRouter } from "react-router-dom";
import { useHashHistory } from "use-hash-history";
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { Config } from "./lib/exhibit";

const defaultPath = ({ location }) => {
  const { pathname, search } = location;
  return { pathname, search };
};
const history = useHashHistory({
  defaultPath: defaultPath(window),
  hashSlash: "#",
  hashRoot: "",
  window,
});

type Props = {
  config: Config;
};

const Main = (props: Props) => {
  const firstExhibit = readConfig(props.config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  return (
    <HistoryRouter history={history}>
      <Index {...{ exhibit, setExhibit }} />
    </HistoryRouter>
  );
};

export { Main };
