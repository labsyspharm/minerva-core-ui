import type { Deck, Layer, LayerExtension } from "@deck.gl/core";
import { PathLayer, SolidPolygonLayer } from "@deck.gl/layers";

/**
 * Waypoint lens: a circle that follows the cursor and shows another channel
 * group inside it. The lens group's image layers draw over the base, clipped
 * by a mask polygon, on top of a dark disc so semi-transparent images do not
 * let the base group show through.
 */

/** Every lens layer id starts with this, so a draw can leave the lens out. */
export const LENS_LAYER_ID_PREFIX = "lens:";
const LENS_MASK_LAYER_ID = `${LENS_LAYER_ID_PREFIX}mask`;

/** Enough segments that the edge reads as a circle at 300px. */
const CIRCLE_SEGMENTS = 96;

type XY = [number, number];

function circlePolygon(center: XY, radius: number): XY[] {
  const ring: XY[] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    ring.push([
      center[0] + radius * Math.cos(a),
      center[1] + radius * Math.sin(a),
    ]);
  }
  return ring;
}

/** True for a lens layer or any sublayer it generated. */
function isLensLayer(layer: Layer): boolean {
  const root = (layer as Layer & { root?: Layer }).root ?? layer;
  return root.id.startsWith(LENS_LAYER_ID_PREFIX);
}

/**
 * Draw one frame now without the lens, for a canvas read (waypoint
 * thumbnails). Layer changes through `setProps` wait for the next frame, but
 * `_drawLayers` takes a layer list; @deck.gl/react calls it the same way.
 * Call `deck.redraw(reason)` afterwards to put the lens back.
 */
export function drawDeckWithoutLens(deck: Deck): void {
  const internals = deck as unknown as {
    layerManager?: { getLayers(): Layer[] } | null;
    _drawLayers?: (reason: string, opts: { layers: Layer[] }) => void;
  };
  const layers = internals.layerManager?.getLayers();
  if (!layers || typeof internals._drawLayers !== "function") return;
  internals._drawLayers("thumbnail-without-lens", {
    layers: layers.filter((layer) => !isLensLayer(layer)),
  });
}

/**
 * Clip the lens group's image layers to the lens circle. They stay mounted
 * while hidden so their tiles keep loading and the lens shows at once.
 */
export function clipLensImageLayers(
  layers: Layer[],
  maskExtension: LayerExtension,
  visible: boolean,
): Layer[] {
  return layers.map((layer) =>
    layer.clone({
      // Keep Viv's own extensions (its colour palette) and add the mask.
      extensions: [...(layer.props.extensions ?? []), maskExtension],
      maskId: LENS_MASK_LAYER_ID,
      visible,
    } as Parameters<typeof layer.clone>[0]),
  );
}

/**
 * The circle in world coordinates. A mask's texture is sized from its
 * layer's bounds, so a pixel-radius scatterplot (zero-area bounds) cannot
 * mask; the radius is converted from screen pixels for the current zoom.
 */
export function createLensOverlayLayers(opts: {
  center: XY;
  radiusWorld: number;
}): { under: Layer[]; over: Layer[] } {
  const polygon = circlePolygon(opts.center, opts.radiusWorld);
  const data = [{ polygon }];
  const getPolygon = (d: { polygon: XY[] }) => d.polygon;
  const getPath = (d: { polygon: XY[] }) => d.polygon;
  return {
    under: [
      new SolidPolygonLayer({
        id: `${LENS_LAYER_ID_PREFIX}backing`,
        data,
        getPolygon,
        getFillColor: [0, 0, 0, 255],
        pickable: false,
      }),
      new SolidPolygonLayer({
        id: LENS_MASK_LAYER_ID,
        operation: "mask",
        data,
        getPolygon,
        pickable: false,
      }),
    ],
    over: [
      new PathLayer({
        id: `${LENS_LAYER_ID_PREFIX}ring-shadow`,
        data,
        getPath,
        getColor: [0, 0, 0, 140],
        getWidth: 4,
        widthUnits: "pixels",
        pickable: false,
      }),
      new PathLayer({
        id: `${LENS_LAYER_ID_PREFIX}ring`,
        data,
        getPath,
        getColor: [255, 255, 255, 235],
        getWidth: 1.5,
        widthUnits: "pixels",
        pickable: false,
      }),
    ],
  };
}
