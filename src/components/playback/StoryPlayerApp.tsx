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

export type StoryPlayerAppProps = {
  /** `document.json` URL, or its contents. Keep the reference stable. */
  source: StoryDocumentInput;
  /** Show the document title ribbon (default true). */
  showDocumentTitle?: boolean;
  /**
   * "ready" once the story is shown (waypoints and groups usable); images may
   * still be opening, and a later "error" can follow if none load.
   */
  onStatusChange?: (status: StoryPlayerStatus) => void;
};

/**
 * Published-story player (CDN bundle and `<MinervaStory>`). Same Presentation
 * → StoryPlaybackView tree as authoring Story preview (preview adds only the
 * Back ribbon).
 */
export function StoryPlayerApp({
  source,
  showDocumentTitle = true,
  onStatusChange,
}: StoryPlayerAppProps) {
  // The source whose document is in the stores. Compared by identity rather
  // than a boolean so a reload whose `onDocument` lands in the same render
  // batch as the reset still reads as a change.
  const [shownSource, setShownSource] = useState<StoryDocumentInput | null>(
    null,
  );
  const documentReady = shownSource === source;
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
    let cancelled = false;
    const report = (status: StoryPlayerStatus) =>
      onStatusChangeRef.current?.(status);
    // The new story renders while its images open; never under the old ones.
    setJpegLoaderEntries([]);
    setOmeLoaderEntries([]);
    setDicomIndexList([]);
    setImagesReady(false);
    setError(null);
    report({ status: "loading" });
    void loadStoryDocument(source, {
      onDocument: () => {
        if (!cancelled) setShownSource(source);
      },
    })
      .then((result) => {
        if (cancelled) return;
        setJpegLoaderEntries(result.jpegLoaderEntries);
        setOmeLoaderEntries(result.omeLoaderEntries);
        setDicomIndexList(result.dicomIndexList);
        setImagesReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        report({ status: "error", error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

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
