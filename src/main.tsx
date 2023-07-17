import * as React from "react";
import styled from 'styled-components';
import { useState, useEffect } from "react";
import { useHash } from "./lib/hashUtil";
import { hasFileSystemAccess, toLoader } from "./lib/filesystem";
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { Config } from "./lib/exhibit";

type Props = {
  config: Config;
};

const Wrapper = styled.div`
  height: 100%;
  display: grid;
  grid-template-columns: 1fr auto 1fr; 
  grid-template-rows: 33vh 1fr 33vh; 
`;

const Full = styled.div`
  grid-row: 1 / -1;
  grid-column: 1 / -1;
`

const Clickable = styled.div`
  z-index: 2;
  grid-row: 2;
  grid-column: 2;
  background-color: hwb(220 10% 20% / .8);
  cursor: pointer;
  font-size: 30px;
  padding: 4em;
`;

const Content = (props: Props) => {
  const firstExhibit = readConfig(props.config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [url, setUrl] = useState(window.location.href);
  const hashContext = useHash(url, exhibit.stories);
  const [loader, setLoader] = useState(null);
  // Create ome-tiff loader
  const onStart = () => {
    (async () => {
      const loader = await toLoader();
      setLoader(loader.data);
    })();
  }
  // Handle changes to URL
  useEffect(() => {
    window.addEventListener("hashchange", () => {
      setUrl(window.location.href);
    });
  }, [])
  console.log(loader);
  const importer = loader ? '' : (
    <Clickable onClick={onStart}>
      Open Directory
    </Clickable>
  )
  return (
    <Wrapper>
      <Full>
        <Index {...{
          exhibit, setExhibit, loader,
          ...hashContext
        }} />
      </Full>
      { importer }
    </Wrapper>
  );
};

const Main = (props: Props) => {
  if (hasFileSystemAccess()) {
    return <Content {...props}/>;
  }
  const error_message = `<p>
  Unable to access file system api.
  </p>`
  return <div>{error_message}</div>;
};


export { Main };
