import { CompositeLayer, COORDINATE_SYSTEM, OrthographicView} from '@deck.gl/core';
import { LineLayer, TextLayer } from '@deck.gl/layers';

import { DEFAULT_FONT_FAMILY } from '@vivjs/constants';


export function range(len) {
    return [...Array(len).keys()];
  }
  

/**
 * Create a boudning box from a viewport based on passed-in viewState.
 * @param {Object} viewState The viewState for a certain viewport.
 * @returns {View} The DeckGL View for this viewport.
 */
export function makeBoundingBox(viewState) {
    const viewport = new OrthographicView().makeViewport({
      // From the current `detail` viewState, we need its projection matrix (actually the inverse).
      viewState,
      height: viewState.height,
      width: viewState.width
    });
    // Use the inverse of the projection matrix to map screen to the view space.
    return [
      viewport.unproject([0, 0]),
      viewport.unproject([viewport.width, 0]),
      viewport.unproject([viewport.width, viewport.height]),
      viewport.unproject([0, viewport.height])
    ];
  }
 
function getPosition(boundingBox, position, length) {
    const viewLength = boundingBox[2][0] - boundingBox[0][0];
    switch (position) {
        case 'bottom-right': {
            const yCoord =
                boundingBox[2][1] - (boundingBox[2][1] - boundingBox[0][1]) * length;
            const xLeftCoord = boundingBox[2][0] - viewLength * length;
            return [yCoord, xLeftCoord];
        }
        case 'top-right': {
            const yCoord = (boundingBox[2][1] - boundingBox[0][1]) * length;
            const xLeftCoord = boundingBox[2][0] - viewLength * length;
            return [yCoord, xLeftCoord];
        }
        case 'top-left': {
            const yCoord = (boundingBox[2][1] - boundingBox[0][1]) * length;
            const xLeftCoord = viewLength * length;
            return [yCoord, xLeftCoord];
        }
        case 'bottom-left': {
            const yCoord =
                boundingBox[2][1] - (boundingBox[2][1] - boundingBox[0][1]) * length;
            const xLeftCoord = viewLength * length;
            return [yCoord, xLeftCoord];
        }
        default: {
            throw new Error(`Position ${position} not found`);
        }
    }
}

const defaultProps = {
    pickable: { type: 'boolean', value: true, compare: true },
    viewState: {
        type: 'object',
        value: { zoom: 0, target: [0, 0, 0] },
        compare: true
    },
    unit: { type: 'string', value: '', compare: true },
    size: { type: 'number', value: 1, compare: true },
    position: { type: 'string', value: 'bottom-right', compare: true },
    length: { type: 'number', value: 0.085, compare: true }
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
const ScaleBarLayer = class extends CompositeLayer {
    props: any;
    static layerName: string;
    static defaultProps: { pickable: { type: string; value: boolean; compare: boolean; }; viewState: { type: string; value: { zoom: number; target: number[]; }; compare: boolean; }; unit: { type: string; value: string; compare: boolean; }; size: { type: string; value: number; compare: boolean; }; position: { type: string; value: string; compare: boolean; }; length: { type: string; value: number; compare: boolean; }; };
    renderLayers() {
        const { id, unit, size, position, viewState, length } = this.props;
        const boundingBox = makeBoundingBox(viewState);
        const { zoom } = viewState;
        const viewLength = boundingBox[2][0] - boundingBox[0][0];
        const barLength = viewLength * 0.05;
        // This is a good heuristic for stopping the bar tick marks from getting too small
        // and/or the text squishing up into the bar.
        const barHeight = Math.max(
            2 ** (-zoom + 1.5),
            (boundingBox[2][1] - boundingBox[0][1]) * 0.007
        );
        const numUnits = barLength * size;
        const [yCoord, xLeftCoord] = getPosition(boundingBox, position, length);
        const lengthBar = new LineLayer({
            id: `scale-bar-length-${id}`,
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            data: [
                [
                    [xLeftCoord, yCoord],
                    [xLeftCoord + barLength, yCoord]
                ]
            ],
            getSourcePosition: d => d[0],
            getTargetPosition: d => d[1],
            getWidth: 2,
            getColor: [220, 220, 220]
        });
        const tickBoundsLeft = new LineLayer({
            id: `scale-bar-height-left-${id}`,
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            data: [
                [
                    [xLeftCoord, yCoord - barHeight],
                    [xLeftCoord, yCoord + barHeight]
                ]
            ],
            getSourcePosition: d => d[0],
            getTargetPosition: d => d[1],
            getWidth: 2,
            getColor: [220, 220, 220]
        });
        const tickBoundsRight = new LineLayer({
            id: `scale-bar-height-right-${id}`,
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            data: [
                [
                    [xLeftCoord + barLength, yCoord - barHeight],
                    [xLeftCoord + barLength, yCoord + barHeight]
                ]
            ],
            getSourcePosition: d => d[0],
            getTargetPosition: d => d[1],
            getWidth: 2,
            getColor: [220, 220, 220]
        });
        const textLayer = new TextLayer({
            id: `units-label-layer-${id}`,
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            data: [
                {
                    text: numUnits.toPrecision(5) + unit,
                    position: [xLeftCoord + barLength * 0.5, yCoord + barHeight * 4]
                }
            ],
            getColor: [220, 220, 220, 255],
            getSize: 12,
            fontFamily: DEFAULT_FONT_FAMILY,
            sizeUnits: 'meters',
            sizeScale: 2 ** -zoom,
            characterSet: [
                ...unit.split(''),
                ...range(10).map(i => String(i)),
                '.',
                'e',
                '+'
            ]
        });
        return [lengthBar, tickBoundsLeft, tickBoundsRight, textLayer];
    }
};

ScaleBarLayer.layerName = 'ScaleBarLayer';
ScaleBarLayer.defaultProps = defaultProps;
export {ScaleBarLayer};


//   const lensBorderSvg =
// `<svg width="1000" height="1000" viewBox="0 0 1000 1000"  xmlns="http://www.w3.org/2000/svg">
// <circle cx="500" cy="500" r="497" fill="rgba(1,1,1,0)" stroke="rgba(1,1,1,0)" pointer-events="fill" stroke-width="6"/>
// </svg>`

// const resizeSvg =
// `<svg id="a" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 437.92 437.92">
// <g id="b">
// <polygon points="323.71 308.11 129.81 114.21 194.86 114.22 194.86 92.15 92.15 92.15 92.15 194.85 114.21 194.88 114.21 129.81 308.11 323.71 243.07 323.7 243.06 345.77 345.77 345.77 345.78 243.07 323.7 243.05 323.71 308.11" style="fill:#007bff;" />
// </g>
// <circle cx="218.96" cy="218.96" r="207.96" style="fill:none; stroke:#fff; stroke-miterlimit:10; stroke-width:22px;" />
// </svg>`

// const opacitySvg =
// `<svg id="a" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 437.92 218.96">
// <path d="m11,218.96C11,104.11,104.11,11,218.96,11s207.96,93.11,207.96,207.96" style="stroke:#fff; stroke-miterlimit:10; stroke-width:22px;" />
// </svg>`

// const lensOverlay = new IconLayer({
// id: 'lens-layer-#detail#',
// data: [mousePosition],
// getIcon: () => ({
// url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(lensBorderSvg)}`,
// width: 1000,
// height: 1000
// }),
// sizeScale: 2,
// getSize: d => 100,
// alphaCutoff: 0,
// getPosition: d => {
// const pickInfo = deckRef.current.pickObject({
//   x: d[0],
//   y: d[1],
//   radius: 1
// });
// return pickInfo.coordinate;
// },

// onDrag: (info, event) => {
// setMovingLens(true)
// moveLens(event)
// },
// onDragEnd: (info, event) => {
// setMovingLens(false)
// },
// pickable: true,
// });
