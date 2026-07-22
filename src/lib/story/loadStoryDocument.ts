import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import { resolveImageImportRole } from "@/lib/imaging/channelKind";
import { loadDicomWeb, parseDicomWeb } from "@/lib/imaging/dicom.js";
import type { DicomIndex, DicomLoader } from "@/lib/imaging/dicomIndex";
import { loadOmeLoaderForRole } from "@/lib/imaging/filesystem";
import { jpegLoaderEntriesFromImages } from "@/lib/imaging/loadJpegFromDocument";
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

async function buildLoaders(
  data: DocumentData,
  documentUrl: string,
): Promise<LoadStoryDocumentResult> {
  const jpegLoaderEntries = await jpegLoaderEntriesFromImages({
    images: data.images,
    channelGroups: data.channelGroups,
    documentUrl,
  });

  // Pool(0): main-thread decode — CDN IIFE workers hit the wrong /assets path.
  const omePool = data.images.some((im) => im.source?.kind === "url")
    ? new Pool(0)
    : null;
  const omeLoaderEntries: OmeLoaderEntry[] = [];
  const dicomIndexList: DicomIndex[] = [];
  const seenDicomSeries = new Set<string>();

  for (const im of data.images) {
    const source = im.source;
    if (!source) continue;

    if (source.kind === "url") {
      omeLoaderEntries.push({
        sourceImageId: im.id,
        loader: await loadOmeLoaderForRole(
          resolveImageImportRole({
            contentRole: im.contentRole,
            channels: im.channels ?? [],
          }),
          {
            kind: "url",
            url: source.url,
            ...(omePool ? { pool: omePool } : {}),
          },
        ),
      });
      continue;
    }

    if (source.kind === "dicomWeb") {
      if (seenDicomSeries.has(source.series)) continue;
      seenDicomSeries.add(source.series);
      const pyramids = await loadDicomWeb(source.series);
      dicomIndexList.push({
        series: source.series,
        modality: source.modality,
        pyramids,
        sourceImageId: im.id,
        loader: parseDicomWeb({
          pyramids,
          series: source.series,
          little_endian: true,
        }) as DicomLoader,
      });
    }
  }

  return { jpegLoaderEntries, omeLoaderEntries, dicomIndexList };
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

  const loaders = await buildLoaders(data, documentUrl);
  seedPlaybackSession(data);
  return loaders;
}
