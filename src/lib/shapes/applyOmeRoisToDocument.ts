import type { Loader } from "@/lib/imaging/viv";
import type { StoryShape } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { viewerShapesToStoryShapes } from "@/lib/stores/storeUtils";
import { parseOmeXmlStringToRois } from "./omeXmlRois";
import type { Roi } from "./roiParser";
import { parseRoisFromLoader, parseRoisFromRoiList } from "./roiParser";

/**
 * Append imported OME ROI story shapes to the first waypoint, skipping ids already
 * present in `document.shapes` or on that waypoint (re-import / double loader path).
 */
function appendImportedStoryShapesDeduped(storyShapes: StoryShape[]): number {
  if (storyShapes.length === 0) return 0;

  const doc = useDocumentStore.getState();
  const { waypoints, shapes } = doc;
  if (waypoints.length === 0) {
    if (import.meta.env.DEV) {
      console.info(
        "[ome-roi] OME has embedded ROIs but the story has no waypoints; add a waypoint, then re-open the file or import ROIs manually when supported.",
      );
    }
    return 0;
  }

  const idx = 0;
  const wp = waypoints[idx];
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
          `[ome-roi] skip duplicate shape id (already in document or waypoint 0): ${s.id}`,
        );
      }
      continue;
    }
    deduped.push(s);
  }
  if (deduped.length === 0) return 0;

  const newIds = deduped.map((s) => s.id);
  doc.setShapes([...shapes, ...deduped]);
  doc.setWaypoints(
    waypoints.map((w, i) =>
      i === idx ? { ...w, shapeIds: [...(w.shapeIds ?? []), ...newIds] } : w,
    ),
  );
  return deduped.length;
}

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
  appendImportedStoryShapesDeduped(storyShapes);
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
  const added = appendImportedStoryShapesDeduped(storyShapes);
  if (added === 0) {
    return {
      success: false,
      error:
        "All annotations from this file are already present (duplicate import skipped).",
      shapeCount: 0,
    };
  }
  return { success: true, shapeCount: added };
}
