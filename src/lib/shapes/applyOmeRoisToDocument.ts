import type { Matrix4 } from "@math.gl/core";
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
import { parseRoisFromRoiList } from "./roiParser";
import { mapShapePoints, type Shape } from "./shapeModel";

/** ROI coordinates are image pixels; story shapes are in world µm. */
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

function documentImage(imageId: string | undefined) {
  return useDocumentStore.getState().images.find((im) => im.id === imageId);
}

/** Add shapes to waypoint `idx`, skipping ids already present; returns the added ids. */
function appendImportedStoryShapesDeduped(
  storyShapes: StoryShape[],
  idx = 0,
): string[] {
  const doc = useDocumentStore.getState();
  const wp = doc.waypoints[idx];
  if (!wp) return [];
  const seen = new Set([
    ...doc.shapes.map((s) => s.id),
    ...(wp.shapeIds ?? []),
  ]);
  const added = storyShapes.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  const ids = added.map((s) => s.id);
  if (ids.length === 0) return ids;
  doc.setShapes([...doc.shapes, ...added]);
  doc.setWaypoints(
    doc.waypoints.map((w, i) =>
      i === idx ? { ...w, shapeIds: [...(w.shapeIds ?? []), ...ids] } : w,
    ),
  );
  return ids;
}

/**
 * Attach ROIs from the loader (or its raw ImageDescription OME-XML, when Viv
 * dropped them) to the first waypoint, placed on image `imageId`.
 */
export function applyOmeRoisFromLoaderToFirstWaypoint(
  loader: Loader,
  imageId: string,
  imageDescriptionOmeXml: string | null = null,
): void {
  let shapes = parseRoisFromRoiList(loader.metadata.ROIs);
  if (shapes.length === 0 && imageDescriptionOmeXml) {
    try {
      shapes = parseRoisFromRoiList(
        parseOmeXmlStringToRois(imageDescriptionOmeXml),
      );
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[ome-roi] could not parse ImageDescription ROIs", e);
      }
    }
  }
  appendImportedStoryShapesDeduped(
    roiShapesToWorld(shapes, layerModelMatrix(loader, documentImage(imageId))),
  );
}

const fail = (error: string) => ({ success: false as const, error });

/**
 * Import an OME-XML ROI file into the waypoint being viewed (adding "Waypoint 1"
 * if there is none). ROI pixels are scaled by {@link omePixelsWorldFrame}, else
 * by the viewer's first image.
 */
export function applyOmeRoisFromAnnotationXmlString(
  xml: string,
): { success: true; shapeIds: string[] } | { success: false; error: string } {
  const { viewerImageFrames, authoringWaypointShapesIndex, activeStoryIndex } =
    useAppStore.getState();
  if (viewerImageFrames.length === 0) {
    return fail("Load an image before importing annotations.");
  }
  let shapes: Shape[];
  try {
    shapes = parseRoisFromRoiList(parseOmeXmlStringToRois(xml));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const doc = parseOmeXml(xml);
  const pixels = doc && omePixelsElement(doc);
  const frame =
    (pixels && omePixelsWorldFrame(pixels, viewerImageFrames)) ??
    viewerImageFrames[0];
  const storyShapes = roiShapesToWorld(
    shapes,
    frameModelMatrix(frame, documentImage(frame.sourceImageId)),
  );
  if (storyShapes.length === 0) {
    return fail("No drawable ROIs were found in the XML.");
  }
  ensureDefaultWaypoint();
  const shapeIds = appendImportedStoryShapesDeduped(
    storyShapes,
    authoringWaypointShapesIndex ?? activeStoryIndex ?? 0,
  );
  if (shapeIds.length === 0) {
    return fail("All annotations from this file are already present.");
  }
  return { success: true, shapeIds };
}
