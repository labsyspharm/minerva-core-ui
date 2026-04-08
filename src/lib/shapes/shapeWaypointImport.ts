import type { Shape } from "./shapeModel";

export type ShapeImportMergeState = {
  shapes: Shape[];
  hiddenShapeIds: Set<string>;
};

/**
 * Append waypoint-imported shapes while optionally clearing prior **imported** ones.
 *
 * Shapes with `metadata.isImported` are cleared when `clearExisting`; shapes still
 * being drawn (`!isImported`) are kept until persisted (then marked imported in
 * `persistImportedShapesToStory`) so registry rehydration does not wipe in-progress work.
 */
export function mergeShapesAfterWaypointImport(
  state: ShapeImportMergeState,
  newShapes: Shape[],
  clearExisting: boolean,
): Pick<ShapeImportMergeState, "shapes" | "hiddenShapeIds"> {
  const existingShapes = clearExisting
    ? state.shapes.filter((s) => !s.metadata?.isImported)
    : state.shapes;

  const newHidden = clearExisting
    ? new Set(
        [...state.hiddenShapeIds].filter((id) => {
          const shape = state.shapes.find((s) => s.id === id);
          return shape && !shape.metadata?.isImported;
        }),
      )
    : state.hiddenShapeIds;

  const existingIds = new Set(existingShapes.map((s) => s.id));
  const appended = newShapes.filter((s) => !existingIds.has(s.id));

  return {
    shapes: [...existingShapes, ...appended],
    hiddenShapeIds: newHidden,
  };
}
