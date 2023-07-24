import * as React from "react";
import styled from 'styled-components';
import { useState, useEffect } from "react";
import { useHash } from "./lib/hashUtil";
import { loadOmeTiff } from "@hms-dbmi/viv";
import { hasFileSystemAccess, toDir, toLoader } from "./lib/filesystem";
import { isOpts, validate } from './lib/validate';
import { Upload } from './components/upload';
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { ValidObj } from './components/upload';
import type { FormEventHandler } from "react";
import type { ObjAny, KV } from './lib/validate';
import type { Config } from "./lib/exhibit";

type Props = {
  config: Config;
};

interface ReduceFormData {
  (o: ObjAny, kv: KV): ObjAny;
}

const devSetup = (loader: any, setLoader: any ) => {
  const DEV_URL = "http://localhost:3000/LSP10353.ome.tiff";
  loadOmeTiff(DEV_URL).then((loader) => {
    setLoader('set', loader.data);
  });
}

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

const Scrollable = styled.div`
  z-index: 2;
  grid-column: 2;
  grid-row: 1 / -1;
  overflow-y: scroll;
  border-radius: 12px;
  background-color: hwb(220 10% 20% / .5);
  cursor: pointer;
  font-size: 20px;
  padding: 5vh;
  margin: 5vh;
`;

const Content = (props: Props) => {
  const firstExhibit = readConfig(props.config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [url, setUrl] = useState(window.location.href);
  const hashContext = useHash(url, exhibit.stories);
  const [handle, setHandle] = useState(null);
  const [loader, setLoader] = useState(null);

  // Dev setup
  useEffect(() => {
    devSetup(loader, setLoader);
  });

  // Create ome-tiff loader
  const onAllow = async () => {
    const newHandle = await toDir();
    setHandle(newHandle);
  }
  const onStart = (in_f: string) => {
    (async () => {
      if (handle === null) return;
      const loader = await toLoader({ handle, in_f });
      setLoader(loader);
    })();
  }
  // Handle changes to URL
  useEffect(() => {
    window.addEventListener("hashchange", () => {
      setUrl(window.location.href);
    });
  }, [])

  // Actual image viewer
  const imager = loader === null ? '' : (
    <Full>
      <Index {...{
        exhibit, setExhibit, loader,
        ...hashContext
      }} />
    </Full>
  )

  const [valid, setValid] = useState({} as ValidObj);
  const onSubmit: FormEventHandler = (event) => {
    const form = event.currentTarget as HTMLFormElement;
    const data = [...new FormData(form).entries()];
    const formOut = data.reduce(((o, [k,v]) => {
      return { ...o, [k]: `${v}`};
    }) as ReduceFormData, {mask: ""});
    const filled = (form as any).checkValidity(); 
    const formOpts = { formOut, onStart, handle };
    if (isOpts(formOpts)) {
      validate(formOpts).then((valid: ValidObj) => {
        setValid(valid);
      })
    }
    event.preventDefault();
    event.stopPropagation();
  }
  const formProps = { onSubmit, valid };
  const uploadProps = { formProps, handle, onAllow };

  const importer = loader !== null ? '' : (<Scrollable>
    <Upload {...uploadProps}/>
  </Scrollable>)
  return (
    <Wrapper>
      { imager }
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
