import { useEffect, useRef } from "react";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { saveStoryDocument } from "./storyPersistence";

/** Waypoints / images / etc. — heavier; longer debounce. */
const DEBOUNCE_MS = 2000;
/** Title and other metadata — short debounce so a quick refresh keeps edits. */
const METADATA_DEBOUNCE_MS = 400;

/**
 * Debounced persistence of {@link useDocumentStore} to Dexie (document slices only).
 * Flushes when the tab is hidden (often completes before unload) and on unload.
 */
export function useStoryAutoSave(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const flush = () => {
      const t = timerRef.current;
      if (t !== undefined) {
        clearTimeout(t);
        timerRef.current = undefined;
      }
      const s = useDocumentStore.getState();
      const id = s.activeStoryId;
      if (!id) return;
      void saveStoryDocument(id, s.toDocumentData());
    };

    const schedule = (delayMs: number) => {
      const t = timerRef.current;
      if (t !== undefined) clearTimeout(t);
      timerRef.current = setTimeout(flush, delayMs);
    };

    const unsub = useDocumentStore.subscribe((state, prev) => {
      if (state.activeStoryId !== prev.activeStoryId) {
        return;
      }
      const docChanged =
        state.waypoints !== prev.waypoints ||
        state.shapes !== prev.shapes ||
        state.channelGroups !== prev.channelGroups ||
        state.images !== prev.images ||
        state.metadata !== prev.metadata;
      if (!docChanged) return;
      if (!state.activeStoryId) return;
      const metadataOnly =
        state.metadata !== prev.metadata &&
        state.waypoints === prev.waypoints &&
        state.shapes === prev.shapes &&
        state.channelGroups === prev.channelGroups &&
        state.images === prev.images;
      schedule(metadataOnly ? METADATA_DEBOUNCE_MS : DEBOUNCE_MS);
    });

    const onBeforeUnload = () => {
      flush();
    };
    const onPageHide = () => {
      flush();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsub();
      const t = timerRef.current;
      if (t !== undefined) clearTimeout(t);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, []);
}
