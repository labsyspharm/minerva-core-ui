import * as React from "react";
import { getDefaultInitialViewState } from "@vivjs/views";
import { ColorPaletteExtension } from "@vivjs/extensions";
import { VivViewer, VivView } from "@hms-dbmi/viv";

const DETAIL_VIEW_ID = "detail";

const MinervaVivViewer = (props) => {
  const {
    loader,
    contrastLimits,
    colors,
    channelsVisible,
    viewStates: viewStatesProp,
    colormap,
    overviewOn,
    selections,
    hoverHooks = { handleValue: () => {}, handleCoordinate: () => {} },
    height,
    width,
    lensEnabled = false,
    lensSelection = 0,
    lensRadius = 100,
    transparentColor,
    onViewStateChange,
    onHover,
    onViewportLoad,
    onDrag,
    onDragStart,
    onDragEnd,
    detailView,
    extensions,
    deckProps,
  } = props;

  console.log("MinervaVivViewer", props);
  // const detailViewState = viewStatesProp?.find((v) => v.id === DETAIL_VIEW_ID);
  const baseViewState = React.useMemo(
    () => getDefaultInitialViewState(loader, { height, width }, 0.5),
    [loader]
  );

  if (!loader) return null;

  const layerConfig = {
    loader,
    contrastLimits,
    colors,
    channelsVisible,
    selections,
    onViewportLoad,
    colormap,
    lensEnabled,
    lensSelection,
    lensRadius,
    extensions,
    transparentColor,
  };
  const views = [detailView];
  const layerProps = [
    layerConfig,
    ...(overviewOn && loader ? [{ ...layerConfig, lensEnabled: false }] : []),
  ];
  const viewStates = [{ ...baseViewState, id: DETAIL_VIEW_ID }];

  return (
    <VivViewer
      layerProps={layerProps}
      views={views}
      viewStates={viewStates}
      hoverHooks={hoverHooks}
      onViewStateChange={onViewStateChange}
      onHover={onHover}
      deckProps={deckProps}
      // @ts-ignore
    />
  );
};

export { MinervaVivViewer };
