import * as React from "react";
import { useRef, useState, useEffect } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { loadOmeTiff } from "@hms-dbmi/viv";
import { MinervaVivViewer } from "./vivViewer";
import styled from "styled-components";
import { VivLensing, LensingDetailView } from "./vivLensing";
import { getDefaultInitialViewState } from "@vivjs/views";
import { VivViewer } from "@hms-dbmi/viv";

export type Props = {
  groups: any[];
  stories: any[];
  viewerConfig: any;
  hash: any;
  setHash: any;
};

const url = "/LUNG-3-PR_40X.ome.tif";
const DETAIL_VIEW_ID = "detail";

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

  const baseViewState = React.useMemo(() => {
    // Check if loader exists before trying to get the default view state.
    if (!loader || !shape) {
      return null;
    }
    console.log("getDefaultInitialViewState", loader, shape);
    return getDefaultInitialViewState(loader, { ...shape }, 0.5);
  }, [loader]);

  const layerConfig = {
    loader,
    contrastLimits: settings?.contrastLimits,
    colors: settings?.colors,
    channelsVisible: settings?.channelsVisible,
    selections: settings?.selections,
    onViewportLoad: () => {
      if (mousePosition[0] === null || mousePosition[1] === null) {
        setMousePosition([
          Math.round((deckRef?.current?.deck?.width || 0) / 2),
          Math.round((deckRef?.current?.deck?.height || 0) / 2),
        ]);
      }
    },
    lensEnabled: true,
    lensSelection: 0,
    lensRadius: 100,
    extensions: [new VivLensing()],
  };
  const views = [
    new LensingDetailView({
      id: DETAIL_VIEW_ID,
      ...shape,
      mousePosition,
      lensRadius,
      lensOpacity,
    }),
  ];
  const layerProps = [layerConfig, [{ ...layerConfig, lensEnabled: false }]];

  const viewStates = [{ ...baseViewState, id: DETAIL_VIEW_ID }];
  const hoverHooks = { handleValue: () => {}, handleCoordinate: () => {} };
  const onViewStateChange = ({ oldViewState, viewState }: any) => {
    return movingLens ? oldViewState : viewState;
  };

  if (!loader || !settings) return null;
  return (
    <Main>
      <VivViewer
        layerProps={layerProps}
        views={views}
        viewStates={viewStates}
        hoverHooks={hoverHooks}
        onViewStateChange={onViewStateChange}
        onHover={() => {}}
        deckProps={{
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
        }}
        // @ts-ignore
      />
    </Main>
  );
};

export { VivView };
