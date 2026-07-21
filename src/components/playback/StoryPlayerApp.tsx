import { useEffect, useState } from "react";
import styled from "styled-components";
import { loadStoryDocument } from "@/components/playback/loadStoryDocument";
import { Presentation } from "@/components/playback/Presentation";
import { StoryPlaybackView } from "@/components/playback/StoryPlaybackView";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";

/**
 * CDN story player. Same Presentation → StoryPlaybackView tree as authoring
 * Story preview (preview adds only the Back ribbon).
 */
export function StoryPlayerApp({ documentUrl }: { documentUrl: string }) {
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError(null);
    void loadStoryDocument(documentUrl)
      .then((result) => {
        if (cancelled) return;
        setJpegLoaderEntries(result.jpegLoaderEntries);
        setOmeLoaderEntries(result.omeLoaderEntries);
        setDicomIndexList(result.dicomIndexList);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentUrl]);

  const sourceCount =
    jpegLoaderEntries.length + omeLoaderEntries.length + dicomIndexList.length;

  if (loading) return <Status>Loading story…</Status>;
  if (error) return <Status>{error}</Status>;
  if (sourceCount === 0) {
    return (
      <Status>
        No image sources in document.json. Re-export the story from Minerva
        Author.
      </Status>
    );
  }

  return (
    <Presentation showDocumentTitle>
      <StoryPlaybackView
        jpegLoaderEntries={jpegLoaderEntries}
        setJpegLoaderEntries={setJpegLoaderEntries}
        omeLoaderEntries={omeLoaderEntries}
        dicomIndexList={dicomIndexList}
      />
    </Presentation>
  );
}

const Status = styled.div`
  display: grid;
  place-items: center;
  height: 100%;
  color: #aaa;
  padding: 24px;
  text-align: center;
  background: #111;
`;
