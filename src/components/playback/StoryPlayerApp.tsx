import { useEffect, useState } from "react";
import { Presentation } from "@/components/playback/Presentation";
import { StoryPlaybackView } from "@/components/playback/StoryPlaybackView";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import {
  type LoadStoryDocumentResult,
  loadStoryDocument,
} from "@/lib/story/loadStoryDocument";
import styles from "./StoryPlayerApp.module.css";

/** CDN story player. Authoring preview reuses the Presentation ribbon and nav. */
export function StoryPlayerApp({
  documentUrl,
  onEdit,
}: {
  documentUrl: string;
  /** Info-panel "Edit this story": switch this page to the author app. */
  onEdit?: () => Promise<void>;
}) {
  const [documentReady, setDocumentReady] = useState(false);
  /** First images handed to the viewer; others may still be opening. */
  const [imagesShown, setImagesShown] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jpegLoaderEntries, setJpegLoaderEntries] = useState<JpegLoaderEntry[]>(
    [],
  );
  const [omeLoaderEntries, setOmeLoaderEntries] = useState<OmeLoaderEntry[]>(
    [],
  );
  const [dicomIndexList, setDicomIndexList] = useState<DicomIndex[]>([]);

  useEffect(() => {
    let cancelled = false;
    let jpegShown = false;
    setDocumentReady(false);
    setImagesShown(false);
    setImagesReady(false);
    setError(null);
    const show = (ready: LoadStoryDocumentResult) => {
      if (cancelled) return;
      // JPEG entries are complete from the first call, and the viewer swaps
      // their folders afterwards: setting them again would undo that.
      if (!jpegShown) setJpegLoaderEntries(ready.jpegLoaderEntries);
      jpegShown = true;
      setOmeLoaderEntries(ready.omeLoaderEntries);
      setDicomIndexList(ready.dicomIndexList);
      setImagesShown(true);
    };
    void loadStoryDocument(documentUrl, {
      onDocument: () => {
        if (!cancelled) setDocumentReady(true);
      },
      onImages: show,
    })
      .then((result) => {
        if (cancelled) return;
        show(result);
        setImagesReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentUrl]);

  const sourceCount =
    jpegLoaderEntries.length + omeLoaderEntries.length + dicomIndexList.length;

  if (error) return <div className={styles.status}>{error}</div>;
  if (!documentReady)
    return <div className={styles.status}>Loading story…</div>;
  if (imagesReady && sourceCount === 0) {
    return (
      <div className={styles.status}>
        No image sources in document.json. Re-export the story from Minerva
        Author.
      </div>
    );
  }

  return (
    <Presentation showDocumentTitle>
      <StoryPlaybackView
        jpegLoaderEntries={jpegLoaderEntries}
        setJpegLoaderEntries={setJpegLoaderEntries}
        omeLoaderEntries={omeLoaderEntries}
        dicomIndexList={dicomIndexList}
        imagesLoading={!imagesShown}
        onEdit={onEdit}
      />
    </Presentation>
  );
}
