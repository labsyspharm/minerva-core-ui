import * as React from "react";
import { get, set } from 'idb-keyval';
import styled from 'styled-components';
import { useState, useEffect } from "react";
import { useHash } from "./lib/hashUtil";
import { hasFileSystemAccess, toDir, toLoader } from "./lib/filesystem";
import { isOpts, validate } from './lib/validate';
import { Upload } from './components/upload';
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { Props as ChannelProps } from "./components/channel"
import type { ValidObj } from './components/upload';
import type { FormEventHandler } from "react";
import type { ObjAny, KV } from './lib/validate';
import type { Config } from "./lib/exhibit";

type Props = ChannelProps & {
  config: Config;
  marker_names: string[];
  handleKeys: string[];
};

interface ReduceFormData {
  (o: ObjAny, kv: KV): ObjAny;
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
  outline: 1px solid var(--theme-glass-edge);
  background-color: var(--dark-main-glass);
  font-size: 20px;
  padding: 5vh;
  margin: 5vh;
`;

const Content = (props: Props) => {
  const { handleKeys } = props;
  const firstExhibit = readConfig(props.config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [url, setUrl] = useState(window.location.href);
  const hashContext = useHash(url, exhibit.stories);
  const [handle, setHandle] = useState(null);
  const [loader, setLoader] = useState(null);
  const [fileName, setFileName] = useState('');
  // Create ome-tiff loader
  const onAllow = async () => {
    const newHandle = await toDir();
    setHandle(newHandle);
    await set(
      handleKeys[0], newHandle 
    );
  }
  const onRecall = async () => {
    const newHandle = await get(handleKeys[0])
    const isGranted = (permission) => permission === 'granted';
    const options = { mode: 'readwrite' };
    if (
      isGranted(await newHandle.queryPermission(options))
      || isGranted(await newHandle.requestPermission(options))
    ) {
      setHandle(newHandle);
    }
  }
  const onStart = (in_f: string) => {
    (async () => {
      if (handle === null) return;
      const loader = await toLoader({ handle, in_f });
      setLoader(loader.data);
      setFileName(in_f);
    })();
  }
  // Handle changes to URL
  useEffect(() => {
    window.addEventListener("hashchange", () => {
      setUrl(window.location.href);
    });
  }, [])
  const { marker_names, title, configWaypoints } = props;

  // Actual image viewer
  const imager = loader === null ? '' : (
    <Full>
      <Index {...{
        title, configWaypoints, exhibit, setExhibit, loader,
        marker_names, in_f: fileName, handle, ...hashContext
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
  const uploadProps = {
    handleKeys, formProps, handle,
    onAllow, onRecall
  };

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
