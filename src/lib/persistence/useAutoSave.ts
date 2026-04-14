import { useEffect, useRef } from "react";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { saveStoryDocument } from "./storyPersistence";

const DEBOUNCE_MS = 2000;

/**
 * Debounced persistence of {@link useDocumentStore} to Dexie (document slices only).
 * Flushes on tab close / hide.
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

    const schedule = () => {
      const t = timerRef.current;
      if (t !== undefined) clearTimeout(t);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
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
      schedule();
    });

    const onBeforeUnload = () => {
      flush();
    };
    const onPageHide = () => {
      flush();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      unsub();
      const t = timerRef.current;
      if (t !== undefined) clearTimeout(t);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, []);
}
