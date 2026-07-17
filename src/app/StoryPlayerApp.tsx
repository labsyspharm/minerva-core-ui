import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Presentation } from "@/components/playback/Presentation";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import { ImageViewer } from "@/components/shared/viewer/ImageViewer";
import type { ConfigProps } from "@/lib/authoring/config";
import { resolveImageContentRole } from "@/lib/imaging/channelKind";
import { loadDicomWeb, parseDicomWeb } from "@/lib/imaging/dicom.js";
import type { DicomIndex, DicomLoader } from "@/lib/imaging/dicomIndex";
import { loadOmeLoaderForRole } from "@/lib/imaging/filesystem";
import {
  jpegLoaderEntriesFromImages,
  useSyncJpegChannelFolders,
} from "@/lib/imaging/loadJpegFromDocument";
import { useViewerLayers } from "@/lib/imaging/viewerLayers";
import { Pool } from "@/lib/imaging/workers/Pool";
import { useAppStore } from "@/lib/stores/appStore";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { validateDocumentData } from "@/lib/stores/validateDocument";

/** Stub registry — playback overlay reads channel state from the document store. */
const CDN_CHANNEL_CONFIG: ConfigProps = {
  ID: "cdn-player",
  ItemRegistry: {
    Name: "",
    ChannelGroups: [],
    Stories: [],
    SourceChannels: [],
    SourceDistributions: [],
  },
};

/**
 * CDN / exported-story player.
 * Uses the same {@link Presentation} shell as authoring “Story preview”
 * so waypoint UI and camera/group sync stay aligned.
 */
export function StoryPlayerApp(props: { documentUrl: string }) {
  const { documentUrl } = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jpegLoaderEntries, setJpegLoaderEntries] = useState<JpegLoaderEntry[]>(
    [],
  );
  const [omeLoaderEntries, setOmeLoaderEntries] = useState<OmeLoaderEntry[]>(
    [],
  );
  const [dicomIndexList, setDicomIndexList] = useState<DicomIndex[]>([]);

  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  /** Same empty→“Untitled story” ribbon logic as Presentation; do not invent a second name. */
  const title = useDocumentStore((s) => s.metadata.title ?? "");
  const sourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );

  const {
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
    overlayLayers,
    activeTool,
    dragState,
    hoverState,
    handleOverlayInteraction,
  } = useAppStore();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(documentUrl);
        if (!res.ok) {
          throw new Error(`Failed to load ${documentUrl} (${res.status})`);
        }
        const data = validateDocumentData(await res.json());
        const storyId = data.metadata.id ?? crypto.randomUUID();
        useDocumentStore.getState().hydrateFromDocument(data, storyId);
        const jpegEntries = await jpegLoaderEntriesFromImages({
          images: data.images,
          channelGroups: data.channelGroups,
          documentUrl,
        });
        // Pool(0) = main-thread geotiff decode. CDN IIFE workers resolve to
        // `/assets/...` on the story host (wrong); avoid spawning them here.
        const omePool = data.images.some((im) => im.source?.kind === "url")
          ? new Pool(0)
          : null;
        const omeEntries: OmeLoaderEntry[] = [];
        const dicomEntries: DicomIndex[] = [];
        const dicomSeriesSeen = new Set<string>();
        for (const im of data.images) {
          if (!im.source) continue;
          if (im.source.kind === "url") {
            const role =
              resolveImageContentRole({
                contentRole: im.contentRole,
                channels: im.channels ?? [],
              }) === "segmentation"
                ? "segmentation"
                : "intensity";
            const loader = await loadOmeLoaderForRole(role, {
              kind: "url",
              url: im.source.url,
              ...(omePool ? { pool: omePool } : {}),
            });
            omeEntries.push({ loader, sourceImageId: im.id });
            continue;
          }
          if (im.source.kind === "dicomWeb") {
            const { series, modality } = im.source;
            if (dicomSeriesSeen.has(series)) continue;
            dicomSeriesSeen.add(series);
            const pyramids = await loadDicomWeb(series);
            const loader = parseDicomWeb({
              pyramids,
              series,
              little_endian: true,
            }) as DicomLoader;
            dicomEntries.push({
              series,
              pyramids,
              modality,
              loader,
              sourceImageId: im.id,
            });
          }
        }
        if (cancelled) return;
        setJpegLoaderEntries(jpegEntries);
        setOmeLoaderEntries(omeEntries);
        setDicomIndexList(dicomEntries);
        const firstGroup = data.channelGroups[0];
        if (firstGroup) {
          useAppStore.getState().setActiveChannelGroup(firstGroup.id);
        }
        if (data.waypoints.length > 0) {
          useAppStore.getState().setActiveStory(0);
        }
        useAppStore.getState().setViewerReferenceImagePixelSize({
          width: data.images[0]?.sizeX ?? 0,
          height: data.images[0]?.sizeY ?? 0,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentUrl]);

  useSyncJpegChannelFolders(
    jpegLoaderEntries,
    images,
    activeChannelGroupId,
    channelGroups,
    setJpegLoaderEntries,
  );

  const { viewerConfig, loaderList, mainSettingsList, imageLayers } =
    useViewerLayers({
      dicomIndexList,
      omeLoaderEntries,
      jpegLoaderEntries,
      sourceChannels,
      channelGroups,
      activeChannelGroupId,
      channelVisibilities,
      channelGroupRowVisibilities,
    });

  if (loading) {
    return <PlayerStatus>Loading story…</PlayerStatus>;
  }
  if (error) {
    return <PlayerStatus>{error}</PlayerStatus>;
  }
  if (
    jpegLoaderEntries.length === 0 &&
    omeLoaderEntries.length === 0 &&
    dicomIndexList.length === 0
  ) {
    return (
      <PlayerStatus>
        No image sources in document.json. Re-export the story from Minerva
        Author.
      </PlayerStatus>
    );
  }

  return (
    <Presentation name={title} showDocumentTitle>
      <ChannelPanel
        authorMode={false}
        editable={false}
        noLoader={false}
        hiddenChannel={false}
        setHiddenChannel={() => {}}
        startExport={() => {}}
        channelItemElement="div"
        controlPanelElement="div"
        config={CDN_CHANNEL_CONFIG}
      >
        <ImageViewer
          omeLoaderEntries={omeLoaderEntries}
          imageLayers={imageLayers}
          mainSettingsList={mainSettingsList}
          loaderList={loaderList}
          viewerConfig={viewerConfig}
          overlayLayers={overlayLayers}
          activeTool={activeTool}
          isDragging={dragState.isDragging}
          hoveredShapeId={hoverState.hoveredShapeId}
          onOverlayInteraction={handleOverlayInteraction}
          groups={[]}
        />
      </ChannelPanel>
    </Presentation>
  );
}

function PlayerStatus(props: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100%",
        color: "#aaa",
        padding: 24,
        textAlign: "center",
        background: "#111",
      }}
    >
      {props.children}
    </div>
  );
}
