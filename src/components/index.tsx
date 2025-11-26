import * as React from "react";
import { useState, useEffect } from "react";
import { Overlays } from "./overlays";
import { Stories } from "./stories";
import { ImageView, toImageProps } from "./imageView";
import { Main } from "./content";
import { useOverlayStore } from "../lib/stores";

// Types
import type { Waypoint as WaypointType } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";
import type { ConfigProps } from "../lib/config";
import type { Loader } from "../lib/viv";
import type { Exhibit } from "../lib/exhibit";

type DicomData = {
  labels: string[];
  shape: number[];
}

export interface DicomLoader {
  data: DicomData[];
  metadata: Loader["metadata"];
}

export type DicomIndex = {
  [k: string]: {
    width: number;
    height: number;
    extent: [number, number, number, number];
    frameMappings: {
      [k: string]: any;
    };
    tileSize: number;
  }[]; 
}

type Props = HashContext & {
  in_f: string;
  loader: Loader | DicomLoader;
  exhibit: Exhibit;
  handle: Handle.Dir;
  config: ConfigProps;
  marker_names: string[];
  dicomIndex: DicomIndex;
  dicomSeries: string | null;
  controlPanelElement: string;
  setExhibit: (e: Exhibit) => void;
};

const onLoaded = (setter) => {
  return (el) => (el ? setter(el) : null);
};

const toggle = (list: string[], item: string) => {
  return list[(list.indexOf(item) + 1) % list.length];
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

const Index = (props: Props) => {
  const { exhibit, setExhibit } = props;
  const { groups, stories } = exhibit;

  const [ioState, setIoState] = useState("IDLE");
  const [zoomInEl, setZoomIn] = useState(null);
  const [zoomOutEl, setZoomOut] = useState(null);
  const [editable, setEditable] = useState(false);
  const checkWindow = () => {
    return window.innerWidth > 600;
  }
  const [twoNavOk, setTwoNavOk] = useState(checkWindow());
  const [hidden, setHidden] = useState([false, !twoNavOk]);
  const handleResize = () => {
    const twoNavPossible = checkWindow();
    if (!twoNavPossible) {
      setHidden([false, true]);
    }
    setTwoNavOk(twoNavPossible);
  }
  React.useEffect(() => {
    window.addEventListener("resize", handleResize, false);
  }, []);
  const startExport = () => setIoState("EXPORTING");
  const stopExport = () => setIoState("IDLE");
  const toggleEditor = () => setEditable(!editable);

  const onZoomInEl = onLoaded(setZoomIn);
  const onZoomOutEl = onLoaded(setZoomOut);

  const hiddenWaypoint = hidden[0];
  const hiddenChannel = hidden[1];
  const setHiddenChannel = (v: boolean) => {
    if(!twoNavOk && !v) {
      return setHidden([!v, v]);
    }
    setHidden([hiddenWaypoint, v])
  }
  const setHiddenWaypoint = (v: boolean) => {
    if(!twoNavOk && !v) {
      return setHidden([v, !v]);
    }
    setHidden([v, hiddenChannel])
  }

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

  const {
    in_f, handle, loader, hash, setHash,
    controlPanelElement, config
  } = props;
  const {
    Colors, Groups, GroupChannels, SourceChannels
  } = props.config.ItemRegistry;
  const itemRegistryMarkerNames = SourceChannels.map(
    source_channel => source_channel.Properties.Name
  )
  const itemRegistryGroups = React.useMemo(() => {
    return Groups.map((group, g) => {
      const { Name } = group.Properties;
      const channels = GroupChannels.filter(group_channel => (
        group_channel.Associations.Group.UUID == group.UUID
      )).map(group_channel => {
        const defaults = { Name: '' };
        const { R, G, B } = Colors.find(({ ID }) => {
          return ID === group_channel.Associations.Color.ID;
        })?.Properties || {};
        const color = (
          (1 << 24) + (R << 16) + (G << 8) + B
        ).toString(16).slice(1);
        const { LowerRange, UpperRange } = group_channel.Properties;
        const { SourceChannel } = group_channel.Associations;
        const { Name } = SourceChannels.find(source_channel => (
          source_channel.UUID == SourceChannel.UUID
        ))?.Properties || defaults;
        return { 
          color, name: Name, contrast: [
            LowerRange, UpperRange
          ]
        };
      });
      return { 
        State: group.State,
        g, name: Name, channels,
      };
    })
  }, [
    GroupChannels
  ]);
  const channelProps = {
    hash,
    setHash,
    stories,
    groups: itemRegistryGroups,
    controlPanelElement,
    config: props.config,
    editable,
    hiddenChannel,
    setHiddenChannel,
    updateGroup,
    pushGroup,
    popGroup,
    updateChannel,
    pushChannel,
    popChannel,
  };
  const mainProps = {
    ...channelProps,
    in_f,
    handle,
    ioState,
    hiddenWaypoint,
    setHiddenWaypoint,
    onZoomInEl,
    onZoomOutEl,
    startExport,
    stopExport,
    toggleEditor,
    updateWaypoint,
    pushWaypoint,
    popWaypoint
  }
  const imageProps = React.useMemo(() => {
    return toImageProps({
      props: {
        loader,
        dicomIndex: props.dicomIndex,
        marker_names: itemRegistryMarkerNames,
        ...channelProps,
      },
      buttons: {
        zoomInButton: zoomInEl,
        zoomOutButton: zoomOutEl,
      },
    });
  }, [
    JSON.stringify(GroupChannels.map(channel => {
      console.log(channel);
      return channel.Properties;
    }))
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
    setStories,
    setWaypoints
  } = useOverlayStore();
  
  // Initialize stories in the store when config changes
  useEffect(() => {
    if (props.config.ItemRegistry.Stories) {
      setStories(props.config.ItemRegistry.Stories);
      
      // For now, we'll work with stories only since the current config structure
      // doesn't have waypoints within stories. Each ConfigWaypoint represents a story.
      setWaypoints([]);
    }
  }, [props.config.ItemRegistry.Stories, setStories, setWaypoints]);
  
  return (
    <Main {...mainProps}>
      <ImageView 
        {...imageProps} 
        series={props.dicomSeries}
        overlayLayers={overlayLayers}
        activeTool={activeTool}
        isDragging={dragState.isDragging}
        hoveredAnnotationId={hoverState.hoveredAnnotationId}
        onOverlayInteraction={handleOverlayInteraction}
      >
      </ImageView>
      <Overlays 
        hash={mainProps.hash} 
        groups={mainProps.groups} 
        setHash={mainProps.setHash}
        onLayerCreate={handleLayerCreate}
        currentInteraction={currentInteraction}
      />
      <Stories 
        hash={mainProps.hash}
        setHash={mainProps.setHash}
      />
    </Main>
  );
};

export { Index };
