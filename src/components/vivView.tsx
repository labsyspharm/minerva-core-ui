import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import {
  getChannelStats,
  loadOmeTiff,
  PictureInPictureViewer,
} from "@hms-dbmi/viv";

import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";

// Types
import type { Config } from "../lib/viv";
import type { Group, Story } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";
import type { Selection, Color, Limit } from "../lib/viv";

export type Props = {
  groups: Group[];
  stories: Story[];
  viewerConfig: Config;
} & HashContext;

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
  const { groups, stories, hash, setHash } = props;
  const { v, g, s, w } = hash;
  const setV = useSetV(setHash);
  const { toSettings } = props.viewerConfig;
  const [settings, setSettings] = useState(toSettings(hash));
  const waypoint = getWaypoint(stories, s, w);
  const [shape, setShape] = useState(maxShape);
  const [channelSettings, setChannelSettings] = useState({});
  const [channels, setChannels] = useState([]);
  const rootRef = React.useMemo(() => {
    return shapeRef(setShape);
  }, [maxShape]);

  const [loader, setLoader] = useState(null);
  useEffect(() => {
    loadOmeTiff(url).then((loader) => {
      setLoader(loader);
    });
  }, []);

  // useEffect(() => {
  //   console.log("groups", groups);
  //   console.log("g", g);
  //   if (!groups?.[g]?.channels) return;
  //   console.log("channels", groups[g].channels, settings, loader);
  // }, [groups, loader]);

  useEffect(() => {
    if (!groups?.[g]?.channels) return;
    const _channels = groups?.[g]?.channels.map((d: any, i: number) => {
      return { id: i, ...d };
    });
    setChannels(_channels);
  }, [loader, groups, g]);

  useEffect(() => {
    console.log("Settings", settings, loader);
    const channelsVisible = channels.map((d) => true);
    const colors: Color[] = channels.map(
      (d) => hex2rgb(`#${d.color}`) as Color
    );
    const selections = channels.map((d) => {
      return { z: 0, t: 0, c: d.id };
    });
    // TODO: Update this to read the bitdepth from metadata and set ranges based on that
    const contrastLimits: Limit[] = channels.map((d) => {
      return [0, 65535];
    });
    setSettings({ channelsVisible, colors, selections, contrastLimits });
    console.log(channels, colors, selections);
  }, [channels]);

  // useEffect(() => {
  //   console.log("CHANNELS", channels);
  // }, [channels]);

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
