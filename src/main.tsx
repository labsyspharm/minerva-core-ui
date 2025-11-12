import * as React from "react";
import { get, set } from 'idb-keyval';
import styled from 'styled-components';
import { author } from "minerva-author-ui";
import { useState, useMemo, useEffect } from "react";
import { testLoader, testChannels } from "./lib/dicom";
import { loadDicomWeb, parseDicomWeb } from "./lib/dicom";
import { useHash } from "./lib/hashUtil";
import { onlyUUID } from './lib/config';
import { mutableItemRegistry } from './lib/config';
import { hasFileSystemAccess, toDir, toLoader } from "./lib/filesystem";
import { extractChannels, extractDistributions } from './lib/config';
import { isOpts, validate } from './lib/validate';
import { Upload } from './components/upload';
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { DicomLoader } from "./components";
import type { ValidObj } from './components/upload';
import type { ImageProps } from "./components/channel"
import type { FormEventHandler } from "react";
import type { ObjAny, KV } from './lib/validate';
import type { ItemRegistryProps } from "./lib/config";
import type { ConfigWaypoint } from "./lib/config";
import type { MutableFields } from "./lib/config";
import type { ExhibitConfig } from "./lib/exhibit";

type Props = ImageProps & {
  configWaypoints: ConfigWaypoint[]; 
  exhibit_config: ExhibitConfig;
  marker_names: string[];
  handleKeys: string[];
  testDicom: boolean;
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

const createPlaceholderFromLoader = (loader) => {
  return testChannels;
}

const Content = (props: Props) => {
  const { testDicom, handleKeys } = props;
  const firstExhibit = readConfig(props.exhibit_config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [url, setUrl] = useState(window.location.href);
  const hashContext = useHash(url, exhibit.stories);
  const [handle, setHandle] = useState(null);
  const [loader, setLoader] = useState(null);
  const [dicomSeries, setDicomSeries] = useState(null);
  const [dicomIndex, setDicomIndex] = useState(null);
  const [config, setConfig] = useState({
    ItemRegistry: {
      Name: '', Groups: [], Colors: [],
      GroupChannels: [], SourceChannels: [],
      SourceDistributions: [],
      Stories: props.configWaypoints,
      ...(testDicom ? (
        createPlaceholderFromLoader(loader)
      ): {})
    } as ItemRegistryProps,
    ID: crypto.randomUUID()
  });
  const resetItems = ItemRegistry => {
    setConfig(config => ({
      ...config, ItemRegistry: {
        ...config.ItemRegistry, ...ItemRegistry
      },
      ID: crypto.randomUUID()
    }));
  };
  const setItems = ItemRegistry => {
    setConfig(config => ({
      ...config, ItemRegistry: {
        ...config.ItemRegistry, ...ItemRegistry
      },
    }));
  }
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
  const onStartOmeTiff = async (in_f: string) => {
    if (handle === null) return;
    const loader = await toLoader({ handle, in_f, pool: new Pool() });
    const {
      SourceChannels, GroupChannels, Groups, Colors
    } = extractChannels(loader);
    resetItems({
      SourceChannels, GroupChannels, Groups, Colors
    });
    // Asynchronously add distributions
    extractDistributions(loader).then(
      (sourceDistributionMap) => {
        const SourceDistributions = sourceDistributionMap.values();
        resetItems({
          SourceDistributions: [...SourceDistributions],
          SourceChannels: SourceChannels.map(sourceChannel => ({
            ...sourceChannel, Associations: {
              ...sourceChannel.Associations,
              SourceDistribution: sourceDistributionMap.get(
                sourceChannel.Properties.SourceIndex
              )
            }
          }))
        });
      }
    );
    setLoader(loader);
    setFileName(in_f);
  }
  const onStart = (s: string, type: string) => {
    if (type == "DICOM-WEB") {
      onStartDicomWeb(s);
    }
    onStartOmeTiff(s);
  }
  // Handle changes to URL
  useEffect(() => {
    window.addEventListener("hashchange", () => {
      setUrl(window.location.href);
    });
  }, [])
  // Dicom Web derived state
  const onStartDicomWeb = async (series: string) => {
    setDicomSeries(series);
    setDicomIndex(await loadDicomWeb(series));
  }
  useEffect(() => {
    setLoader(
      parseDicomWeb(dicomIndex) as DicomLoader
    );
  }, [dicomIndex]);

  const { marker_names } = props;
  const mutableFields: MutableFields = [ 
    'GroupChannels' 
  ]
  const ItemRegistry = mutableItemRegistry(
    config.ItemRegistry, setItems, mutableFields 
  )
  // Define a WebComponent for the item panel
  const controlPanelElement = useMemo(() => author({
    ...config, ItemRegistry
  }), [config.ID])

  console.log(JSON.stringify(dicomIndex), "ok");
  console.log(JSON.stringify(loader), "ok");
  // Actual image viewer
  const imager = loader === null ? '' : (
    <Full>
      <Index {...{
        dicomSeries: dicomSeries,
        config, controlPanelElement,
        exhibit, setExhibit, loader,
        marker_names, in_f: fileName, handle, ...hashContext
      }} />
    </Full>
  )

  const [valid, setValid] = useState({} as ValidObj);
  const onSubmit: FormEventHandler = (event) => {
    const form = event.currentTarget as HTMLFormElement;
    const data = [...new FormData(form).entries()];
    const formOut = data.reduce(((o, [k, v]) => {
      return { ...o, [k]: `${v}` };
    }) as ReduceFormData, { mask: "" });
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
