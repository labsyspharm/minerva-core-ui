import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useWindowSize } from "../lib/useWindowSize";

import {
  getChannelStats,
  loadOmeTiff,
  PictureInPictureViewer,
  LensExtension
} from "@hms-dbmi/viv";

import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";

// Types
import type { Config } from "../lib/viv";
import type { Group, Story } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";
import type { Selection, Color, Limit } from "../lib/viv";
import { VivLensing } from "./vivLensing";
import { IconLayer, LineLayer } from "@deck.gl/layers";
import { on } from "events";

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
  const deckRef = useRef(null);

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
  const [canvas, setCanvas] = useState(null);

  const [scale, setScale] = useState(0);

  const [movingLens, setMovingLens] = useState(false);

  const [loader, setLoader] = useState(null);
  const [lensPosition, setLensPosition] = useState({});
  useEffect(() => {
    loadOmeTiff(url).then((loader) => {
      setLoader(loader);
    });
  }, []);




  useEffect(() => {
    if (!groups?.[g]?.channels) return;
    const _channels = groups?.[g]?.channels.map((d: any, i: number) => {
      return { id: i, ...d };
    });
    setChannels(_channels);
  }, [groups, g]);



  useEffect(() => {
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

    // Set mouse in the middle of the image
    setLensPosition([(loader?.metadata?.Pixels?.SizeX || 0)
      / 2, (loader?.metadata?.Pixels?.SizeY || 0) / 2]);
    console.log(channels, colors, selections);
  }, [loader]);

  useEffect(() => {
    console.log('Loader is', loader);
  }, [loader]);



  const onClick = useCallback(event => {
    moveLens(event)
  }, [lensPosition])

  const moveLens = (event) => {
    const pickInfo = deckRef.current.pickObject({
      x: event?.offsetCenter?.x || event?.pageX,
      y: event?.offsetCenter?.y || event?.pageY,
      radius: 1
    });
    setLensPosition(pickInfo.coordinate);
  }



  const iconSvg = `
  <svg width="1000" height="1000" viewBox="0 0 1000 1000"  xmlns="http://www.w3.org/2000/svg">
      <circle cx="500" cy="500" r="497" fill="rgba(1,1,1,0)" stroke="#ffffff" pointer-events="fill" stroke-width="6"/>
    </svg>
  `

  const circleOverlay = new IconLayer({
    id: 'line-layer-#detail#',
    data: [lensPosition],
    getIcon: () => ({
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`,
      width: 1000,
      height: 1000
    }),
    sizeScale: 2,
    getSize: d => 100,
    alphaCutoff: 0,
    getPosition: d => d,

    onDrag: (info, event) => {
      setMovingLens(true)
      moveLens(event)
    },
    onDragEnd: (info, event) => {
      setMovingLens(false)
      console.log('DRAGEND')
    },
    pickable: true,
  });

  console.log('Scale', window.devicePixelRatio)




  if (!loader || !settings) return null;
  return (
    <Main className={"SimonSimonSimon"}>
      <PictureInPictureViewer
        {...{
          ...shape,
          ...(settings as any),
          loader: loader.data,
          lensEnabled: true,
          lensRadius: 100,
          lensSelection: 1,
          extensions: [new VivLensing()],
          onViewportLoad: (viewport: any, e: any, d: any) => {
            console.log("Viewport", viewport?.[0]);
            setScale(window.devicePixelRatio);
          },
          onViewStateChange: (d: any, e: any) => {
            if (movingLens) {
              return d?.oldViewState
            } else {
              return d?.viewState
            }

          },
          deckProps: { layers: [circleOverlay], ref: deckRef, userData: { lensPosition } },
        }}
      />
    </Main>
  );
};

export { VivView };
