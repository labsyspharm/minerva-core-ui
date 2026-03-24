import {
  cloneAnnotationsForPaste,
  readAnnotationsFromSystemClipboard,
  writeAnnotationsToSystemClipboard,
} from "@/lib/annotationClipboard";
import { useOverlayStore } from "@/lib/stores";

export async function copySelectedWaypointAnnotations(): Promise<void> {
  const { annotations, layersPanelSelectedAnnotationIds } =
    useOverlayStore.getState();
  const selected = new Set(layersPanelSelectedAnnotationIds);
  if (selected.size === 0) return;
  const toCopy = annotations.filter((a) => selected.has(a.id));
  if (toCopy.length === 0) return;
  try {
    await writeAnnotationsToSystemClipboard(toCopy);
  } catch (e) {
    console.warn("Copy annotations to clipboard failed", e);
  }
}

export async function pasteWaypointAnnotationsFromClipboard(): Promise<void> {
  let raw: Awaited<ReturnType<typeof readAnnotationsFromSystemClipboard>>;
  try {
    raw = await readAnnotationsFromSystemClipboard();
  } catch (e) {
    console.warn("Read annotations from clipboard failed", e);
    return;
  }
  if (!raw?.length) return;
  const cloned = cloneAnnotationsForPaste(raw);
  useOverlayStore.getState().addAnnotationsBatch(cloned);
}
