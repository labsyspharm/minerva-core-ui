import * as React from "react";
import { getDefaultInitialViewState } from "@vivjs/views";
import { ColorPaletteExtension } from "@vivjs/extensions";
import { VivViewer, VivView } from "@hms-dbmi/viv";
import { OrthographicView } from "@deck.gl/core";
import { MultiscaleImageLayer, ImageLayer } from "@vivjs/layers";

import { CompositeLayer, COORDINATE_SYSTEM } from "@deck.gl/core";
import {
  LineLayer,
  TextLayer,
  ScatterplotLayer,
  PolygonLayer,
  SolidPolygonLayer,
} from "@deck.gl/layers";

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
  lensMousePosition: { type: "array", value: [0, 0], compare: true },
};

function dotProduct(v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1];
}

const LensLayer = class extends CompositeLayer {
  constructor(props) {
    super(props);
  }
  props: any;
  context: any;
  lensPosition: any;
  renderLayers() {
    const { id, viewState } = this.props;
    const mousePosition = this.context.userData.mousePosition || [
      Math.round((this.context.deck.width || 0) / 2),
      Math.round((this.context.deck.height || 0) / 2),
    ];
    this.lensPosition =
      this.context.deck.pickObject({
        x: mousePosition[0],
        y: mousePosition[1],
        radius: 1,
      })?.coordinate || viewState.target;

    const lensCircle = new ScatterplotLayer({
      id: `lens-circle-${id}`,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      data: [this.lensPosition],
      pickable: true,
      animate: true,
      // opacity: 0.5,
      stroked: true,
      alphaCutoff: 0,
      filled: true,
      updateTriggers: {
        getPosition: Date.now() % 2000,
      },

      getFillColor: (d) => [0, 0, 0, 0],
      lineWidthMinPixels: 1,
      getPosition: (d) => {
        return d;
      },
      getRadius: (d) => {
        let multiplier = 1 / Math.pow(2, viewState.zoom);
        const size = this.context.userData.lensRadius * multiplier;
        return size;
      },
      getLineColor: (d) => [255, 255, 255],
      getLineWidth: (d) => {
        const multiplier = 1 / Math.pow(2, viewState.zoom);
        return 3 * multiplier;
      },
    });

    const resizeCircle = new ScatterplotLayer({
      id: `resize-circle-${id}`,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      data: [this.lensPosition],
      pickable: true,
      animate: true,
      // opacity: 0.5,
      stroked: true,
      alphaCutoff: 0,
      filled: true,
      updateTriggers: {
        getPosition: Date.now() % 2000,
      },

      getFillColor: (d) => [0, 0, 0, 0],
      lineWidthMinPixels: 1,
      getPosition: (d) => {
        let multiplier = 1 / Math.pow(2, viewState.zoom);
        const resizeRadius = 25 * multiplier;
        const lensRadius = this.context.userData.lensRadius * multiplier;
        const distanceFromCenter = lensRadius + resizeRadius; // Adjusts distance between lens and circle
        const dx = Math.cos(Math.PI / 4) * distanceFromCenter;
        const dy = Math.sin(Math.PI / 4) * distanceFromCenter;
        return [d[0] + dx, d[1] + dy];
      },
      getRadius: (d) => {
        let multiplier = 1 / Math.pow(2, viewState.zoom);
        const resizeRadius = 25;

        const size = resizeRadius * multiplier;
        return size;
      },
      getLineColor: (d) => [255, 255, 255],
      getLineWidth: (d) => {
        const multiplier = 1 / Math.pow(2, viewState.zoom);
        return 3 * multiplier;
      },
    });

    const arrowLayer = new SolidPolygonLayer({
      id: `arrow-layer-${id}`,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      data: [this.lensPosition],
      getPolygon: (d) => {
        let multiplier = 1 / Math.pow(2, viewState.zoom);
        const arrowLength = 10 * multiplier;
        const resizeRadius = 25 * multiplier;
        const lensRadius = this.context.userData.lensRadius * multiplier;
        const distanceFromCenter = lensRadius + resizeRadius;
        const dx = Math.cos(Math.PI / 4) * distanceFromCenter;
        const dy = Math.sin(Math.PI / 4) * distanceFromCenter;
        const center = [d[0] + dx, d[1] + dy];

        const x1 = center[0] + arrowLength * Math.cos(Math.PI / 4);
        const y1 = center[1] + arrowLength * Math.sin(Math.PI / 4);
        const x2 = center[0] - arrowLength * Math.cos(Math.PI / 4);
        const y2 = center[1] - arrowLength * Math.sin(Math.PI / 4);

        const lineWidth = 2 * multiplier;

        const topLeft = [
          x1 + lineWidth * Math.sin(Math.PI / 4),
          y1 - lineWidth * Math.cos(Math.PI / 4),
        ];
        const topRight = [
          x1 - lineWidth * Math.sin(Math.PI / 4),
          y1 + lineWidth * Math.cos(Math.PI / 4),
        ];
        const bottomRight = [
          x2 - lineWidth * Math.sin(Math.PI / 4),
          y2 + lineWidth * Math.cos(Math.PI / 4),
        ];
        const bottomLeft = [
          x2 + lineWidth * Math.sin(Math.PI / 4),
          y2 - lineWidth * Math.cos(Math.PI / 4),
        ];

        const arrowheadLength = 14 * multiplier;
        const arrowheadWidth = 8 * multiplier;

        // Arrowhead tips
        const arrowheadTip1 = [
          x1 + arrowheadLength * Math.cos(Math.PI / 4),
          y1 + arrowheadLength * Math.sin(Math.PI / 4),
        ];
        const arrowheadTip2 = [
          x2 - arrowheadLength * Math.cos(Math.PI / 4),
          y2 - arrowheadLength * Math.sin(Math.PI / 4),
        ];

        // Arrowhead bases: 3 times the width of the line
        const arrowheadBase1A = [
          x1 + arrowheadWidth * Math.sin(Math.PI / 4),
          y1 - arrowheadWidth * Math.cos(Math.PI / 4),
        ];
        const arrowheadBase1B = [
          x1 - arrowheadWidth * Math.sin(Math.PI / 4),
          y1 + arrowheadWidth * Math.cos(Math.PI / 4),
        ];
        const arrowheadBase2A = [
          x2 + arrowheadWidth * Math.sin(Math.PI / 4),
          y2 - arrowheadWidth * Math.cos(Math.PI / 4),
        ];
        const arrowheadBase2B = [
          x2 - arrowheadWidth * Math.sin(Math.PI / 4),
          y2 + arrowheadWidth * Math.cos(Math.PI / 4),
        ];

        return [
          topLeft,
          arrowheadBase1A,
          arrowheadTip1,
          arrowheadBase1B,
          topRight,
          bottomRight,
          arrowheadBase2B,
          arrowheadTip2,
          arrowheadBase2A,
          bottomLeft,
          topLeft,
        ];
      },
      getFillColor: [53, 121, 246],
      extruded: false,
      pickable: false,
    });
    const opacityLayer = new PolygonLayer({
      id: `opacity-layer-${id}`,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      data: [this.lensPosition],
      getPolygon: (d) => {
        const opacity = this.context.userData.lensOpacity;
        const angle = (3 * Math.PI) / 2 - ((0.5 - opacity) * Math.PI) / 2;
        let multiplier = 1 / Math.pow(2, viewState.zoom);

        const lensRadius = this.context.userData.lensRadius * multiplier;

        const centerOfSemiCircle = [
          d[0] + Math.cos(angle) * lensRadius,
          d[1] + Math.sin(angle) * lensRadius,
        ];
        const size = 25 * multiplier;

        // Generate semicircle points
        const semiCirclePoints = [];
        for (
          let theta = angle + Math.PI / 2;
          theta <= (3 * Math.PI) / 2 + angle;
          theta += Math.PI / 36
        ) {
          // Change the denominator for more or fewer points
          semiCirclePoints.push([
            centerOfSemiCircle[0] - size * Math.cos(theta),
            centerOfSemiCircle[1] - size * Math.sin(theta),
          ]);
        }

        // Add center of the semicircle to close the shape
        semiCirclePoints.push(centerOfSemiCircle);

        return semiCirclePoints;
      },
      getFillColor: [0, 0, 0, 0],
      getLineWidth: (d) => {
        const multiplier = 1 / Math.pow(2, viewState.zoom);
        return 3 * multiplier;
      },
      extruded: false,
      pickable: true,
      alphaCutoff: 0,
      stroked: true,
      getLineColor: [255, 255, 255],
    });

    return [lensCircle, resizeCircle, arrowLayer, opacityLayer];
  }
  onDrag(pickingInfo, event) {
    console.log("Drag", pickingInfo?.sourceLayer?.id);
    const { viewState } = this.props;
    this.context.userData.setMovingLens(true);

    if (pickingInfo?.sourceLayer?.id === `resize-circle-${this.props.id}`) {
      const lensCenter = this.context.userData.mousePosition;
      console.log("lensCenter", lensCenter, "event", event.offsetCenter);
      const xIntercept =
        (lensCenter[0] -
          lensCenter[1] +
          event.offsetCenter.x +
          event.offsetCenter.y) /
        2;
      const yIntercept = xIntercept + lensCenter[1] - lensCenter[0];
      const dx = xIntercept - lensCenter[0];
      const dy = yIntercept - lensCenter[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      const resizeRadius = 25;
      const newRadius = distance - resizeRadius;
      this.context.userData.setLensRadius(newRadius);
    } else if (
      pickingInfo?.sourceLayer?.id === `opacity-layer-${this.props.id}`
    ) {
      // console.log("Opacity");
      const lensCenter = this.context.userData.mousePosition;
      const angle = Math.atan2(
        lensCenter[1] - event.offsetCenter.y,
        lensCenter[0] - event.offsetCenter.x
      );
      let opacity;
      if (angle < Math.PI / 4 && angle > -Math.PI / 2) {
        opacity = 0;
      } else if (angle > (3 * Math.PI) / 4 || angle < -Math.PI / 2) {
        opacity = 1;
      } else {
        opacity = (angle - Math.PI / 4) / (Math.PI / 2);
      }

      this.context.userData.setLensOpacity(opacity);

      // Calcualte angle between event.offsetCenter\ and lensCenter
    } else {
      console.log("pickingInfo", pickingInfo.sourceLayer.id);
      this.context.userData.setMousePosition([
        event.offsetCenter.x,
        event.offsetCenter.y,
      ]);
    }
  }

  onDragEnd(pickingInfo, event) {
    this.context.userData.setMovingLens(false);

    // if (pickingInfo?.sourceLayer?.id !== `resize-circle-${this.props.id}`) {
    //   console.log("pickingInfo", pickingInfo.sourceLayer.id);
    //   this.context.userData.setMousePosition([
    //     event.offsetCenter.x,
    //     event.offsetCenter.y,
    //   ]);
    // }
  }
};
// @ts-ignore
LensLayer.layerName = "LensLayer";
// @ts-ignore
LensLayer.defaultProps = defaultProps;

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

class LensingDetailView extends VivView {
  props: any;
  mousePosition: any;
  lensRadius: any;
  lensOpacity: any;
  constructor(props) {
    super(props);
    this.mousePosition = props?.mousePosition || [null, null];
    this.lensRadius = props?.lensRadius;
    this.lensOpacity = props?.lensOpacity;
  }
  getLayers({ props, viewStates }) {
    const { loader } = props;
    const { id, height, width } = this;
    const layerViewState = viewStates[id];
    const layers = [getImageLayer(id, props)];

    // Inspect the first pixel source for physical sizes
    if (loader[0]?.meta?.physicalSizes?.x) {
      const { size, unit } = loader[0].meta.physicalSizes.x;
      layers.push(
        new LensLayer({
          id: getVivId(id),
          loader,
          unit,
          size,
          lensMousePosition: this.mousePosition,
          lensRadius: this.lensRadius,
          lensOpacity: this.lensOpacity,
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
  onDrag,
  onDragStart,
  onDragEnd,
  detailView,
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

export { MinervaVivViewer, LensingDetailView };
