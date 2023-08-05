import * as React from "react";
import { getDefaultInitialViewState } from "@vivjs/views";
import { ColorPaletteExtension } from "@vivjs/extensions";
import { VivViewer, VivView } from "@hms-dbmi/viv";
import { OrthographicView } from "@deck.gl/core";
import { MultiscaleImageLayer, ImageLayer } from "@vivjs/layers";

import { CompositeLayer, COORDINATE_SYSTEM } from "@deck.gl/core";
import { LineLayer, TextLayer, ScatterplotLayer } from "@deck.gl/layers";

function range(len) {
  return [...Array(len).keys()];
}

import { DEFAULT_FONT_FAMILY } from "@vivjs/constants";

function getBoundingBoxCenter(viewState) {
  const viewport = new OrthographicView().makeViewport({
    // From the current `detail` viewState, we need its projection matrix (actually the inverse).
    viewState,
    height: viewState.height,
    width: viewState.width,
  });
  // Use the inverse of the projection matrix to map screen to the view space.
  return [viewport.unproject([viewport.width, viewport.height])];
}

const defaultProps = {
  pickable: { type: "boolean", value: true, compare: true },
  viewState: {
    type: "object",
    value: { zoom: 0, target: [0, 0, 0] },
    compare: true,
  },
  unit: { type: "string", value: "", compare: true },
  size: { type: "number", value: 1, compare: true },
  position: { type: "string", value: "bottom-right", compare: true },
  length: { type: "number", value: 0.085, compare: true },
};
/**
 * @typedef LayerProps
 * @type {Object}
 * @property {String} unit Physical unit size per pixel at full resolution.
 * @property {Number} size Physical size of a pixel.
 * @property {Object} viewState The current viewState for the desired view.  We cannot internally use this.context.viewport because it is one frame behind:
 * https://github.com/visgl/deck.gl/issues/4504
 * @property {Array=} boundingBox Boudning box of the view in which this should render.
 * @property {string=} id Id from the parent layer.
 * @property {number=} length Value from 0 to 1 representing the portion of the view to be used for the length part of the scale bar.
 */

/**
 * @type {{ new(...props: LayerProps[]) }}
 * @ignore
 */
const MyScaleBarLayer = class extends CompositeLayer {
  props: any;
  context: any;
  renderLayers() {
    const { id, viewState } = this.props;
    console.log("viewState", viewState);
    const mousePosition = this.context.userData.mousePosition || [
      Math.round((this.context.deck.width || 0) / 2),
      Math.round((this.context.deck.height || 0) / 2),
    ];
    const lensPosition =
      this.context.deck.pickObject({
        x: mousePosition[0],
        y: mousePosition[1],
        radius: 1,
      })?.coordinate || viewState.target;
    const lensCircle = new ScatterplotLayer({
      id: `scale-bar-length-${id}`,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      data: [lensPosition],
      pickable: true,
      opacity: 0.8,
      stroked: true,
      filled: false,
      lineWidthMinPixels: 1,
      getPosition: (d) => {
        console.log("d", d);
        return d;
      },
      getRadius: (d) => {
        let multiplier = 1 / Math.pow(2, viewState.zoom);
        const size = this.context.userData.lensRadius * multiplier;
        console.log("SOZE", size, this);
        return size;
      },
      getLineColor: (d) => [255, 255, 255],
    });

    return [lensCircle];
  }
};
// @ts-ignore
MyScaleBarLayer.layerName = "MyScaleBarLayer";
// @ts-ignore
MyScaleBarLayer.defaultProps = defaultProps;

function getImageLayer(id, props) {
  const { loader } = props;
  // Grab name of PixelSource if a class instance (works for Tiff & Zarr).
  const sourceName = loader[0]?.constructor?.name;

  // Create at least one layer even without selections so that the tests pass.
  const Layer = loader.length > 1 ? MultiscaleImageLayer : ImageLayer;
  const layerLoader = loader.length > 1 ? loader : loader[0];

  return new Layer({
    ...props,
    id: `${sourceName}${getVivId(id)}`,
    viewportId: id,
    loader: layerLoader,
  });
}

function getVivId(id) {
  return `-#${id}#`;
}
export const DETAIL_VIEW_ID = "detail";

class MyDetailView extends VivView {
  getLayers({ props, viewStates }) {
    const { loader } = props;
    const { id, height, width } = this;
    const layerViewState = viewStates[id];
    const layers = [getImageLayer(id, props)];

    // Inspect the first pixel source for physical sizes
    if (loader[0]?.meta?.physicalSizes?.x) {
      const { size, unit } = loader[0].meta.physicalSizes.x;
      layers.push(
        // @ts-ignore
        new MyScaleBarLayer({
          id: getVivId(id),
          //@ts-ignore
          loader,
          unit,
          size,
          viewState: { ...layerViewState, height, width },
        })
      );
    }

    return layers;
  }
}

const MinervaVivViewer = ({
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
  extensions = [new ColorPaletteExtension()],
  deckProps,
}) => {
  const detailViewState = viewStatesProp?.find((v) => v.id === DETAIL_VIEW_ID);
  const baseViewState = React.useMemo(
    () =>
      detailViewState ||
      getDefaultInitialViewState(loader, { height, width }, 0.5),
    [loader, detailViewState]
  );

  if (!loader) return null;

  const detailView = new MyDetailView({ id: DETAIL_VIEW_ID, height, width });
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
    />
  );
};

export { MinervaVivViewer };
