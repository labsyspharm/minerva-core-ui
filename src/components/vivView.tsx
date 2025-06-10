import * as React from "react";
import Deck from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { PictureInPictureViewer } from "@hms-dbmi/viv";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";

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
  loaders: any[];
  groups: Group[];
  stories: Story[];
  viewerConfigs: Config[];
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

const shapeRef = (setShape: (s: Shape) => void) => {
  return (el: unknown) => {
    if (el && isElement(el)) {
      const height = el.clientHeight;
      const width = el.clientWidth;
      setShape({ width, height });
    }
  };
};

const takeChannelSubset = (
  settings, keep_only_last, remove_last
) => {
  if (keep_only_last) {
    return settings;
  }
  if (remove_last) {
    return settings;
  }
  return settings;
}

const VivView = (props: Props) => {
  const maxShape = useWindowSize();
  const { loaders, groups, stories, hash, setHash } = props;
  const { v, g, s, w } = hash;
  const toMainSettings = props.viewerConfigs[0].toSettings;
  const [mainSettings, setMainSettings] = useState(
    toMainSettings(hash)
  );
  const toBrightfieldSettings = props.viewerConfigs[1].toSettings;
  const [brightfieldSettings, setBrightfieldSettings] = useState(
    toBrightfieldSettings(hash)
  );

  const waypoint = getWaypoint(stories, s, w);
  const [shape, setShape] = useState(maxShape);
  const [canvas, setCanvas] = useState(null);
  const rootRef = React.useMemo(() => {
    return shapeRef(setShape);
  }, [maxShape]);

  useEffect(() => {
    setMainSettings(toMainSettings(hash, loaders, groups));
  }, [loaders,groups,hash]);
  useEffect(() => {
    setBrightfieldSettings(toBrightfieldSettings(hash, loaders, groups));
  }, [loaders,groups,hash]);

  const loadersData = loaders.map(loader => loader.data);
  if (!loaders.length || !mainSettings || !brightfieldSettings) {
    return null;
  }
  const mainProps = {
    ...{
      ...shape,
      id: "mainLayer",
      loader: loadersData[0],
      ...(mainSettings as any),
    }
  };
  const brightfieldProps = {
    ...{
      ...shape,
      id: "brightfieldLayer",
      loader: loadersData[1],
      ...(brightfieldSettings as any),
    },
  };
  const layers = [
    new MultiscaleImageLayer(mainProps),
    new MultiscaleImageLayer(brightfieldProps)
  ];
  const n_levels = loadersData[0].length;
  const shape_labels = loadersData[0][0].labels;
  const shape_values = loadersData[0][0].shape;
  const imageShape = Object.fromEntries(
    shape_labels.map((k, i) => [k, shape_values[i]])
  );
  const [viewState, setViewState] = useState({
    zoom: 1-1*n_levels,
    target: [imageShape.x / 2, imageShape.y / 2, 0]
  });
  //console.log(layers);
  return (
    <Main slot="image" ref={rootRef}>
      <Deck
        layers={layers}
        controller={true}
        viewState={viewState}
        onViewStateChange={e => setViewState(e.viewState)}
        views={[new OrthographicView({ id: 'ortho', controller: true })]}
      />
    </Main>
  );
};

export { VivView };
