import * as React from "react";
import { RETURN_TO_LIBRARY_EVENT } from "@/lib/navigation/returnToLibraryEvent";
import {
  saveStoryDocument,
  setActiveStoryId,
} from "@/lib/persistence/storyPersistence";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { rootRouteApi } from "@/router/appRouter";

/**
 * Listens for {@link RETURN_TO_LIBRARY_EVENT} (e.g. from the author hamburger menu) and
 * performs the same save + URL clear as the former top-left Library control.
 */
export function StoryReturnToLibraryBridge() {
  const navigate = rootRouteApi.useNavigate();

  React.useEffect(() => {
    const handler = () => {
      void (async () => {
        const s = useDocumentStore.getState();
        if (s.activeStoryId) {
          await saveStoryDocument(s.activeStoryId, s.toDocumentData());
        }
        await setActiveStoryId(null);
        s.clearForLibraryView();
        navigate({
          search: (prev: { storyid?: string }) => {
            const next = { ...prev };
            delete next.storyid;
            return next;
          },
          replace: true,
        } as never);
      })();
    };
    window.addEventListener(RETURN_TO_LIBRARY_EVENT, handler);
    return () => window.removeEventListener(RETURN_TO_LIBRARY_EVENT, handler);
  }, [navigate]);

  return null;
}
