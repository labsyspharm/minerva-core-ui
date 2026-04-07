import type { Annotation } from "./stores";

export type AnnotationImportMergeState = {
  annotations: Annotation[];
  hiddenLayers: Set<string>;
};

/**
 * Append waypoint-imported annotations while optionally clearing prior imported ones.
 */
export function mergeAnnotationsAfterWaypointImport(
  state: AnnotationImportMergeState,
  newAnnotations: Annotation[],
  clearExisting: boolean,
): Pick<AnnotationImportMergeState, "annotations" | "hiddenLayers"> {
  const existingAnnotations = clearExisting
    ? state.annotations.filter((a) => !a.metadata?.isImported)
    : state.annotations;

  const newHiddenLayers = clearExisting
    ? new Set(
        [...state.hiddenLayers].filter((id) => {
          const annotation = state.annotations.find((a) => a.id === id);
          return annotation && !annotation.metadata?.isImported;
        }),
      )
    : state.hiddenLayers;

  const existingIds = new Set(existingAnnotations.map((a) => a.id));
  const appended = newAnnotations.filter((a) => !existingIds.has(a.id));

  return {
    annotations: [...existingAnnotations, ...appended],
    hiddenLayers: newHiddenLayers,
  };
}
