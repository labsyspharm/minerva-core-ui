import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import {
  getChannelStats,
  loadOmeTiff,
  PictureInPictureViewer,
} from "@hms-dbmi/viv";

import styled from "styled-components";
import { useHash, useSetHash } from "../lib/hashUtil";
import { getWaypoint } from "../lib/waypoint";

// Types
import type { Config } from "../lib/viv";
import type { Group, Story } from "../lib/exhibit";

export type Props = {
  groups: Group[];
  stories: Story[];
  viewerConfig: Config;
};

type Shape = {
  width: number;
  height: number;
};

const url = "/LUNG-3-PR_40X.ome.tif";

const Main = styled.div`
  height: 100%;
`;

const isElement = (x = {}): x is HTMLElement => {
  return ["Width", "Height"].every((k) => `client${k}` in x);
};

const useSetV = (setHash) => {
  return (context) => {
    /*
    setHash({
      v: readViewport(context),
    });
    */
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

const shapeRef = (setShape: (s: Shape) => void) => {
  return (el: unknown) => {
    if (el && isElement(el)) {
      const height = el.clientHeight;
      const width = el.clientWidth;
      setShape({ width, height });
    }
  };
};

const VivView = (props: Props) => {
  const maxShape = useWindowSize();
  const { v, g, s, w } = useHash();
  const { groups, stories } = props;
  const setV = useSetV(useSetHash());
  const { settings } = props.viewerConfig;
  const waypoint = getWaypoint(stories, s, w);
  const [shape, setShape] = useState(maxShape);
  const rootRef = React.useMemo(() => {
    return shapeRef(setShape);
  }, [maxShape]);

  const [loader, setLoader] = useState(null);
  useEffect(() => {
    loadOmeTiff(url).then((loader) => {
      setLoader(loader);
    });
  }, []);

  if (!loader || !settings) return null;
  return (
    <Main ref={rootRef}>
      <PictureInPictureViewer
        {...{
          ...shape,
          ...(settings as any),
          loader: loader.data,
        }}
      />
    </Main>
  );
};

export { VivView };
