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
import { ScaleBarLayer } from './vivLensingUI'
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



const useSetV = (setHash) => {
  return (context) => {
    /*
    setHash({
      v: readViewport(context),
    });
    */
  };
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
  const [mousePosition, setMousePosition] = useState({});
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


  const moveLens = (event) => {
    console.log(event?.offsetCenter?.x, event?.offsetCenter?.y)
    const mouseX = event?.offsetCenter?.x || event?.pageX;
    const mouseY = event?.offsetCenter?.y || event?.pageY;
    positionLens(mouseX, mouseY);

  }

  const positionLens = (x: number, y: number) => {
    setMousePosition([x, y]);
  }

  useEffect(() => {
    console.log('mouse')
  }, [mousePosition]);








  if (!loader || !settings) return null;
  return (
    <Main>
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
            console.log('deckRef is', deckRef?.current?.deck?.width, deckRef?.current?.deck?.height);
            setMousePosition([Math.round((deckRef?.current?.deck?.width || 0) / 2), Math.round((deckRef?.current?.deck?.height || 0) / 2)]);
          },
          onViewStateChange: (d: any, e: any) => {
            if (movingLens) {
              return d?.oldViewState
            } else {
              return d?.viewState
            }

          },
          deckProps: { layers: [ScaleBarLayer], ref: deckRef, userData: { lensPosition, movingLens, mousePosition } },
        }}
      />
    </Main>
  );
};

export { VivView };
