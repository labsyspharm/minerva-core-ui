import * as React from "react";
import styled from "styled-components";
import { author } from "@/minerva-author-ui/author";
import { useState, useMemo, useEffect } from "react";
import { loadDicomWeb, parseDicomWeb } from "@/lib/dicom";
import { toEmptyHash } from "@/lib/hashUtil";
import {
  mutableItemRegistry,
  extractChannels,
  extractDistributions,
} from "@/lib/config";
import { hasFileSystemAccess, toLoader } from "@/lib/filesystem";
import { isOpts, validate } from "@/lib/validate";
import { Upload } from "@/components/shared/Upload";
import { readConfig } from "@/lib/exhibit";
import Pool from "@/lib/workers/Pool";
import { parseRoisFromLoader } from "@/lib/roiParser";
import { useOverlayStore } from "@/lib/stores";
import { FileHandler } from "@/components/shared/FileHandler";
import {
  ImageViewer,
  toImageProps,
} from "@/components/shared/viewer/ImageViewer";
import { PlaybackRouter } from "@/components/playback/PlaybackRouter";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import { Presentation } from "@/components/playback/Presentation";

import type { DicomIndex, DicomLoader } from "@/lib/dicom-index";
import type { ValidObj } from "@/components/shared/Upload";
import type { ImageProps } from "@/components/shared/common/types";
import type { FormEventHandler } from "react";
import type { ObjAny, KV } from "@/lib/validate";
import type { ItemRegistryProps } from "@/lib/config";
import type { ConfigWaypoint } from "@/lib/config";
import type { MutableFields } from "@/lib/config";
import type { ExhibitConfig } from "@/lib/exhibit";
import type { ConfigGroup } from "@/lib/exhibit";
import type { Waypoint as WaypointType, Exhibit } from "@/lib/exhibit";
import type { HashContext } from "@/lib/hashUtil";
import type { ConfigProps } from "@/lib/config";
import type { Loader } from "@/lib/viv";

type Props = ImageProps & {
  configWaypoints: ConfigWaypoint[];
  exhibit_config: ExhibitConfig;
  demo_dicom_web?: boolean;
  handleKeys: string[];
};

interface ReduceFormData {
  (o: ObjAny, kv: KV): ObjAny;
}

const Wrapper = styled.div`
  height: 100%;
  display: grid;
  grid-template-columns: 1fr; 
  grid-template-rows: 1fr; 
`;

const Full = styled.div`
  max-height: 100vh;
`;

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

const RetrievingWrapper = styled.div`
  height: 100%;
  display: grid;
  grid-template-columns: 1fr; 
  grid-template-rows: 1fr; 
  justify-items: center;
  align-items: center;
`;

// Helper functions for exhibit editing
const onLoaded = (setter) => {
  return (el) => (el ? setter(el) : null);
};

const setContainer = ({ container, idx, key, newItem }) => {
  const extra = idx >= container[key].length ? [newItem] : [];
  const newItems = container[key].concat(extra).map((item, i) => {
    return i === idx ? newItem : item;
  });
  return { ...container, [key]: newItems };
};

const setStory = ({ exhibit, s, newStory }) => {
  return setContainer({
    newItem: newStory,
    container: exhibit,
    key: "stories",
    idx: s,
  });
};

const setWaypoint = ({ exhibit, s, w, newWaypoint }) => {
  const story = exhibit.stories[s];
  const newStory = setContainer({
    newItem: newWaypoint,
    container: story,
    key: "waypoints",
    idx: w,
  });
  return setStory({ exhibit, s, newStory });
};

const setGroup = ({ exhibit, g, newGroup }) => {
  return setContainer({
    newItem: newGroup,
    container: exhibit,
    key: "groups",
    idx: g,
  });
};

const setChannel = ({ exhibit, g, idx, newChannel }) => {
  const group = exhibit.groups[g];
  const newGroup = setContainer({
    newItem: newChannel,
    container: group,
    key: "channels",
    idx,
  });
  return setGroup({ exhibit, g, newGroup });
};

const removeKey = (container, key, idx) => {
  const newList = container[key].filter((_, i) => i !== idx);
  return { ...container, [key]: newList };
};

const Content = (props: Props) => {
  const { handleKeys } = props;
  const firstExhibit = readConfig(props.exhibit_config);
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [hash, _setHash] = useState(toEmptyHash(exhibit.stories));
  const setHash = (partial_hash) => {
    _setHash({ ...hash, ...partial_hash });
  };
  const [loaderOmeTiff, setLoaderOmeTiff] = useState(null);
  const [dicomIndexList, setDicomIndexList] = useState([] as DicomIndex[]);
  const [config, setConfig] = useState({
    ItemRegistry: {
      Name: "",
      SourceDistributions: [],
      Stories: props.configWaypoints,
    } as ItemRegistryProps,
    ID: crypto.randomUUID(),
  });

  // UI State (from Index)
  const [ioState, setIoState] = useState("IDLE");
  const [presenting, setPresenting] = useState(false);
  const [zoomInEl, setZoomIn] = useState(null);
  const [zoomOutEl, setZoomOut] = useState(null);
  const [editable, setEditable] = useState(false);
  const checkWindow = () => {
    return window.innerWidth > 600;
  };
  const [twoNavOk, setTwoNavOk] = useState(checkWindow());
  const [hiddenWaypoint, setHideWaypoint] = useState(false);
  const [hiddenChannel, setHideChannel] = useState(!twoNavOk);

  const handleResize = () => {
    const twoNavPossible = checkWindow();
    if (!twoNavPossible) {
      setHideWaypoint(false);
      setHideChannel(true);
    }
    setTwoNavOk(twoNavPossible);
  };

  React.useEffect(() => {
    window.addEventListener("resize", handleResize, false);
  }, []);

  const startExport = () => setIoState("EXPORTING");
  const stopExport = () => setIoState("IDLE");
  const toggleEditor = () => setEditable(!editable);

  const onZoomInEl = onLoaded(setZoomIn);
  const onZoomOutEl = onLoaded(setZoomOut);

  const setHiddenChannelWithLogic = (v: boolean) => {
    if (!twoNavOk && !v) {
      setHideWaypoint(true);
    }
    setHideChannel(v);
  };

  const setHiddenWaypointWithLogic = (v: boolean) => {
    if (!twoNavOk && !v) {
      setHideChannel(true);
    }
    setHideWaypoint(v);
  };

  // Active Group from Store
  const {
    setActiveChannelGroup,
    setChannelVisibilities,
    setGroupChannelLists,
    setGroupNames,
    setGroups,
    Groups,
    setSourceChannels,
    SourceChannels,
  } = useOverlayStore();

  const updateGroupChannelLists = ({ Groups, SourceChannels }) => {
    setGroupNames(
      Object.fromEntries(Groups.map(({ Name, UUID }) => [UUID, Name])),
    );
    const toChannelList = (GroupChannels) => {
      return GroupChannels.map(({ SourceChannel }) =>
        SourceChannels.find(({ UUID }) => UUID === SourceChannel.UUID),
      )
        .filter((x) => x)
        .map(({ Name }) => Name);
    };
    const groupChannelLists = Object.fromEntries(
      Groups.map(({ Name, GroupChannels }) => {
        return [Name, toChannelList(GroupChannels)];
      }),
    );
    setGroupChannelLists(groupChannelLists);
    const defaultGroup = Groups[0] || {
      GroupChannels: [],
      Name: "",
    };
    const groupName = defaultGroup.Name;
    const channelList = groupChannelLists[groupName] || [];
    console.log(groupChannelLists);
    setChannelVisibilities(
      Object.fromEntries(channelList.map((name) => [name, true])),
    );
  };

  const resetItems = (ItemRegistry) => {
    setConfig((config) => ({
      ...config,
      ItemRegistry: {
        ...config.ItemRegistry,
        ...ItemRegistry,
      },
      ID: crypto.randomUUID(),
    }));
    const { Groups } = ItemRegistry;
    if (Groups?.length > 0) {
      setActiveChannelGroup(Groups[0].UUID);
    }
  };

  const setItems = (ItemRegistry) => {
    setConfig((config) => ({
      ...config,
      ItemRegistry: {
        ...config.ItemRegistry,
        ...ItemRegistry,
      },
    }));
  };

  const [fileName, setFileName] = useState("");

  const onStartOmeTiff = async (in_f: string, handle: Handle.Dir) => {
    if (handle === null) return;
    const loader = await toLoader({ handle, in_f, pool: new Pool() });
    const { SourceChannels, Groups } = extractChannels(
      loader,
      "Colorimetric",
      [],
    );
    setSourceChannels(SourceChannels);
    setGroups(Groups);
    updateGroupChannelLists({
      Groups,
      SourceChannels,
    });
    // Asynchronously add distributions
    extractDistributions(loader).then((sourceDistributionMap) => {
      const SourceDistributions = sourceDistributionMap.values();
      resetItems({
        SourceDistributions: [...SourceDistributions],
        SourceChannels: SourceChannels.map((sourceChannel) => ({
          ...sourceChannel,
          SourceDistribution: sourceDistributionMap.get(
            sourceChannel.SourceIndex,
          ),
        })),
      });
    });
    setLoaderOmeTiff(loader);
    setFileName(in_f);
  };

  const onStart = async (
    imagePropList: [string, string, string][],
    handle: Handle.Dir | null,
  ) => {
    if (imagePropList.length === 0) {
      return;
    }
    // handle hard-coded channels for dicom-web demo
    const dicomPropList = imagePropList
      .filter(([series, modality, type]) => type === "DICOM-WEB")
      .map(([series, modality]) => [series, modality]) as [string, string][];
    if (dicomPropList.length > 0) {
      await onStartDicomWeb(dicomPropList, props.exhibit_config.Groups);
    }
    // handle only one ome-tiff image ( TODO support more )
    const omeTiffPropList = imagePropList
      .filter(([path, modality, type]) => type === "OME-TIFF")
      .map(([path]) => [path]);
    if (omeTiffPropList.length > 0 && handle) {
      await onStartOmeTiff(omeTiffPropList[0][0], handle);
    }
  };

  // Dicom Web derived state
  const onStartDicomWeb = async (
    imagePropList: [string, string][],
    groups: ConfigGroup[],
  ) => {
    const indexList = await Promise.all(
      imagePropList.map(async ([series, modality]) => {
        const pyramids = await loadDicomWeb(series);
        const loader = parseDicomWeb(series, pyramids) as DicomLoader;
        return {
          series,
          pyramids,
          modality,
          loader,
        };
      }),
    );
    setDicomIndexList(indexList);
    const { SourceChannels, Groups } = indexList.reduce(
      (registry, { loader, modality }) => {
        const relevant_groups = groups.filter(
          ({ Image }) => Image.Method === modality,
        );
        const { SourceChannels, Groups } = extractChannels(
          loader,
          modality,
          relevant_groups,
        );
        return {
          SourceChannels: [...registry.SourceChannels, ...SourceChannels],
          Groups: [...registry.Groups, ...Groups],
        };
      },
      {
        SourceChannels: [],
        Groups: [],
      },
    );
    setGroups(Groups);
    setSourceChannels(SourceChannels);
    updateGroupChannelLists({
      Groups,
      SourceChannels,
    });
  };

  const mutableFields: MutableFields = [];
  const ItemRegistry = mutableItemRegistry(
    config.ItemRegistry,
    setItems,
    mutableFields,
  );

  // Define a WebComponent for the item panel
  const controlPanelElement = useMemo(
    () =>
      author({
        ...config,
        ItemRegistry,
      }),
    [config.ID],
  );

  const [valid, setValid] = useState({} as ValidObj);

  if (props.demo_dicom_web) {
    useEffect(() => {
      (async () => {
        // H&E Demo Image and
        // CyCIF Demo Image
        await onStart(
          [
            [
              "https://us-central1-idc-external-031.cloudfunctions.net/minerva_proxy/studies/2.25.112849421593762410108114587383519700602/series/1.3.6.1.4.1.5962.99.1.2507374895.494638264.1767738966319.4.0",
              "Brightfield",
              "DICOM-WEB",
            ],
            [
              "https://us-central1-idc-external-031.cloudfunctions.net/minerva_proxy/studies/2.25.112849421593762410108114587383519700602/series/1.3.6.1.4.1.5962.99.1.331207435.2054329796.1752677896971.4.0",
              "Colorimetric",
              "DICOM-WEB",
            ],
          ],
          null as Handle.Dir | null,
        );
      })();
    }, []);
  }

  const noLoader =
    loaderOmeTiff === null &&
    dicomIndexList.length === 0 &&
    !props.demo_dicom_web;

  // Exhibit editing operations (from Index)
  const { name, groups, stories } = exhibit;

  const updateWaypoint = (newWaypoint: WaypointType, { s, w }: any) => {
    const oldWaypoint = stories[s]?.waypoints[w];
    if (!oldWaypoint) {
      throw `Cannot update waypoint. Waypoint ${w} does not exist!`;
    }
    const ex = setWaypoint({ exhibit, s, w, newWaypoint });
    setExhibit(ex);
  };

  const pushWaypoint = (newWaypoint: WaypointType, { s }: any) => {
    if (!stories[s]) {
      throw `Cannot push waypoint. Story ${s} does not exist!`;
    }
    const w = stories[s].waypoints.length;
    const ex = setWaypoint({ exhibit, s, w, newWaypoint });
    setExhibit(ex);
  };

  const popWaypoint = ({ s, w }) => {
    const story = stories[s];
    const oldWaypoints = story?.waypoints;
    if (oldWaypoints?.length <= 1) {
      throw "Unable to pop last waypoint";
    }
    const newStory = removeKey(story, "waypoints", w);
    const ex = setStory({ exhibit, s, newStory });
    setExhibit(ex);
  };

  const updateGroup = (newGroup, { g }) => {
    const ex = setGroup({ exhibit, g, newGroup });
    setExhibit(ex);
  };

  const pushGroup = (newGroup) => {
    const g = exhibit.groups.length;
    const ex = setGroup({ exhibit, g, newGroup });
    setExhibit(ex);
  };

  const popGroup = ({ g }) => {
    if (groups.length <= 1) {
      throw "Unable to pop last group";
    }
    const ex = removeKey(exhibit, "groups", g);
    const newGroups = ex.groups.map((group) => {
      const gNext = group.g >= g ? group.g - 1 : group.g;
      return { ...group, g: gNext };
    });
    const newStories = ex.stories.map((story) => {
      const newWaypoints = story.waypoints.map((waypoint) => {
        const gNext = waypoint.g >= g ? 0 : g;
        return { ...waypoint, g: gNext };
      });
      return { ...story, waypoints: newWaypoints };
    });
    setExhibit({ ...ex, groups: newGroups, stories: newStories });
  };

  const updateChannel = (newChannel, { g, idx }) => {
    const group = groups[g];
    if (!group?.channels[idx]) {
      throw `Cannot update channel. Channel ${idx} does not exist!`;
    }
    const ex = setChannel({ exhibit, g, idx, newChannel });
    setExhibit(ex);
  };

  const pushChannel = (newChannel, { g }) => {
    const group = groups[g];
    if (!group) {
      throw `Cannot push channel. Group ${g} does not exist!`;
    }
    const idx = group.channels.length;
    const ex = setChannel({ exhibit, g, idx, newChannel });
    setExhibit(ex);
  };

  const popChannel = ({ g, idx }) => {
    const group = groups[g];
    const channels = group?.channels;
    if (channels.length <= 1) {
      throw "Unable to pop last channel";
    }
    const newGroup = removeKey(group, "channels", idx);
    const ex = setGroup({ exhibit, g, newGroup });
    setExhibit(ex);
  };

  // Data transformation (from Index)
  const itemRegistryMarkerNames = SourceChannels.map(
    (source_channel) => source_channel.Name,
  );

  const itemRegistryGroups = React.useMemo(() => {
    return Groups.map((group, g) => {
      const { Name, GroupChannels } = group;
      const channels = GroupChannels.map((group_channel) => {
        const defaults = { Name: "" };
        const { R, G, B } = group_channel.Color;
        const color = ((1 << 24) + (R << 16) + (G << 8) + B)
          .toString(16)
          .slice(1);
        const { LowerRange, UpperRange } = group_channel;
        const { SourceChannel } = group_channel;
        const { Name } =
          SourceChannels.find(
            (source_channel) => source_channel.UUID == SourceChannel.UUID,
          ) || defaults;
        return {
          color,
          name: Name,
          contrast: [LowerRange, UpperRange],
        };
      });
      return {
        State: group.State,
        g,
        name: Name,
        channels,
      };
    });
  }, [Groups]);

  const channelProps = {
    hash,
    setHash,
    name,
    stories,
    authorMode: !presenting,
    groups: itemRegistryGroups,
    controlPanelElement,
    config: config,
    editable,
    hiddenChannel,
    setHiddenChannel: setHiddenChannelWithLogic,
    updateGroup,
    pushGroup,
    popGroup,
    updateChannel,
    pushChannel,
    popChannel,
  };

  const retrievingMetadata =
    dicomIndexList.length === 0 && props.demo_dicom_web;

  const mainProps = {
    ...channelProps,
    in_f: fileName,
    name,
    handle: null as Handle.Dir | null, // Will be set in FileHandler render
    ioState,
    presenting,
    hiddenWaypoint,
    setHiddenWaypoint: setHiddenWaypointWithLogic,
    retrievingMetadata,
    onZoomInEl,
    onZoomOutEl,
    startExport,
    stopExport,
    toggleEditor,
    updateWaypoint,
    pushWaypoint,
    popWaypoint,
  };

  const imageProps = React.useMemo(() => {
    return toImageProps({
      props: {
        Groups,
        SourceChannels,
        loaderOmeTiff,
        dicomIndexList,
        marker_names: itemRegistryMarkerNames,
        ...channelProps,
      },
      buttons: {
        zoomInButton: zoomInEl,
        zoomOutButton: zoomOutEl,
      },
    });
  }, [
    loaderOmeTiff,
    dicomIndexList,
    itemRegistryMarkerNames,
    channelProps,
    zoomInEl,
    zoomOutEl,
  ]);

  // Use Zustand store for overlay state management
  const {
    overlayLayers,
    activeTool,
    currentInteraction,
    dragState,
    hoverState,
    handleLayerCreate,
    handleToolChange,
    handleOverlayInteraction,
    stories: _stories,
    activeStoryIndex,
    setActiveStory,
    setStories,
    setWaypoints,
  } = useOverlayStore();

  // Initialize stories in the store when config changes
  useEffect(() => {
    if (config.ItemRegistry.Stories) {
      setStories(config.ItemRegistry.Stories);
      setWaypoints([]);
    }
  }, [config.ItemRegistry.Stories]);

  // Initialize to first active story index
  useEffect(() => {
    const hasStories = _stories.length;
    if (hasStories && activeStoryIndex === null) {
      setActiveStory(0);
    }
  }, [_stories]);

  const retrieving_status = (
    <RetrievingWrapper>Retrieving DICOM metadata...</RetrievingWrapper>
  );

  return (
    <FileHandler handleKeys={handleKeys}>
      {({ handle, onAllow, onRecall }) => {
        const onSubmit: FormEventHandler = (event) => {
          const form = event.currentTarget as HTMLFormElement;
          const data = [...new FormData(form).entries()];
          const formOut = data.reduce(
            ((o, [k, v]) => {
              return { ...o, [k]: `${v}` };
            }) as ReduceFormData,
            { mask: "" },
          );
          const formOpts = {
            formOut,
            onStart: (list) => onStart(list, handle),
            handle,
          };
          if (isOpts(formOpts)) {
            validate(formOpts).then((valid: ValidObj) => {
              setValid(valid);
            });
          }
          event.preventDefault();
          event.stopPropagation();
        };

        const formProps = { onSubmit, valid };
        const uploadProps = {
          handleKeys,
          formProps,
          handle,
          onAllow,
          onRecall,
        };
        const importer = !noLoader ? (
          ""
        ) : (
          <Scrollable>
            <Upload {...uploadProps} />
          </Scrollable>
        );

        // Update mainProps with actual handle
        const mainPropsWithHandle = {
          ...mainProps,
          handle,
        };

        // Actual image viewer
        const imager = noLoader ? (
          ""
        ) : (
          <Full>
            <PlaybackRouter {...mainPropsWithHandle}>
              {retrievingMetadata ? (
                retrieving_status
              ) : (
                <ImageViewer
                  {...imageProps}
                  overlayLayers={overlayLayers}
                  activeTool={activeTool}
                  isDragging={dragState.isDragging}
                  hoveredAnnotationId={hoverState.hoveredAnnotationId}
                  onOverlayInteraction={handleOverlayInteraction}
                />
              )}
            </PlaybackRouter>
          </Full>
        );

        return (
          <Wrapper>
            {imager}
            {importer}
          </Wrapper>
        );
      }}
    </FileHandler>
  );
};

const Main = (props: Props) => {
  if (props.demo_dicom_web || hasFileSystemAccess()) {
    return <Content {...props} />;
  } else {
    return (
      <div>
        <p>Unable to access FileSystem API.</p>
      </div>
    );
  }
};

export { Main };
