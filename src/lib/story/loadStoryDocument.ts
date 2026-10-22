import { hydrateFeatureTables } from "@/lib/featureTable";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import { hydrateDocumentLoaders } from "@/lib/imaging/hydrateDocumentLoaders";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import { sharedOmeDecodePool } from "@/lib/imaging/omeDecodePool";
import { worldFrameFromPixelCounts } from "@/lib/imaging/worldFrame";
import { useAppStore } from "@/lib/stores/appStore";
import type { DocumentData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { validateDocumentData } from "@/lib/stores/validateDocument";

export type LoadStoryDocumentResult = {
  jpegLoaderEntries: JpegLoaderEntry[];
  omeLoaderEntries: OmeLoaderEntry[];
  dicomIndexList: DicomIndex[];
};

function seedPlaybackSession(data: DocumentData) {
  const app = useAppStore.getState();
  const firstGroup = data.channelGroups[0];
  if (firstGroup) app.setActiveChannelGroup(firstGroup.id);
  if (data.waypoints.length > 0) app.setActiveStory(0);
  app.setViewerWorldFrame(
    worldFrameFromPixelCounts(
      data.images[0]?.sizeX ?? 0,
      data.images[0]?.sizeY ?? 0,
    ),
  );
}

/** Fetch and validate a story's `document.json`. */
export async function fetchStoryDocument(
  documentUrl: string,
): Promise<DocumentData> {
  const res = await fetch(documentUrl);
  if (!res.ok) {
    throw new Error(`Failed to load ${documentUrl} (${res.status})`);
  }
  return validateDocumentData(await res.json());
}

/** Fetch, hydrate stores, and build CDN-safe loaders for a published story. */
export async function loadStoryDocument(
  documentUrl: string,
  opts?: { onDocument?: () => void },
): Promise<LoadStoryDocumentResult> {
  const data = await fetchStoryDocument(documentUrl);
  useDocumentStore
    .getState()
    .hydrateFromDocument(data, data.metadata.id ?? crypto.randomUUID());
  seedPlaybackSession(data);
  // Groups and waypoints are ready. The caller can draw them while image
  // metadata is still opening.
  opts?.onDocument?.();
  // Not awaited: masks with a table join once their Parquet sidecar is ingested.
  void hydrateFeatureTables(data.featureTables, true, { documentUrl }).catch(
    (e) => console.error("[featureTable] player hydrate failed", e),
  );

  // The CDN bundle inlines decoder workers as blob URLs (vite.bundle.config).
  const omePool = data.images.some((im) => im.source?.kind === "url")
    ? sharedOmeDecodePool()
    : null;
  const { jpegLoaderEntries, omeLoaderEntries, dicomIndexList } =
    await hydrateDocumentLoaders(data.images, {
      channelGroups: data.channelGroups,
      documentUrl,
      pool: omePool,
      includeLocal: false,
      imageSource: data.metadata.imageSource,
    });

  return { jpegLoaderEntries, omeLoaderEntries, dicomIndexList };
}
