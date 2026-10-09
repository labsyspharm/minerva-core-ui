import { useEffect, useState } from "react";
import { Presentation } from "@/components/playback/Presentation";
import { StoryPlaybackView } from "@/components/playback/StoryPlaybackView";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import { loadStoryDocument } from "@/lib/story/loadStoryDocument";
import styles from "./StoryPlayerApp.module.css";

/** CDN story player. Authoring preview reuses the Presentation ribbon and nav. */
export function StoryPlayerApp({ documentUrl }: { documentUrl: string }) {
  const [documentReady, setDocumentReady] = useState(false);
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
    setDocumentReady(false);
    setImagesReady(false);
    setError(null);
    void loadStoryDocument(documentUrl, {
      onDocument: () => {
        if (!cancelled) setDocumentReady(true);
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
        imagesLoading={!imagesReady}
      />
    </Presentation>
  );
}
