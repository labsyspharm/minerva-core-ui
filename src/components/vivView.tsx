import * as React from "react";
import Deck from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import {
  testPyramids,
  createTileLayer, readInstances,
  readMetadata, computeImagePyramid
} from "../lib/dicom";
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
  const { loader, groups, stories, hash, setHash } = props;
  const { v, g, s, w } = hash;
  const toMainSettings = props.viewerConfig.toSettings;
  const [mainSettings, setMainSettings] = useState(toMainSettings(hash));
  const waypoint = getWaypoint(stories, s, w);
  const [shape, setShape] = useState(maxShape);
  const [channelSettings, setChannelSettings] = useState({});
  const [canvas, setCanvas] = useState(null);
  const rootRef = React.useMemo(() => {
    return shapeRef(setShape);
  }, [maxShape]);

  useEffect(() => {
    //console.log("VivView: useEffect: groups", groups);
  }, [groups]);

  useEffect(() => {
    // Gets the default settings
    setMainSettings(toMainSettings(hash, loader, groups));

  }, [loader,groups,hash]);
  const mainProps = {
    ...{
      ...shape,
      id: "mainLayer",
      loader: loader.data,
      ...(mainSettings as any),
    }
  };

  const series = "https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb/studies/2.25.93749216439228361118017742627453453196/series/1.3.6.1.4.1.5962.99.1.2344794501.795090168.1655907236229.4.0";
  const instances = `${series}/instances/`;
  // Enables regeneration of test pyramid
  if (false) {
    readInstances(instances).then(
      async (instance_list) => {
        const pyramids = await Promise.all(
          instance_list.map(({ SOPInstanceUID }, i) => {
            const instance = `${series}/instances/${SOPInstanceUID}`;
            return readMetadata(instance).then(
              instance_metadata => {
                const pyramid = computeImagePyramid({
                  metadata: instance_metadata
                })
                return pyramid;
              }
            )
          })
        )
        const channel_pyramids = pyramids.reduce((o, i) => {
          const k = String(
            i.metadata[0].OpticalPathSequence[0].OpticalPathIdentifier
          );
          const channel_pyramid = [
            ...(o[k] || []), ...[i]
          ];
          return {
            ...o, [k]: channel_pyramid
          }
        }, {});
        // For first optical channel
        const test_pyramids = Object.fromEntries(
          Object.entries(channel_pyramids).map(
            ([key, pyramid]) => ([
              key, Object.values(pyramid).map(
                ({ frameMappings, extent, tileSizes }) => ({ 
                  extent,
                  width: Math.abs(extent[2]),
                  height: Math.abs(extent[3]),
                  frameMappings: Object.fromEntries(
                    Object.entries(frameMappings[0]).map(
                      ([k,v]) => (
                        [k, v.split('/').slice(-3).join('/')]
                      )
                    )
                  ),
                  tileSize: Math.max(...tileSizes[0])
                })
              ).sort((a, b) => {
                return a.width - b.width
              })
            ])
          )
        );
        console.log(JSON.stringify(test_pyramids));
      }
    );
  }
  const layer_settings = [...(
    Object.entries(mainSettings.channelsVisible).
      filter(([i,x]) => x).map(([i,x]) => parseInt(i))
  ).toReversed().map(i => {
    return {
      visible: true,
      id: `${mainSettings.selections[i].c}`,
      lowerRange: mainSettings.contrastLimits[i][0],
      upperRange: mainSettings.contrastLimits[i][1],
      color: mainSettings.colors[i],
    }
  })];
  const layers = layer_settings.map(
    settings => createTileLayer(
      {
        pyramids: testPyramids, series
      },
      settings
    )
  );
  const n_levels = loader.data.length;
  const shape_labels = loader.data[0].labels;
  const shape_values = loader.data[0].shape;
  const imageShape = Object.fromEntries(
    shape_labels.map((k, i) => [k, shape_values[i]])
  );
  const [viewState, setViewState] = useState({
    zoom: -n_levels,
    target: [imageShape.x / 2, imageShape.y / 2, 0]
  });
  if (!loader || !mainSettings) return null;
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
