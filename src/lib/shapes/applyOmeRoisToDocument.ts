import type { Loader } from "@/lib/imaging/viv";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { viewerShapesToStoryShapes } from "@/lib/stores/storeUtils";
import { parseOmeXmlStringToRois } from "./omeXmlRois";
import type { Roi } from "./roiParser";
import { parseRoisFromLoader, parseRoisFromRoiList } from "./roiParser";

/**
 * If the loader carries ROIs, or the raw OME-XML in `imageDescriptionOmeXml` does (e.g. when Viv
 * metadata dropped them), convert to story shapes and attach them to the **first** waypoint.
 */
export function applyOmeRoisFromLoaderToFirstWaypoint(
  loader: Loader,
  imageDescriptionOmeXml: string | null = null,
): void {
  let { shapes: viewerRoiShapes } = parseRoisFromLoader(loader);
  if (viewerRoiShapes.length === 0 && imageDescriptionOmeXml) {
    try {
      const rois = parseOmeXmlStringToRois(imageDescriptionOmeXml);
      viewerRoiShapes = parseRoisFromRoiList(rois).shapes;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(
          "[ome-roi] could not parse ROIs from ImageDescription XML",
          e,
        );
      }
    }
  }
  const storyShapes = viewerShapesToStoryShapes(viewerRoiShapes);
  if (storyShapes.length === 0) return;

  const doc = useDocumentStore.getState();
  const { waypoints } = doc;
  if (waypoints.length === 0) {
    if (import.meta.env.DEV) {
      console.info(
        "[ome-roi] OME has embedded ROIs but the story has no waypoints; add a waypoint, then re-open the file or import ROIs manually when supported.",
      );
    }
    return;
  }

  const idx = 0;
  const newIds = storyShapes.map((s) => s.id);

  doc.setShapes([...doc.shapes, ...storyShapes]);
  doc.setWaypoints(
    waypoints.map((w, i) =>
      i === idx ? { ...w, shapeIds: [...w.shapeIds, ...newIds] } : w,
    ),
  );
}

/** @deprecated Use applyOmeRoisFromLoaderToFirstWaypoint */
export const applyOmeRoisFromLoaderToActiveWaypoint =
  applyOmeRoisFromLoaderToFirstWaypoint;

/**
 * Import annotations from an OME-XML file (e.g. companion to the image) and attach to the first waypoint.
 */
export function applyOmeRoisFromAnnotationXmlString(
  xml: string,
):
  | { success: true; shapeCount: number }
  | { success: false; error: string; shapeCount: number } {
  const doc = useDocumentStore.getState();
  const { waypoints } = doc;
  if (waypoints.length === 0) {
    return {
      success: false,
      error:
        "Add a waypoint in the story first, then import annotations to attach them.",
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
  const { shapes: viewerRoiShapes } = parseRoisFromRoiList(rois);
  const storyShapes = viewerShapesToStoryShapes(viewerRoiShapes);
  if (storyShapes.length === 0) {
    return {
      success: false,
      error: "No valid annotations could be built from the XML.",
      shapeCount: 0,
    };
  }
  const idx = 0;
  const newIds = storyShapes.map((s) => s.id);

  doc.setShapes([...doc.shapes, ...storyShapes]);
  doc.setWaypoints(
    waypoints.map((w, i) =>
      i === idx ? { ...w, shapeIds: [...w.shapeIds, ...newIds] } : w,
    ),
  );
  return { success: true, shapeCount: storyShapes.length };
}
