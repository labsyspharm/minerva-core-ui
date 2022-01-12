import * as React from "react";
import { useState } from "react";
import { ImageView } from "./imageView";
import { Redirects } from "./redirects";
import { Waypoint } from "./waypoint";
import { Channel } from "./channel";
import { Routes, Route } from "react-router-dom";
import { toRoutePath } from "../lib/hashUtil";

// Types
import type { Exhibit } from "../lib/exhibit";

type Props = {
  exhibit: Exhibit;
};

const onLoaded = (setter) => {
  return (el) => (el ? setter(el) : null);
};

const Index = (props: Props) => {
  const { exhibit } = props;
  const { groups, stories } = exhibit;

  const [zoomInEl, setZoomIn] = useState(null);
  const [zoomOutEl, setZoomOut] = useState(null);

  const onZoomInEl = onLoaded(setZoomIn);
  const onZoomOutEl = onLoaded(setZoomOut);

  const waypointProps = {
    stories,
    onZoomInEl,
    onZoomOutEl,
  };
  const channelProps = {
    groups,
    stories,
  };
  const imageProps = {
    groups,
    stories,
    viewerConfig: {
      zoomInButton: zoomInEl,
      zoomOutButton: zoomOutEl,
    },
  };
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
