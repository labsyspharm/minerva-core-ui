import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { DeckGL } from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import {
  getChannelStats,
  loadOmeTiff,
  DetailView,
  MultiscaleImageLayer,
  getDefaultInitialViewState,
  PictureInPictureViewer,
} from "@hms-dbmi/viv";

import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";

// Types
import type { Config } from "../lib/viv";
import type { Group, Story } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";

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

const VivView = (props: Props) => {
  const maxShape = useWindowSize();
  const { groups, stories, hash, setHash } = props;
  const { v, g, s, w } = hash;
  const setV = useSetV(setHash);
  const { toSettings } = props.viewerConfig;
  const settings = toSettings(hash);
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

/*
  const deckProps = {
    controller: {inertia: 10000},
  }
*/

  const layerConfig = { loader };
  const layerProps = layerConfig;
  const viewState = getDefaultInitialViewState(loader.data, shape, 0.5);
  const layerId = 'multi-layer';
  const viewId = 'ortho-view';
  const layer = new MultiscaleImageLayer({
    channelsVisible: [true, true, true],
    selections: [
      {z: 0, t: 0, c: 0},
      {z: 0, t: 0, c: 1},
      {z: 0, t: 0, c: 2}
    ],
    contrastLimits: [[0, 65535], [0, 65535], [0, 65535]],
    loader: loader.data,
    viewportId: viewId,
    dtype: "Uint16",
    id: layerId,
  });

  return (
    <Main ref={rootRef}>
      <DeckGL
        layers={layer}
        viewState={viewState}
        glOptions={{ webgl2: true }}
        views={[new OrthographicView({ viewId, controller: true })]}
      />
    </Main>
  );
};

export { VivView };
