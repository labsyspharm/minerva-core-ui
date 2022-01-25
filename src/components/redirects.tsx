import * as React from "react";
import { Route, Navigate } from "react-router-dom";
import { useHashPath, useRedirects } from "../lib/hashUtil";

import type { HashState } from "../lib/hashUtil";

type Props = {
  path: string;
  children: any[];
  noHash: HashState;
};

const RedirectElement = ({ noHash }) => {
  const hash = useHashPath(noHash);
  return <Navigate replace to={hash} />;
};

const Redirect = (props: Props) => {
  const { path, children, noHash } = props;
  const element = <RedirectElement noHash={noHash} />;
  return (
    <Route key={path} {...{ path, element }}>
      {children}
    </Route>
  );
};

const Redirects = ({ stories }) => {
  return useRedirects(stories, Redirect);
};

export { Redirects };
