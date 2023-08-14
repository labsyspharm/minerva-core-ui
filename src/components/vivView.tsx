import * as React from "react";
import { useRef, useState, useEffect } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { loadOmeTiff } from "@hms-dbmi/viv";
import { MinervaVivViewer } from "./vivViewer";
import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";
import { VivLensing } from "./vivLensing";
import { LensingDetailView } from "./vivViewer";

export type Props = {
  groups: any[];
  stories: any[];
  viewerConfig: any;
  hash: any;
  setHash: any;
};

const url = "/LUNG-3-PR_40X.ome.tif";

const Main = styled.div`
  height: 100%;
`;

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
  const { groups, stories, hash, setHash } = props;
  const { g } = hash;
  const [settings, setSettings] = useState(props.viewerConfig.toSettings(hash));
  const [shape, setShape] = useState(useWindowSize());
  const [channels, setChannels] = useState([]);
  const [loader, setLoader] = useState(null);
  // const [lensPosition, setLensPosition] = useState({});
  const [mousePosition, setMousePosition] = useState([null, null]);
  const [lensRadius, setLensRadius] = useState(100);
  const [movingLens, setMovingLens] = useState(false);
  const [lensOpacity, setLensOpacity] = useState(1);

  useEffect(() => {
    loadOmeTiff(url).then(setLoader);
  }, []);

  useEffect(() => {
    if (groups?.[g]?.channels) {
      setChannels(
        groups?.[g]?.channels.map((d: any, i: number) => ({ id: i, ...d }))
      );
    }
  }, [groups, g]);

  useEffect(() => {
    if (channels.length > 0 && loader) {
      const selections = channels.map((d) => ({ z: 0, t: 0, c: d.id }));
      const contrastLimits = channels.map(() => [0, 65535]);
      const colors = channels.map((d) => hex2rgb(`#${d.color}`));
      const channelsVisible = channels.map(() => true);
      setSettings({ channelsVisible, colors, selections, contrastLimits });
    }
  }, [loader, channels]);
  useEffect(() => {}, [mousePosition]);

  if (!loader || !settings) return null;
  return (
    <Main>
      <MinervaVivViewer
        {...{
          ...shape,
          ...(settings as any),
          viewStates: [],

          loader: loader.data,
          lensEnabled: true,
          lensSelection: 1,
          mousePosition,
          detailView: new LensingDetailView({
            id: "detail",
            ...shape,
            mousePosition,
            lensRadius,
            lensOpacity,
          }),

          extensions: [new VivLensing()],
          onViewportLoad: () => {
            if (mousePosition[0] === null || mousePosition[1] === null) {
              setMousePosition([
                Math.round((deckRef?.current?.deck?.width || 0) / 2),
                Math.round((deckRef?.current?.deck?.height || 0) / 2),
              ]);
            }
          },
          onViewStateChange: ({ oldViewState, viewState }: any) => {
            return movingLens ? oldViewState : viewState;
          },

          deckProps: {
            layers: [],
            ref: deckRef,
            userData: {
              mousePosition,
              setMousePosition,
              movingLens,
              setMovingLens,
              lensRadius,
              setLensRadius,
              lensOpacity,
              setLensOpacity,
            },
          },
        }}
      />
    </Main>
  );
};

export { VivView };
