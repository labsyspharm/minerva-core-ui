import * as React from "react";
import { get, set } from 'idb-keyval';
import styled from 'styled-components';
import { author } from "minerva-author-ui";
import { useState, useMemo, useEffect } from "react";
import { useHash } from "./lib/hashUtil";
import { onlyUUID } from './lib/config';
import { mutableItemRegistry } from './lib/config';
import { hasFileSystemAccess, toDir, toLoader } from "./lib/filesystem";
import { extractChannels, extractDistributions } from './lib/config';
import { isOpts, validate } from './lib/validate';
import { Upload } from './components/upload';
import { readConfig } from "./lib/exhibit";
import { Index } from "./components";

import type { Loader } from './viv';
import type { ValidObj } from './components/upload';
import type { ImageProps } from "./components/channel"
import type { FormEventHandler } from "react";
import type { ObjAny, KV } from './lib/validate';
import type { ExtractedChannels } from "./lib/config";
import type { ConfigWaypoint } from "./lib/config";
import type { MutableFields } from "./lib/config";
import type { ExhibitConfig } from "./lib/exhibit";

type Props = ImageProps & {
  configWaypoints: ConfigWaypoint[]; 
  exhibit_config: ExhibitConfig;
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
  const firstExhibit = readConfig(props.exhibit_config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [url, setUrl] = useState(window.location.href);
  const hashContext = useHash(url, exhibit.stories);
  const [handle, setHandle] = useState(null);
  const [config, setConfig] = useState({
    ItemRegistry: {
      Name: '', Groups: [], Colors: [],
      GroupChannels: [], SourceChannels: [],
      SourceDistributions: [],
      Stories: props.configWaypoints,
    },
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
  const [loader1, setLoader1] = useState(null);
  const [loader2, setLoader2] = useState(null);
  const [mainFileName, setMainFileName] = useState('');
  const [
    brightfieldFileName, setBrightfieldFileName
  ] = useState('');
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
  const onStart = (in_f1: string, in_f2?: string) => {
    (async () => {
      if (handle === null) return;
      let loader2: Loader | null = null;
      const loader1 = await toLoader({ handle, in_f: in_f1 });
      const has_brightfield = !!in_f2;
      if (has_brightfield) {
        loader2 = await toLoader({ handle, in_f: in_f2 });
        loader2.data.forEach(plane => {
          plane.labels = [...plane.labels, '_c']
          plane.shape = [...plane.shape, 3]
        });
      }
      const { 
        SourceChannels, GroupChannels, Groups, Colors
      } = await extractChannels(loader1, 1, false);
      if (has_brightfield) {
        const extractedBrightfield = await extractChannels(loader2, 2, true);
        extractedBrightfield.SourceChannels.forEach((sourceChannel) => {
          SourceChannels.push(sourceChannel)
        });
        extractedBrightfield.GroupChannels.forEach((groupChannel) => {
          Groups.forEach((group) => {
            GroupChannels.push({
              ...groupChannel, Associations: {
                ...groupChannel.Associations, Group: {
                  UUID: group.UUID
                }
              }
            });
          })
        });
      }
      resetItems({
        SourceChannels, GroupChannels, Groups, Colors
      });
      // Asynchronously add distributions
      extractDistributions(loader1, 1).then(
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
      const {
        Channels, TiffData, ...rest
      } = loader1.metadata.Pixels;
      setLoader1(loader1);
      setMainFileName(in_f1);
      if (has_brightfield) {
        setLoader2(loader2);
        setBrightfieldFileName(in_f2);
      }
    })();
  }
  // Handle changes to URL
  useEffect(() => {
    window.addEventListener("hashchange", () => {
      setUrl(window.location.href);
    });
  }, [])
  const { marker_names } = props;
  const mutableFields: MutableFields = [ 
    'GroupChannels' 
  ]
  // Define a WebComponent for the item panel
  const controlPanelElement = useMemo(() => author({
    ...config, ItemRegistry: mutableItemRegistry(
      config.ItemRegistry, setItems, mutableFields 
    )
  }), [config.ID])

  // Actual image viewer
  const imager = loader1 === null ? '' : (
    <Full>
      <Index {...{
        config, controlPanelElement,
        exhibit, setExhibit,
        loaders: [
          loader1, ...(loader2 === null ? [] : [loader2])
        ],
        marker_names,
        in_files: [
          mainFileName, brightfieldFileName
        ],
        handle, ...hashContext
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

  const importer = loader1 !== null ? '' : (<Scrollable>
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
