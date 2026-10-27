import type { Matrix4 } from "@math.gl/core";
import { orientationForImage } from "@/lib/imaging/imageOrientation";
import { omePixelsElement, parseOmeXml } from "@/lib/imaging/omeXml";
import type { Loader } from "@/lib/imaging/viv";
import {
  frameModelMatrix,
  layerModelMatrix,
  omePixelsWorldFrame,
} from "@/lib/imaging/worldFrame";
import { useAppStore } from "@/lib/stores/appStore";
import type { StoryShape } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { viewerShapesToStoryShapes } from "@/lib/stores/storeUtils";
import { ensureDefaultWaypoint } from "@/lib/waypoints/ensureDefaultWaypoint";
import { parseOmeXmlStringToRois } from "./omeXmlRois";
import type { Roi } from "./roiParser";
import { parseRoisFromLoader, parseRoisFromRoiList } from "./roiParser";
import { mapShapePoints, type Shape } from "./shapeModel";

/**
 * ROI coordinates (after each shape's own `<Transform>`) are image pixels;
 * story shapes are in world µm. `toWorld` is the image's pixel → world matrix.
 */
function roiShapesToWorld(shapes: Shape[], toWorld: Matrix4): StoryShape[] {
  return viewerShapesToStoryShapes(
    shapes.map((shape) =>
      mapShapePoints(shape, ([x, y]) => {
        const [wx, wy] = toWorld.transformAsPoint([x, y, 0]);
        return [wx, wy];
      }),
    ),
  );
}

const imageOrientation = (imageId: string | undefined) =>
  orientationForImage(useDocumentStore.getState().images, imageId, null);

/** Same ROI ids in two files must not collapse. Re-import of one image still does. */
function scopeImportedShapeIds(
  shapes: StoryShape[],
  imageId: string | undefined,
): StoryShape[] {
  if (!imageId) return shapes;
  return shapes.map((shape) => ({ ...shape, id: `${imageId}:${shape.id}` }));
}

/**
 * Waypoint that imported annotations attach to: the one open in the Story tab,
 * else the active row, else the first. Adds "Waypoint 1" when the story has none.
 */
function importTargetWaypointIndex(): number {
  ensureDefaultWaypoint();
  const { openWaypointId, activeStoryIndex } = useAppStore.getState();
  const { waypoints } = useDocumentStore.getState();
  const openIndex = waypoints.findIndex((w) => w.id === openWaypointId);
  if (openIndex >= 0) return openIndex;
  if (
    activeStoryIndex != null &&
    activeStoryIndex >= 0 &&
    activeStoryIndex < waypoints.length
  ) {
    return activeStoryIndex;
  }
  return 0;
}

/**
 * Append imported OME ROI story shapes to the {@link importTargetWaypointIndex} waypoint,
 * skipping ids already present in `document.shapes` or on that waypoint (re-import / double
 * loader path). Returns how many were added, and to which waypoint.
 */
function appendImportedStoryShapesDeduped(storyShapes: StoryShape[]): {
  added: number;
  waypointId: string | null;
} {
  if (storyShapes.length === 0) return { added: 0, waypointId: null };

  const idx = importTargetWaypointIndex();
  const doc = useDocumentStore.getState();
  const { waypoints, shapes } = doc;
  const wp = waypoints[idx];
  if (!wp) return { added: 0, waypointId: null };
  const docIds = new Set(shapes.map((s) => s.id));
  const wpIds = new Set(wp.shapeIds ?? []);

  const seenInBatch = new Set<string>();
  const deduped: StoryShape[] = [];
  for (const s of storyShapes) {
    if (seenInBatch.has(s.id)) continue;
    seenInBatch.add(s.id);
    if (docIds.has(s.id) || wpIds.has(s.id)) {
      if (import.meta.env.DEV) {
        console.info(
          `[ome-roi] skip duplicate shape id (already in document or waypoint ${idx}): ${s.id}`,
        );
      }
      continue;
    }
    deduped.push(s);
  }
  if (deduped.length === 0) return { added: 0, waypointId: wp.id };

  const newIds = deduped.map((s) => s.id);
  doc.setWaypointsAndShapes(
    waypoints.map((w, i) =>
      i === idx ? { ...w, shapeIds: [...(w.shapeIds ?? []), ...newIds] } : w,
    ),
    [...shapes, ...deduped],
  );
  return { added: deduped.length, waypointId: wp.id };
}

/**
 * If the loader carries ROIs, or the raw OME-XML in `imageDescriptionOmeXml` does (e.g. when Viv
 * metadata dropped them), convert to story shapes placed on image `imageId` and attach them to
 * the open waypoint, else the active row, else the first.
 */
export function applyOmeRoisFromLoaderToWaypoint(
  loader: Loader,
  imageId: string,
  imageDescriptionOmeXml: string | null = null,
): void {
  let viewerRoiShapes = parseRoisFromLoader(loader);
  if (viewerRoiShapes.length === 0 && imageDescriptionOmeXml) {
    try {
      const rois = parseOmeXmlStringToRois(imageDescriptionOmeXml);
      viewerRoiShapes = parseRoisFromRoiList(rois);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(
          "[ome-roi] could not parse ROIs from ImageDescription XML",
          e,
        );
      }
    }
  }
  const storyShapes = roiShapesToWorld(
    viewerRoiShapes,
    layerModelMatrix(loader, imageOrientation(imageId)),
  );
  appendImportedStoryShapesDeduped(scopeImportedShapeIds(storyShapes, imageId));
}

/**
 * Import annotations from an OME-XML file (e.g. companion to the image) and attach to the open
 * waypoint, else the active row, else the first. ROI pixels are placed by {@link omePixelsWorldFrame}, else on the
 * viewer's first image. On success, `waypointId` is the waypoint they were added to.
 */
export function applyOmeRoisFromAnnotationXmlString(
  xml: string,
):
  | { success: true; shapeCount: number; waypointId: string }
  | { success: false; error: string; shapeCount: number } {
  const { viewerImageFrames } = useAppStore.getState();
  if (viewerImageFrames.length === 0) {
    return {
      success: false,
      error: "Load an image before importing annotations.",
      shapeCount: 0,
    };
  }
  let rois: Roi[];
  try {
    rois = parseOmeXmlStringToRois(xml);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      shapeCount: 0,
    };
  }
  if (rois.length === 0) {
    return {
      success: false,
      error: "No ROIs with drawable shapes were found in the XML.",
      shapeCount: 0,
    };
  }
  const viewerRoiShapes = parseRoisFromRoiList(rois);
  const omeDoc = parseOmeXml(xml);
  const pixels = omeDoc && omePixelsElement(omeDoc);
  const frame =
    (pixels && omePixelsWorldFrame(pixels, viewerImageFrames)) ??
    viewerImageFrames[0];
  const storyShapes = roiShapesToWorld(
    viewerRoiShapes,
    frameModelMatrix(frame, imageOrientation(frame.sourceImageId)),
  );
  if (storyShapes.length === 0) {
    return {
      success: false,
      error: "No valid annotations could be built from the XML.",
      shapeCount: 0,
    };
  }
  const { added, waypointId } = appendImportedStoryShapesDeduped(
    scopeImportedShapeIds(storyShapes, frame.sourceImageId),
  );
  if (added === 0 || waypointId === null) {
    return {
      success: false,
      error:
        "All annotations from this file are already present (duplicate import skipped).",
      shapeCount: 0,
    };
  }
  return { success: true, shapeCount: added, waypointId };
}
