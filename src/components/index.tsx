import * as React from "react";
import { useState } from "react";
import { ImageView, toImageProps } from "./imageView";
import { Redirects } from "./redirects";
import { Waypoint } from "./waypoint";
import { Channel } from "./channel";
import { Routes, Route } from "react-router-dom";
import { toRoutePath } from "../lib/hashUtil";

// Types
import type { OptSW } from "./waypoint/content";
import type { Waypoint as WaypointType } from "../lib/exhibit";
import type { Exhibit } from "../lib/exhibit";

type Props = {
  exhibit: Exhibit;
  setExhibit: (e: Exhibit) => void;
};

const onLoaded = (setter) => {
  return (el) => (el ? setter(el) : null);
};

const toggle = (list: string[], item: string) => {
  return list[(list.indexOf(item) + 1) % list.length];
};

const setContainer = ({container, idx, key, newItem}) => {
  const extra = idx >= container[key].length ? [newItem] : [];
  const newItems = container[key].concat(extra).map((item, i) => {
    return i === idx ? newItem : item;
  })
  return {...container, [key]: newItems}
}

const setStory = ({exhibit, s, newStory}) => {
  return setContainer({
    newItem: newStory,
    container: exhibit,
    key: "stories",
    idx: s
  });
}

const setWaypoint = ({exhibit, s, w, newWaypoint}) => {
  const story = exhibit.stories[s];
  const newStory = setContainer({
    newItem: newWaypoint,
    container: story,
    key: "waypoints",
    idx: w
  });
  return setStory({exhibit, s, newStory})
}

const setGroup = ({exhibit, g, newGroup}) => {
  return setContainer({
    newItem: newGroup,
    container: exhibit,
    key: "groups",
    idx: g
  });
}

const setChannel = ({exhibit, g, idx, newChannel}) => {
  const group = exhibit.groups[g];
  const newGroup = setContainer({
    newItem: newChannel,
    container: group,
    key: "channels",
    idx
  });
  return setGroup({exhibit, g, newGroup})
}

const removeKey = (container, key, idx) => {
  const newList = container[key].filter((_, i) => i !== idx);
  return {...container, [key]: newList}
}

const Index = (props: Props) => {
  const { exhibit, setExhibit } = props;
  const { groups, stories } = exhibit;

  const views = ["viv", "osd"];
  const [view, setView] = useState(views[0]);
  const [zoomInEl, setZoomIn] = useState(null);
  const [zoomOutEl, setZoomOut] = useState(null);
  const [editable, setEditable] = useState(true);
  const toggleViewer = () => setView(toggle(views, view));
  const toggleEditor = () => setEditable(!editable);

  const onZoomInEl = onLoaded(setZoomIn);
  const onZoomOutEl = onLoaded(setZoomOut);

  const updateWaypoint = (newWaypoint: WaypointType, {s, w}: OptSW) => {
    const oldWaypoint = stories[s]?.waypoints[w]
    if (!oldWaypoint) {
      throw `Cannot update waypoint. Waypoint ${w} does not exist!`;
    }
    const ex = setWaypoint({exhibit, s, w, newWaypoint})
    setExhibit(ex)
  };
  const pushWaypoint = (newWaypoint: WaypointType, {s}: OptSW) => {
    if (!stories[s]) {
      throw `Cannot push waypoint. Story ${s} does not exist!`;
    }
    const w = stories[s].waypoints.length;
    const ex = setWaypoint({exhibit, s, w, newWaypoint})
    setExhibit(ex)
  };
  const popWaypoint = ({s, w}) => {;
    const story = stories[s];
    const oldWaypoints = story?.waypoints;
    if (oldWaypoints?.length <= 1) {
      throw "Unable to pop last waypoint"
    }
    const newStory = removeKey(story, 'waypoints', w);
    const ex = setStory({exhibit, s, newStory})
    setExhibit(ex)
  }

  const updateGroup = (newGroup, {g}) => {
    const ex = setGroup({exhibit, g, newGroup});
    setExhibit(ex)
  };
  const pushGroup = (newGroup) => {
    const g = exhibit.groups.length
    const ex = setGroup({exhibit, g, newGroup});
    setExhibit(ex)
  };
  const popGroup = ({g}) => {
    if (groups.length <= 1) {
      throw "Unable to pop last group"
    }
    const ex = removeKey(exhibit, 'groups', g);
    setExhibit(ex)
  };

  const updateChannel = (newChannel, {g, idx}) => {
    const group = groups[g]
    if (!group?.channels[idx]) {
      throw `Cannot update channel. Channel ${idx} does not exist!`;
    }
    const ex = setChannel({exhibit, g, idx, newChannel});
    setExhibit(ex)
  }
  const pushChannel = (newChannel, {g}) => {
    const group = groups[g]
    if (!group) {
      throw `Cannot push channel. Group ${g} does not exist!`;
    }
    const idx = group.channels.length
    const ex = setChannel({exhibit, g, idx, newChannel});
    setExhibit(ex)
  };
  const popChannel = ({g, idx}) => {
    const group = groups[g]
    const channels = group?.channels
    if (channels.length <= 1) {
      throw "Unable to pop last channel"
    }
    const newGroup = removeKey(group, 'channels', idx);
    const ex = setGroup({exhibit, g, newGroup});
    setExhibit(ex)
  };

  const waypointProps = {
    groups,
    stories,
    onZoomInEl,
    onZoomOutEl,
    toggleViewer,
    toggleEditor,
    updateWaypoint,
    pushWaypoint,
    popWaypoint,
    viewer: view,
    editable
  };
  const channelProps = {
    groups,
    stories,
    editable,
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
      viewer: view,
      ...channelProps,
    },
    buttons: {
      zoomInButton: zoomInEl,
      zoomOutButton: zoomOutEl,
    },
  });
  const redirectProps = {
    stories,
  };

  return (
    <Routes>
      <Route
        {...{
          path: toRoutePath("s", "w"),
          element: <Waypoint {...waypointProps} />,
        }}
      >
        <Route
          {...{
            path: toRoutePath("g", "m"),
            element: <Channel {...channelProps} />,
          }}
        >
          <Route
            {...{
              path: toRoutePath(..."avop"),
              element: <ImageView {...imageProps} />,
            }}
          />
        </Route>
      </Route>
      {Redirects(redirectProps)}
    </Routes>
  );
};

export { Index };
