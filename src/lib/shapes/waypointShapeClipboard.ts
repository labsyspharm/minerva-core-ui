import { useAppStore } from "@/lib/stores/appStore";
import {
  cloneShapesForPaste,
  readShapesFromSystemClipboard,
  writeShapesToSystemClipboard,
} from "./shapeClipboard";

export async function copySelectedWaypointShapes(): Promise<void> {
  const {
    shapes,
    shapeGroups,
    layersPanelSelectedShapeIds,
    layersPanelSelectedGroupId,
    flashLayersPanelSelection,
  } = useAppStore.getState();

  const selectedIds =
    layersPanelSelectedGroupId != null
      ? (shapeGroups.find((g) => g.id === layersPanelSelectedGroupId)
          ?.shapeIds ?? [])
      : layersPanelSelectedShapeIds;

  flashLayersPanelSelection({
    shapeIds: selectedIds,
    groupId: layersPanelSelectedGroupId,
  });

  const selected = new Set(selectedIds);
  if (selected.size === 0) return;
  const toCopy = shapes.filter((s) => selected.has(s.id));
  if (toCopy.length === 0) return;
  try {
    await writeShapesToSystemClipboard(toCopy);
  } catch (e) {
    console.warn("Copy shapes to clipboard failed", e);
  }
}

export async function pasteWaypointShapesFromClipboard(): Promise<void> {
  let raw: Awaited<ReturnType<typeof readShapesFromSystemClipboard>>;
  try {
    raw = await readShapesFromSystemClipboard();
  } catch (e) {
    console.warn("Read shapes from clipboard failed", e);
    return;
  }
  if (!raw?.length) return;
  const cloned = cloneShapesForPaste(raw);
  const {
    addShapesBatch,
    flashLayersPanelSelection,
    requestLayersPanelSelection,
  } = useAppStore.getState();

  addShapesBatch(cloned);

  const ids = cloned.map((a) => a.id);
  requestLayersPanelSelection({ shapeIds: ids, groupId: null });
  flashLayersPanelSelection({ shapeIds: ids, groupId: null });
}
