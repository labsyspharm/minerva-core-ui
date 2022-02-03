import * as React from "react";
import { findDOMNode } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { OpenSeadragonContext, readViewport } from "../lib/openseadragon";
import styled from "styled-components";
import { useHash, useSetHash } from "../lib/hashUtil";
import { getWaypoint } from "../lib/waypoint";

// Types
import type { Config } from "../lib/openseadragon";
import type { Group, Story } from "../lib/exhibit";

export type Props = {
  groups: Group[];
  stories: Story[];
  viewerConfig: Config;
};

const Main = styled.div`
  height: 100%;
`;

const useSetV = (setHash) => {
  return (context) => {
    setHash({
      v: readViewport(context),
    });
  };
};

const useUpdate = ({ setV, setCache }) => {
  return (c) => {
    if (c?.context?.viewport) {
      setV(c.context);
    }
    setCache((_c) => {
      const keys = [...Object.keys(_c)];
      const entries = keys.map((k) => {
        return [k, k in c ? c[k] : _c[k]];
      });
      return Object.fromEntries(entries);
    });
  };
};

const useEl = ({ current }) => {
  return findDOMNode(current);
};

const OsdView = (props: Props) => {
  const rootRef = useRef();
  const { v, g, s, w } = useHash();
  const { groups, stories } = props;
  const waypoint = getWaypoint(stories, s, w);
  const setV = useSetV(useSetHash());

  const [cache, setCache] = useState({
    context: null,
    redraw: false,
    g,
  });
  const [el, setEl] = useState(useEl(rootRef));
  const config = {
    ...props.viewerConfig,
    element: el,
  };

  const { context } = cache;
  const update = useUpdate({ setV, setCache });
  const opts = { config, update, v, g, groups };
  const firstDraw = !context?.viewport;

  useEffect(() => setEl(useEl(rootRef)), [rootRef.current]);
  useEffect(() => {
    if (g !== cache.g) {
      update({ g, redraw: true });
    }
  }, [g]);

  useEffect(() => {
    if (waypoint.g !== g) {
      update({ g: waypoint.g });
    }
  }, [waypoint.g]);

  useEffect(() => {
    if (cache.redraw && el) {
      const next = context.reset(opts);
      update({ redraw: false, context: next });
    }
  }, [cache.redraw, el]);

  const { zoomInButton, zoomOutButton } = config;
  const els = [el, zoomInButton, zoomOutButton];
  const ready = els.every((el) => el !== null);

  useEffect(() => {
    if (ready && firstDraw) {
      const next = OpenSeadragonContext(opts);
      update({ context: next });
    }
  }, [ready, firstDraw]);

  return <Main ref={rootRef} />;
};

export { OsdView };
