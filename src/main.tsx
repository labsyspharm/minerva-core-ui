import * as React from "react";
import { get, set } from 'idb-keyval';
import styled from 'styled-components';
import { author } from "./minerva-author-ui/author";
import { useState, useMemo, useEffect } from "react";
import { loadDicomWeb, parseDicomWeb } from "./lib/dicom";
import { useHash, toEmptyHash } from "./lib/hashUtil";
import { onlyUUID } from './lib/config';
import { mutableItemRegistry } from './lib/config';
import { hasFileSystemAccess, toDir, toLoader } from "./lib/filesystem";
import { extractChannels, extractDistributions } from './lib/config';
import { isOpts, validate } from './lib/validate';
import { Upload } from './components/upload';
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";
import Pool from './lib/workers/Pool';
import { parseRoisFromLoader } from './lib/roiParser';
import { useOverlayStore } from './lib/stores';

import type { DicomLoader, DicomIndex } from "./components";
import type { ValidObj } from './components/upload';
import type { ImageProps } from "./components/channel"
import type { FormEventHandler } from "react";
import type { ObjAny, KV } from './lib/validate';
import type { ItemRegistryProps } from "./lib/config";
import type { ConfigWaypoint } from "./lib/config";
import type { MutableFields } from "./lib/config";
import type { ExhibitConfig } from "./lib/exhibit";
import type { ConfigGroup } from "./lib/exhibit";

type Props = ImageProps & {
  configWaypoints: ConfigWaypoint[];
  exhibit_config: ExhibitConfig;
  demo_dicom_web?: boolean;
  handleKeys: string[];
  h_and_e?: boolean;
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
  const firstExhibit = readConfig(props.exhibit_config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [hash, _setHash] = useState(toEmptyHash(exhibit.stories));
  const setHash = (partial_hash) => {
    _setHash({...hash, ...partial_hash})
  }
  const [handle, setHandle] = useState(null);
  const [loader, setLoader] = useState(null);
  const [dicomSeries, setDicomSeries] = useState(null);
  const [dicomIndex, setDicomIndex] = useState(
    { } as DicomIndex
  );
  const [config, setConfig] = useState({
    ItemRegistry: {
      Name: '', Groups: [], Colors: [],
      GroupChannels: [], SourceChannels: [],
      SourceDistributions: [],
      Stories: props.configWaypoints,
    } as ItemRegistryProps,
    ID: crypto.randomUUID()
  });
  // Active Group from Store
  const { 
    setActiveChannelGroup
  } = useOverlayStore();
  const resetItems = ItemRegistry => {
    setConfig(config => ({
      ...config, ItemRegistry: {
        ...config.ItemRegistry, ...ItemRegistry
      },
      ID: crypto.randomUUID()
    }));
    const { Groups } = ItemRegistry;
    if ( Groups?.length > 0) {
      setActiveChannelGroup(Groups[0].UUID)
    }
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
    } = extractChannels(loader, []);
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
    // handle hard-coded channels for dicom-web demo
    if (type == "DICOM-WEB") {
      onStartDicomWeb(s, props.exhibit_config.Groups);
    }
    onStartOmeTiff(s);
  }
  // Handle changes to URL
  useEffect(() => {
    const urlContext = useHash(
      window.location.href, exhibit.stories
    );
    console.log(hash);
    urlContext.setHash(hash);
  }, [hash])
  // Dicom Web derived state
  const onStartDicomWeb = async (
    series: string, groups: ConfigGroup[]
  ) => {
    setDicomSeries(series);
    const dicomIndex = await loadDicomWeb(series);
    const loader = (
      parseDicomWeb(series, dicomIndex) as DicomLoader
    );
    setDicomIndex(dicomIndex);
    setLoader(loader);
    const {
      SourceChannels, GroupChannels, Groups, Colors
    } = extractChannels(loader, groups);
    resetItems({
      SourceChannels,
      GroupChannels,
      Groups, Colors
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

  }
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
  // Actual image viewer
  const imager = loader === null ? '' : (
    <Full>
      <Index {...{
        dicomIndex: dicomIndex,
        dicomSeries: dicomSeries,
        config, controlPanelElement,
        exhibit, setExhibit, loader,
        in_f: fileName, handle, hash, setHash 
      }} />
    </Full>
  )
  const [valid, setValid] = useState({} as ValidObj);
  if (props.demo_dicom_web) {
    useEffect(() => {
      const h_and_e = props.h_and_e;
      onStart(
        ["https://us-central1-idc-external-031.cloudfunctions.net/minerva_proxy/studies/2.25.112849421593762410108114587383519700602/series/1.3.6.1.4.1.5962.99.1.331207435.2054329796.1752677896971.4.0",
        "https://us-central1-idc-external-031.cloudfunctions.net/minerva_proxy/studies/2.25.112849421593762410108114587383519700602/series/1.3.6.1.4.1.5962.99.1.714652616.317867787.1753061342152.4.0"][+h_and_e],
        "DICOM-WEB"
      )
    }, []);
    if ( loader === null) {
      return <Wrapper>Retrieving DICOM metadata...</Wrapper>
    }
  }
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
    <Upload {...uploadProps} />
  </Scrollable>)
  return (
    <Wrapper>
      {imager}
      {importer}
    </Wrapper>
  );
};

const Main = (props: Props) => {
  if (props.demo_dicom_web || hasFileSystemAccess()) {
    return <Content {...props} />;
  } else {
    return <div><p>Unable to access FileSystem API.</p></div>;
  }
};


export { Main };
