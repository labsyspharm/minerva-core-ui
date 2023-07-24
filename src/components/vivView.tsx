import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import {
  getChannelStats,
  PictureInPictureViewer,
} from "@hms-dbmi/viv";

import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";

// Types
import type { Config } from "../lib/viv";
import type { Group, Story } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";
import type { Selection, Color, Limit } from "../lib/viv";
import { VivLensing } from "./vivLensing";
import { LensExtension } from "@hms-dbmi/viv";

export type Props = {
  loader: any;
  groups: Group[];
  stories: Story[];
  viewerConfig: Config;
} & HashContext;

type Shape = {
  width: number;
  height: number;
};

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
const rgb2hex = (rgb) => {
  try {
    return (
      "#" +
      ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2])
        .toString(16)
        .substr(1)
    );
  } catch (e) {
    console.log("Error in hex2rgb", rgb, e);
  }
};

function hex2rgb(hex) {
  try {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : null;
  } catch (e) {
    console.log("Error in hex2rgb", hex, e);
  }
}

const VivView = (props: Props) => {
  const maxShape = useWindowSize();
  const { loader, groups, stories, hash, setHash } = props;
  const { v, g, s, w } = hash;
  const setV = useSetV(setHash);
  const { toSettings } = props.viewerConfig;
  const [settings, setSettings] = useState(toSettings(hash));
  const waypoint = getWaypoint(stories, s, w);
  const [shape, setShape] = useState(maxShape);
  const [channelSettings, setChannelSettings] = useState({});
  const [canvas, setCanvas] = useState(null);
  const rootRef = React.useMemo(() => {
    return shapeRef(setShape);
  }, [maxShape]);

  useEffect(() => {
    const newSettings = toSettings(hash, loader)
    setSettings(newSettings);
  }, [loader]);

  if (!loader || !settings) return null;
  return (
    <Main ref={rootRef} className={"SimonSimonSimon"}>
      <PictureInPictureViewer
        {...{
          loader,
          ...shape,
          ...(settings as any),
/*
          lensEnabled: true,
          lensRadius: 100,
          lensSelection: 0,
          extensions: [new VivLensing()],
          onViewportLoad: (viewport: any, e: any, d: any) => {
            console.log("Viewport", viewport?.[0]);
          }
*/
        }}
      />
    </Main>
  );
};

export { VivView };
