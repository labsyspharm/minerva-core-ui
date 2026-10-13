import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Presentation } from "@/components/playback/Presentation";
import { StoryPlaybackView } from "@/components/playback/StoryPlaybackView";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import {
  loadStoryDocument,
  type StoryDocumentInput,
} from "@/lib/story/loadStoryDocument";
import styles from "./StoryPlayerApp.module.css";

const NO_SOURCES_MESSAGE =
  "No image sources in document.json. Re-export the story from Minerva Author.";

export type StoryPlayerStatus =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: string };

/** One load of a story. A new object loads again, even for the same input. */
export type StoryLoadRequest = { readonly input: StoryDocumentInput };

export type StoryPlayerAppProps = {
  /** The story to show; keep the object stable until the next load. */
  request: StoryLoadRequest;
  /** Show the document title ribbon (default true). */
  showDocumentTitle?: boolean;
  /**
   * "ready" once the story is shown (waypoints and groups usable); images may
   * still be opening, and a later "error" can follow if none load.
   */
  onStatusChange?: (status: StoryPlayerStatus) => void;
};

/**
 * Published-story player (CDN bundle and `<MinervaStory>`). Authoring preview
 * reuses the Presentation ribbon and nav.
 */
export function StoryPlayerApp({
  request,
  showDocumentTitle = true,
  onStatusChange,
}: StoryPlayerAppProps) {
  // The request whose document is in the stores. Compared by identity rather
  // than a boolean so a reload whose `onDocument` lands in the same render
  // batch as the reset still reads as a change.
  const [shownRequest, setShownRequest] = useState<StoryLoadRequest | null>(
    null,
  );
  const documentReady = shownRequest === request;
  const [imagesReady, setImagesReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jpegLoaderEntries, setJpegLoaderEntries] = useState<JpegLoaderEntry[]>(
    [],
  );
  const [omeLoaderEntries, setOmeLoaderEntries] = useState<OmeLoaderEntry[]>(
    [],
  );
  const [dicomIndexList, setDicomIndexList] = useState<DicomIndex[]>([]);
  const onStatusChangeRef = useRef(onStatusChange);
  useLayoutEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });

  useEffect(() => {
    // Aborted by the next request or unmount: the stale load stops before it
    // writes the shared stores, so it cannot replace the newer story.
    const load = new AbortController();
    const { signal } = load;
    const report = (status: StoryPlayerStatus) =>
      onStatusChangeRef.current?.(status);
    // The new story renders while its images open; never under the old ones.
    setJpegLoaderEntries([]);
    setOmeLoaderEntries([]);
    setDicomIndexList([]);
    setImagesReady(false);
    setError(null);
    report({ status: "loading" });
    void loadStoryDocument(request.input, {
      signal,
      onDocument: () => {
        if (!signal.aborted) setShownRequest(request);
      },
    })
      .then((result) => {
        if (signal.aborted) return;
        setJpegLoaderEntries(result.jpegLoaderEntries);
        setOmeLoaderEntries(result.omeLoaderEntries);
        setDicomIndexList(result.dicomIndexList);
        setImagesReady(true);
      })
      .catch((e) => {
        if (signal.aborted) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        report({ status: "error", error: message });
      });
    return () => load.abort();
  }, [request]);

  const sourceCount =
    jpegLoaderEntries.length + omeLoaderEntries.length + dicomIndexList.length;
  const noSources = imagesReady && sourceCount === 0;

  // Report "ready" from an effect so it fires after Presentation's mount
  // effects (initial waypoint camera + group); programmatic state applied on
  // "ready" then lands on top instead of being overwritten.
  useEffect(() => {
    if (!documentReady || error) return;
    if (noSources) {
      onStatusChangeRef.current?.({
        status: "error",
        error: NO_SOURCES_MESSAGE,
      });
      return;
    }
    onStatusChangeRef.current?.({ status: "ready" });
  }, [documentReady, error, noSources]);

  if (error) return <div className={styles.status}>{error}</div>;
  if (!documentReady)
    return <div className={styles.status}>Loading story…</div>;
  if (noSources) {
    return <div className={styles.status}>{NO_SOURCES_MESSAGE}</div>;
  }

  return (
    <Presentation showDocumentTitle={showDocumentTitle}>
      <StoryPlaybackView
        jpegLoaderEntries={jpegLoaderEntries}
        setJpegLoaderEntries={setJpegLoaderEntries}
        omeLoaderEntries={omeLoaderEntries}
        dicomIndexList={dicomIndexList}
        imagesLoading={!imagesReady}
      />
    </Presentation>
  );
}
