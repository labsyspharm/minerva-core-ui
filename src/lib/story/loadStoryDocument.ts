import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import { hydrateDocumentLoaders } from "@/lib/imaging/hydrateDocumentLoaders";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import { Pool } from "@/lib/imaging/workers/Pool";
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
  app.setViewerReferenceImagePixelSize({
    width: data.images[0]?.sizeX ?? 0,
    height: data.images[0]?.sizeY ?? 0,
  });
}

/** Fetch, hydrate stores, and build CDN-safe loaders for a published story. */
export async function loadStoryDocument(
  documentUrl: string,
): Promise<LoadStoryDocumentResult> {
  const res = await fetch(documentUrl);
  if (!res.ok) {
    throw new Error(`Failed to load ${documentUrl} (${res.status})`);
  }

  const data = validateDocumentData(await res.json());
  useDocumentStore
    .getState()
    .hydrateFromDocument(data, data.metadata.id ?? crypto.randomUUID());

  // Pool(0): main-thread decode — CDN IIFE workers hit the wrong /assets path.
  const omePool = data.images.some((im) => im.source?.kind === "url")
    ? new Pool(0)
    : null;
  const { jpegLoaderEntries, omeLoaderEntries, dicomIndexList } =
    await hydrateDocumentLoaders(data.images, {
      channelGroups: data.channelGroups,
      documentUrl,
      pool: omePool,
      includeLocal: false,
    });

  seedPlaybackSession(data);
  return { jpegLoaderEntries, omeLoaderEntries, dicomIndexList };
}
