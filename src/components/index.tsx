import * as React from "react";
import { useState } from "react";
import { ImageView, toImageProps } from "./imageView";
import { Main } from "./content";
import { Channel } from "./channel";

// Types
import type { OptSW } from "./waypoint/content";
import type { Waypoint as WaypointType } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";
import type { Exhibit } from "../lib/exhibit";

type Props = HashContext & {
  in_f: string;
  loader: any;
  exhibit: Exhibit;
  handle: Handle.Dir;
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

  const ioStates = [
    'IDLE', 'EXPORTING', 'EXPORTED'
  ];
  // TODO - return to ioStates[0] - changed for quick dev w OSD
  const [ioState, setIoState] = useState(ioStates[0]);
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
  const startExport = () => setIoState(ioStates[1]);
  const stopExport = () => setIoState(ioStates[0]);
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

  const updateWaypoint = (newWaypoint: WaypointType, { s, w }: OptSW) => {
    const oldWaypoint = stories[s]?.waypoints[w];
    if (!oldWaypoint) {
      throw `Cannot update waypoint. Waypoint ${w} does not exist!`;
    }
    const ex = setWaypoint({ exhibit, s, w, newWaypoint });
    setExhibit(ex);
  };
  const pushWaypoint = (newWaypoint: WaypointType, { s }: OptSW) => {
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

  const { in_f, handle, loader, hash, setHash } = props;

  const mainProps = {
    hash,
    in_f,
    handle,
    setHash,
    groups,
    stories,
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
    popWaypoint,
    editable,
  };
  const channelProps = {
    hash,
    setHash,
    groups,
    stories,
    editable,
    hiddenChannel,
    setHiddenChannel,
    updateWaypoint,
    updateGroup,
    pushGroup,
    popGroup,
    updateChannel,
    pushChannel,
    popChannel,
  };
  const imageProps = toImageProps({
    props: {
      loader,
      ...channelProps,
    },
    buttons: {
      zoomInButton: zoomInEl,
      zoomOutButton: zoomOutEl,
    },
  });
  return (
    <Main {...mainProps}>
      <Channel {...channelProps}>
        <ImageView {...imageProps}>
        </ImageView>
      </Channel>
    </Main>
  );
};

export { Index };
