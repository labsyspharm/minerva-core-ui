import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import type { FormEventHandler } from "react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { StoryTitleBar } from "@/components/authoring/StoryTitleBar";
import { MinervaLibraryPage } from "@/components/library/MinervaLibraryPage";
import { PlaybackRouter } from "@/components/playback/PlaybackRouter";
import { StoryReturnToLibraryBridge } from "@/components/StoryReturnToLibraryBridge";
import { BuildStamp } from "@/components/shared/BuildStamp";
import { FileHandler } from "@/components/shared/FileHandler";
import type { LoadedSourceSummary, ValidObj } from "@/components/shared/Upload";
import { Upload } from "@/components/shared/Upload";
import {
  ImageViewer,
  type JpegLoaderEntry,
  type LoaderList,
  type MainSettings,
  type OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import type {
  ConfigSourceDistribution,
  ConfigWaypoint,
} from "@/lib/authoring/config";
import { extractChannels, extractDistributions } from "@/lib/authoring/config";
import {
  createTileLayers,
  loadDicomWeb,
  parseDicomWeb,
} from "@/lib/imaging/dicom.js";
import type { DicomIndex, DicomLoader } from "@/lib/imaging/dicomIndex";
import {
  findFile,
  hasDirectoryPickerAccess,
  hasFilesystemAuthorSupport,
  isPersistableFileHandle,
  toLoader,
  toLoaderFromUrl,
} from "@/lib/imaging/filesystem";
import {
  clearOmeHistogramCache,
  ensureOmeHistogramDistributions,
  mergeHistogramsIntoSourceChannelsByChannelId,
} from "@/lib/imaging/histogramLazy";
import { createJpegLayers, loadJpeg } from "@/lib/imaging/jpeg.js";
import { type Loader, toSettings } from "@/lib/imaging/viv";
import { Pool } from "@/lib/imaging/workers/Pool";
import type { ConfigGroup, ExhibitConfig } from "@/lib/legacy/exhibit";
import { readConfig } from "@/lib/legacy/exhibit";
import { bootstrapStoryPersistence } from "@/lib/persistence/bootstrap";
import { getFileHandle, putFileHandle } from "@/lib/persistence/fileHandles";
import { imageHandleStorageKey } from "@/lib/persistence/imageHandles";
import { useStoryAutoSave } from "@/lib/persistence/useAutoSave";
import { applyOmeRoisFromLoaderToFirstWaypoint } from "@/lib/shapes/applyOmeRoisToDocument";
import { getOmeTiffImageDescriptionOmeXml } from "@/lib/shapes/omeTiffOmeDescription";
import {
  type ChannelRendering,
  effectiveReferenceImagePixelSize,
  useAppStore,
} from "@/lib/stores/appStore";
import type { Image } from "@/lib/stores/documentSchema";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import {
  documentShapes,
  documentSourceChannels,
  documentWaypoints,
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import {
  applyLoaderPixelSizeToImage,
  applySourceChannelsToImages,
  type LegacyExhibitWaypoint,
  migrateLegacyWaypointShapes,
  type StoryShape,
  setImageSource,
  waypointToConfigWaypoint,
} from "@/lib/stores/storeUtils";
import { isOpts, validate } from "@/lib/util/validate";
import { buildImageViewerSignature } from "@/lib/viewer/imageViewerSignature";
import { ensureDefaultWaypointForImageImport } from "@/lib/waypoints/ensureDefaultWaypointForImageImport";
import { normalizeWaypointToBounds } from "@/lib/waypoints/waypoint";
import {
  parsePreferredStoryIdFromLocation,
  rootRouteApi,
  StoryIdUrlSync,
} from "@/router/appRouter";

type Props = {
  /** Seed stories; may include legacy `Arrows` / `Overlays` until the image loads and migration runs. */
  configWaypoints: LegacyExhibitWaypoint[];
  exhibit_config: ExhibitConfig;
  /**
   * When set, auto-loads this remote OME-TIFF on mount (and `hasDemo` loading state).
   * Omit for `pnpm run dev` — pass only from `pnpm run demo` in `index.tsx`.
   */
  demo_dicom_web?: boolean;
  demo_jpeg?: boolean;
  demo_url?: string;
  handleKeys: string[];
  /** PWA “Open with” / `launchQueue` (needs manifest `file_handlers`). */
  useLaunchQueue?: boolean;
};

/** Deep copy so `index.tsx` arrays are never mutated; session edits live in React config + Zustand. */
const cloneConfigWaypoints = (
  stories: LegacyExhibitWaypoint[],
): LegacyExhibitWaypoint[] => {
  if (typeof structuredClone === "function") {
    return structuredClone(stories) as LegacyExhibitWaypoint[];
  }
  return JSON.parse(JSON.stringify(stories)) as LegacyExhibitWaypoint[];
};

const Wrapper = styled.div`
  height: 100%;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const Full = styled.div`
  flex: 1;
  min-height: 0;
  max-height: 100vh;
  overflow: hidden;
`;

const Scrollable = styled.div`
  z-index: 2;
  grid-column: 2;
  grid-row: 1 / -1;
  overflow-y: scroll;
  border-radius: 12px;
  outline: 1px solid var(--theme-glass-edge);
  background-color: var(--dark-main-glass);
  font-size: 20px;
  padding: 5vh;
  margin: 5vh;
`;

const RetrievingWrapper = styled.div`
  height: 100%;
  display: grid;
  grid-template-columns: 1fr; 
  grid-template-rows: 1fr; 
  justify-items: center;
  align-items: center;
`;

const StoryPersistenceRoot = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const preferred = parsePreferredStoryIdFromLocation();
    void bootstrapStoryPersistence(preferred).then(() => setReady(true));
  }, []);
  /** Minerva Library mounts without `Content` (no FileHandler); the HTML shell loader must still be cleared. */
  useEffect(() => {
    if (!ready) return;
    document.getElementById("global-loader")?.remove();
  }, [ready]);
  if (!ready) {
    return <RetrievingWrapper>Loading stories…</RetrievingWrapper>;
  }
  return (
    <>
      <StoryIdUrlSync />
      {children}
    </>
  );
};

const getDistributions = async (sourceChannels, loader) => {
  const sourceDistributionMap = await extractDistributions(loader);
  const SourceDistributions = [...sourceDistributionMap.values()];
  const SourceChannelsWithDist = sourceChannels.map((sourceChannel) => ({
    ...sourceChannel,
    sourceDistribution: sourceDistributionMap.get(sourceChannel.index),
  }));
  return { SourceChannelsWithDist, SourceDistributions };
};

const readWriteHydrate = { mode: "readwrite" } as const;

async function hydrateFilePermission(handle: Handle.File): Promise<boolean> {
  const ok = (p: PermissionState) => p === "granted";
  return (
    ok(await handle.queryPermission(readWriteHydrate)) ||
    ok(await handle.requestPermission(readWriteHydrate))
  );
}

/** Rebuild Viv / DICOM loaders from persisted image rows (after Dexie load / refresh). */
async function hydrateLoadersFromImages(images: Image[]): Promise<{
  jpegLoaderEntries: JpegLoaderEntry[];
  omeLoaderEntries: OmeLoaderEntry[];
  dicomIndexList: DicomIndex[];
}> {
  const jpegLoaderEntries: JpegLoaderEntry[] = [];
  const omeLoaderEntries: OmeLoaderEntry[] = [];
  const dicomIndexList: DicomIndex[] = [];
  const pool = new Pool();
  const dicomSeriesSeen = new Set<string>();

  for (const im of images) {
    if (!im.source) continue;
    if ("url" in im.source && im.source.url === "jpeg-test") {
      // TODO
      const imageHeight = 4096; //TODO
      const imageWidth = 4096; //TODO
      const imagePath = "jpeg-test";
      const loader = loadJpeg({
        imagePath,
        imageHeight,
        imageWidth,
      });
      jpegLoaderEntries.push({ loader, sourceImageId: im.id });
      break;
    }
    switch (im.source.kind) {
      case "url": {
        const loader = await toLoaderFromUrl(im.source.url, pool);
        omeLoaderEntries.push({ loader, sourceImageId: im.id });
        break;
      }
      case "local": {
        const handle = await getFileHandle(im.source.handleKey);
        if (!handle) break;
        if (!(await hydrateFilePermission(handle))) break;
        if (!(await findFile({ handle }))) break;
        const file = await handle.getFile();
        const loader = await toLoader({
          handle,
          in_f: file.name,
          pool,
        });
        omeLoaderEntries.push({ loader, sourceImageId: im.id });
        break;
      }
      case "dicomWeb": {
        const { series, modality } = im.source;
        if (dicomSeriesSeen.has(series)) break;
        dicomSeriesSeen.add(series);
        const pyramids = await loadDicomWeb(series);
        const loader = parseDicomWeb({
          pyramids,
          series,
          little_endian: true,
        }) as DicomLoader;
        dicomIndexList.push({
          series,
          pyramids,
          modality,
          loader,
          sourceImageId: "", // TODO
        });
        break;
      }
    }
  }

  return { jpegLoaderEntries, omeLoaderEntries, dicomIndexList };
}

const APP_TAB_TITLE_PREFIX =
  import.meta.env.MODE === "demo" ? "Minerva 2.0 Demo" : "Minerva";

/** Fold {@link ChannelRendering} into Viv settings without touching the document store. */
function applyChannelRendering<S extends MainSettings>(
  settings: S,
  live: ChannelRendering | null,
  activeChannelGroupId: string | null,
  channelGroups: ChannelGroup[],
): S {
  if (!live) return settings;
  const active =
    channelGroups.find((g) => g.id === activeChannelGroupId) ??
    channelGroups[0];
  if (!active || active.id !== live.groupId) return settings;
  const idx = active.channels.findIndex((c) => c.id === live.channelId);
  if (idx < 0) return settings;
  if (live.kind === "contrast") {
    if (idx >= settings.contrastLimits.length) return settings;
    const lo = Math.round(live.lower);
    const hi = Math.round(live.upper);
    const contrastLimits = settings.contrastLimits.map((pair, i) =>
      i === idx
        ? ([lo, hi] as [number, number])
        : ([pair[0], pair[1]] as [number, number]),
    );
    return { ...settings, contrastLimits };
  }
  if (idx >= settings.colors.length) return settings;
  const r = Math.round(Math.max(0, Math.min(255, live.r)));
  const g = Math.round(Math.max(0, Math.min(255, live.g)));
  const b = Math.round(Math.max(0, Math.min(255, live.b)));
  const colors = settings.colors.map((triple, i) =>
    i === idx
      ? ([r, g, b] as [number, number, number])
      : ([triple[0], triple[1], triple[2]] as [number, number, number]),
  );
  return { ...settings, colors };
}

const toSettingsInternal = (
  loader,
  modality,
  groups,
  activeChannelGroupId,
  channelVisibilities,
  toSettings,
  loaderSourceImageId?: string,
) => {
  if (loader === null || !groups) {
    return toSettings(
      activeChannelGroupId,
      modality,
      undefined,
      channelVisibilities,
      loaderSourceImageId,
    );
  }
  return toSettings(
    activeChannelGroupId,
    modality,
    loader,
    channelVisibilities,
    loaderSourceImageId,
  );
};

const Content = (props: Props) => {
  const { handleKeys, useLaunchQueue = false } = props;
  /** Remote demo image / DICOM bootstrap from `index.tsx` (`pnpm run demo` only). */
  const hasDemo = !!props.demo_dicom_web || !!props.demo_url;
  useStoryAutoSave();
  const storyTitleForTab = useDocumentStore((s) => s.metadata.title ?? "");
  React.useEffect(() => {
    const label = storyTitleForTab.trim()
      ? storyTitleForTab.trim()
      : "Untitled story";
    document.title = `${APP_TAB_TITLE_PREFIX} | ${label}`;
  }, [storyTitleForTab]);
  const viewerImageLayersLoaded = useAppStore((s) => s.viewerImageLayersLoaded);
  const prevImageLayersLoadedRef = React.useRef(false);
  React.useEffect(() => {
    const wasLoaded = prevImageLayersLoadedRef.current;
    prevImageLayersLoadedRef.current = viewerImageLayersLoaded;
    if (wasLoaded || !viewerImageLayersLoaded) return;
    let cancelled = false;
    let id2: number | undefined;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const s = useAppStore.getState();
        if (!s.viewerImageLayersLoaded) return;
        const t = s.captureSquareViewportThumbnail();
        if (!t) return;
        const doc = useDocumentStore.getState();
        const idx = s.activeStoryIndex;
        if (idx === null || idx < 0 || idx >= doc.waypoints.length) return;
        const wp = doc.waypoints[idx];
        if (wp?.thumbnail && wp.thumbnail.length > 0) return;
        s.updateStory(idx, { ThumbnailDataUrl: t });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
      if (id2 !== undefined) cancelAnimationFrame(id2);
    };
  }, [viewerImageLayersLoaded]);
  const activeStoryId = useDocumentStore((s) => s.activeStoryId);
  const namespacedHandleKeys = React.useMemo(
    () =>
      handleKeys.map((k) =>
        activeStoryId ? `story:${activeStoryId}:${k}` : k,
      ),
    [handleKeys, activeStoryId],
  );
  const firstExhibit = readConfig(props.exhibit_config);
  const [exhibit] = useState(firstExhibit);
  const [jpegLoaderEntries, setJpegLoaderEntries] = useState<JpegLoaderEntry[]>(
    [],
  );
  const [omeLoaderEntries, setOmeLoaderEntries] = useState<OmeLoaderEntry[]>(
    [],
  );
  const [dicomIndexList, setDicomIndexList] = useState([] as DicomIndex[]);
  const {
    setActiveChannelGroup,
    activeChannelGroupId,
    channelVisibilities,
    channelRendering,
  } = useAppStore();
  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setImages = useDocumentStore((s) => s.setImages);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const documentChannelsRef = React.useRef({ channelGroups, sourceChannels });
  documentChannelsRef.current = { channelGroups, sourceChannels };
  /** One-time seed from exhibit props; document store is authoritative after hydration. */
  const seedStoriesRef = React.useRef(
    cloneConfigWaypoints(props.configWaypoints),
  );
  const seedShapesRef = React.useRef<StoryShape[]>([]);

  // UI State (from Index)
  const [ioState, setIoState] = useState("IDLE");
  const [directory_handle, setDirectoryHandle] = useState(
    null as Handle.Dir | null,
  );
  const [presenting, setPresenting] = useState(false);
  const checkWindow = React.useCallback(() => window.innerWidth > 600, []);
  const [hiddenChannel, setHideChannel] = useState(() => !checkWindow());

  const handleResize = React.useCallback(() => {
    if (!checkWindow()) {
      setHideChannel(true);
    }
  }, [checkWindow]);

  React.useEffect(() => {
    // sync once on mount (and when handleResize changes)
    handleResize();

    window.addEventListener("resize", handleResize, false);
    return () => {
      window.removeEventListener("resize", handleResize, false);
    };
  }, [handleResize]);

  const startExport = async () => {
    if (!hasDirectoryPickerAccess()) {
      window.alert(
        "Export to a folder needs the File System Access API (directory picker). Try Chrome or Edge, or use “OME-TIFF URL” workflows in other browsers.",
      );
      return;
    }
    const dirHandle = await showDirectoryPicker();
    setDirectoryHandle(dirHandle);
    setIoState("EXPORTING");
  };
  const stopExport = () => setIoState("IDLE");

  /** After reload, app store resets while channel groups persist — select first group and sync visibilities. */
  useEffect(() => {
    if (channelGroups.length === 0) return;
    const active = useAppStore.getState().activeChannelGroupId;
    if (active != null && channelGroups.some((g) => g.id === active)) return;
    setActiveChannelGroup(channelGroups[0].id);
  }, [channelGroups, setActiveChannelGroup]);

  const selectFirstChannelGroup = useCallback(
    (groups: typeof channelGroups) => {
      if (groups.length > 0) {
        setActiveChannelGroup(groups[0].id);
      }
    },
    [setActiveChannelGroup],
  );

  const [fileName, setFileName] = useState("");
  /** Full URL of the last OME-TIFF-URL load (Images tab label); cleared for local/DICOM. */
  const [lastOmeTiffUrl, setLastOmeTiffUrl] = useState<string | null>(null);
  /** Bumps on each OME-TIFF-URL load so a stale loader cannot commit after a newer URL starts. */
  const omeTiffUrlLoadGenerationRef = React.useRef(0);
  const jpegUrlLoadGenerationRef = React.useRef(0);
  const [importRevision, setImportRevision] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(hasDemo);
  const showSquareViewportOverlay = useAppStore(
    (state) => state.showSquareViewportOverlay,
  );
  const setShowSquareViewportOverlay = useAppStore(
    (state) => state.setShowSquareViewportOverlay,
  );
  const viewerViewportSize = useAppStore((state) => state.viewerViewportSize);
  const docImageWidth = useDocumentStore(
    (state) => state.images[0]?.sizeX ?? 0,
  );
  const docImageHeight = useDocumentStore(
    (state) => state.images[0]?.sizeY ?? 0,
  );
  const viewerRefSize = useAppStore((s) => s.viewerReferenceImagePixelSize);
  const { width: imageWidth, height: imageHeight } =
    effectiveReferenceImagePixelSize(
      viewerRefSize,
      docImageWidth,
      docImageHeight,
    );

  useEffect(() => {
    const enabledFromConfig =
      localStorage.getItem("square_viewport_overlay") === "1";
    if (enabledFromConfig) {
      setShowSquareViewportOverlay(true);
    }
  }, [setShowSquareViewportOverlay]);

  const onStartOmeTiff = async (in_f: string, handles: Handle.File[]) => {
    if (handles.length === 0) return;
    clearOmeHistogramCache();
    setDicomIndexList([]);
    setLastOmeTiffUrl(null);
    // Bundled CRC channel-group definitions in index.tsx apply only to the remote
    // demo URL — never for local / “Open with” OME files.
    const relevant_groups = [] as ConfigGroup[];
    const doc = useDocumentStore.getState();
    let nextImages = [...doc.images];
    let registry = {
      SourceChannels: [] as Channel[],
      ChannelGroups: [] as ChannelGroup[],
    };
    const entries: OmeLoaderEntry[] = [];

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const loader = await toLoader({
        handle,
        in_f: i === 0 ? in_f : handle.name,
        pool: new Pool(),
      });
      const sourceImageId = crypto.randomUUID();
      const { SourceChannels: sc, ChannelGroups: gr } = extractChannels(
        loader,
        "Colorimetric",
        relevant_groups,
        sourceImageId,
      );
      nextImages = applySourceChannelsToImages(nextImages, sc);
      nextImages = applyLoaderPixelSizeToImage(
        nextImages,
        sourceImageId,
        loader,
      );
      registry = {
        SourceChannels: [...registry.SourceChannels, ...sc],
        ChannelGroups: [...registry.ChannelGroups, ...gr],
      };
      entries.push({ loader, sourceImageId });
    }

    const storyId = useDocumentStore.getState().activeStoryId;
    if (storyId) {
      for (let i = 0; i < entries.length; i++) {
        const { sourceImageId } = entries[i];
        const handle = handles[i];
        if (!isPersistableFileHandle(handle)) continue;
        const key = imageHandleStorageKey(storyId, sourceImageId);
        await putFileHandle(key, handle);
        nextImages = setImageSource(nextImages, sourceImageId, {
          kind: "local",
          handleKey: key,
        });
      }
    }

    const { SourceChannels, ChannelGroups } = registry;
    setImages(nextImages);
    setChannelGroups(ChannelGroups);
    selectFirstChannelGroup(ChannelGroups);
    ensureDefaultWaypointForImageImport();
    setOmeLoaderEntries(entries);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const handle = handles[i];
      if (!entry || !handle) continue;
      const { loader } = entry;
      const file = await handle.getFile();
      const omeXml = await getOmeTiffImageDescriptionOmeXml(file);
      applyOmeRoisFromLoaderToFirstWaypoint(loader, omeXml);
    }
    setFileName(
      handles.length === 1
        ? in_f
        : handles.map((h) => h.name).join(", ") || in_f,
    );
  };

  const onStartJpegUrl = async (url: string) => {
    jpegUrlLoadGenerationRef.current += 1;
    const loadGeneration = jpegUrlLoadGenerationRef.current;
    setDicomIndexList([]);
    setOmeLoaderEntries([]);
    // TODO
    const relevant_groups = props.exhibit_config.Groups;
    const sourceImageId = crypto.randomUUID();
    const imageHeight = 4096; //TODO
    const imageWidth = 4096; //TODO
    const imagePath = "jpeg-test";
    const loader = loadJpeg({
      imagePath,
      imageHeight,
      imageWidth,
    });
    const { SourceChannels, ChannelGroups } = extractChannels(
      loader,
      "Colorimetric",
      relevant_groups,
      sourceImageId,
    );
    const doc = useDocumentStore.getState();
    let nextImages = applySourceChannelsToImages(doc.images, SourceChannels);
    nextImages = applyLoaderPixelSizeToImage(nextImages, sourceImageId, loader);
    nextImages = setImageSource(nextImages, sourceImageId, {
      kind: "url",
      url,
    });
    setImages(nextImages);
    setChannelGroups(ChannelGroups);
    selectFirstChannelGroup(ChannelGroups);
    ensureDefaultWaypointForImageImport();
    setJpegLoaderEntries([{ loader, sourceImageId }]);
  };

  const onStartOmeTiffUrl = async (url: string) => {
    omeTiffUrlLoadGenerationRef.current += 1;
    const loadGeneration = omeTiffUrlLoadGenerationRef.current;
    clearOmeHistogramCache();
    setDicomIndexList([]);
    const loader = await toLoaderFromUrl(url, new Pool());
    if (loadGeneration !== omeTiffUrlLoadGenerationRef.current) {
      return;
    }
    // index.tsx CRC templates are for the bundled demo image only, not arbitrary URLs.
    const relevant_groups =
      props.demo_url != null && url === props.demo_url
        ? (props.exhibit_config.Groups ?? []).filter(
            ({ Image }) => Image.Method === "Colorimetric",
          )
        : ([] as ConfigGroup[]);
    const sourceImageId = crypto.randomUUID();
    const { SourceChannels, ChannelGroups } = extractChannels(
      loader,
      "Colorimetric",
      relevant_groups,
      sourceImageId,
    );
    const doc = useDocumentStore.getState();
    let nextImages = applySourceChannelsToImages(doc.images, SourceChannels);
    nextImages = applyLoaderPixelSizeToImage(nextImages, sourceImageId, loader);
    nextImages = setImageSource(nextImages, sourceImageId, {
      kind: "url",
      url,
    });
    setImages(nextImages);
    setChannelGroups(ChannelGroups);
    selectFirstChannelGroup(ChannelGroups);
    ensureDefaultWaypointForImageImport();
    setOmeLoaderEntries([{ loader, sourceImageId }]);
    const omeXml = await getOmeTiffImageDescriptionOmeXml(url);
    applyOmeRoisFromLoaderToFirstWaypoint(loader, omeXml);
    setLastOmeTiffUrl(url);
    setFileName(url.split("/").pop() || "remote.ome.tif");
  };

  const onStartOmeTiffRef = React.useRef(onStartOmeTiff);
  onStartOmeTiffRef.current = onStartOmeTiff;

  /** Shared by FileHandler: auto-restore on mount, “Use recent”, and PWA launch — same rules. */
  const onRestoredOmeHandles = React.useCallback(
    async (restored: Handle.File[]) => {
      if (restored.length === 0) {
        document.getElementById("global-loader")?.remove();
        return;
      }
      // Story/waypoints/shapes come from Dexie (bootstrap already ran). Do not call
      // setStories, document setShapes/setWaypoints, or resetDocument — only transient
      // viewer state + OME reconnect below.
      useAppStore.getState().clearOverlayLayers();
      const file = await restored[0].getFile();
      await onStartOmeTiffRef.current(file.name, restored);
      setImportRevision((r) => r + 1);
      document.getElementById("global-loader")?.remove();
    },
    [],
  );

  const onStart = async (
    imagePropList: [string, string, string][],
    handles: Handle.File[],
  ) => {
    if (imagePropList.length === 0) {
      return;
    }
    // handle hard-coded channels for dicom-web demo
    const dicomPropList = imagePropList
      .filter(([_series, _modality, type]) => type === "DICOM-WEB")
      .map(([series, modality]) => [series, modality]) as [string, string][];
    // handle only one ome-tiff image ( TODO support more )
    const omeTiffPropList = imagePropList
      .filter(([_path, _modality, type]) => type === "OME-TIFF")
      .map(([path]) => [path]);
    // JPEG
    const jpegUrlList = imagePropList
      .filter(([_url, _modality, type]) => type === "JPEG-URL")
      .map(([url]) => url);
    // OME-TIFF loaded from a remote URL
    const omeTiffUrlList = imagePropList
      .filter(([_url, _modality, type]) => type === "OME-TIFF-URL")
      .map(([url]) => url);
    const willLoad =
      dicomPropList.length > 0 ||
      (omeTiffPropList.length > 0 && handles.length > 0) ||
      omeTiffUrlList.length > 0 ||
      jpegUrlList.length > 0;
    if (!willLoad) return;

    const t0 = performance.now();
    console.log("[minerva] onStart: will load, setting loading state");
    // Switch to waypoints tab and show loading immediately.
    setImportRevision((r) => r + 1);
    setIsLoadingImage(true);
    try {
      if (dicomPropList.length > 0) {
        const t1 = performance.now();
        await onStartDicomWeb(
          dicomPropList,
          props.demo_dicom_web ? (props.exhibit_config.Groups ?? []) : [],
        );
        console.log(
          `[minerva] onStartDicomWeb: ${(performance.now() - t1).toFixed(0)}ms`,
        );
      }
      if (omeTiffPropList.length > 0 && handles.length > 0) {
        const t1 = performance.now();
        await onStartOmeTiff(omeTiffPropList[0][0], handles);
        console.log(
          `[minerva] onStartOmeTiff: ${(performance.now() - t1).toFixed(0)}ms`,
        );
      }
      if (jpegUrlList.length > 0) {
        const t1 = performance.now();
        await onStartJpegUrl(jpegUrlList[0]);
        console.log(
          `[minerva] onStartOmeTiffUrl: ${(performance.now() - t1).toFixed(0)}ms`,
        );
      }
      if (omeTiffUrlList.length > 0) {
        const t1 = performance.now();
        await onStartOmeTiffUrl(omeTiffUrlList[0]);
        console.log(
          `[minerva] onStartOmeTiffUrl: ${(performance.now() - t1).toFixed(0)}ms`,
        );
      }
    } finally {
      console.log(
        `[minerva] total load: ${(performance.now() - t0).toFixed(0)}ms`,
      );
      setIsLoadingImage(false);
      document.getElementById("global-loader")?.remove();
    }
  };

  // Dicom Web derived state
  const onStartDicomWeb = async (
    imagePropList: [string, string][],
    groups: ConfigGroup[],
  ) => {
    clearOmeHistogramCache();
    setLastOmeTiffUrl(null);
    console.log(
      "[minerva] dicom: fetching pyramids for",
      imagePropList.length,
      "series",
    );
    const indexList = await Promise.all(
      imagePropList.map(async ([series, modality]) => {
        const t1 = performance.now();
        const pyramids = await loadDicomWeb(series);
        console.log(
          `[minerva] dicom: loadDicomWeb ${modality}: ${(performance.now() - t1).toFixed(0)}ms`,
        );
        const loader = parseDicomWeb({
          pyramids,
          series,
          little_endian: true,
        }) as DicomLoader;
        return {
          series,
          pyramids,
          modality,
          loader,
          sourceImageId: "", // TODO
        };
      }),
    );
    console.log("[minerva] dicom: all pyramids loaded, extracting channels");
    setDicomIndexList(indexList);
    setFileName(
      indexList.length > 0
        ? indexList
            .map((d) =>
              d.modality ? `${d.series} (${d.modality})` : `${d.series}`,
            )
            .join(", ")
        : "",
    );
    let registry = { SourceChannels: [], ChannelGroups: [] as ChannelGroup[] };
    for (const { loader, modality } of indexList) {
      const relevant_groups = groups.filter(
        ({ Image }) => Image.Method === modality,
      );
      const { SourceChannels: sc, ChannelGroups: gr } = extractChannels(
        loader,
        modality,
        relevant_groups,
      );
      const t2 = performance.now();
      const { SourceChannelsWithDist } = await getDistributions(sc, loader);
      console.log(
        `[minerva] dicom: getDistributions ${modality}: ${(performance.now() - t2).toFixed(0)}ms`,
      );
      registry = {
        SourceChannels: [...registry.SourceChannels, ...SourceChannelsWithDist],
        ChannelGroups: [...registry.ChannelGroups, ...gr],
      };
    }
    console.log("[minerva] dicom: setting store state");
    const { SourceChannels, ChannelGroups } = registry;
    setOmeLoaderEntries([]);
    const doc = useDocumentStore.getState();
    let nextDocImages = applySourceChannelsToImages(doc.images, SourceChannels);
    for (const { series, modality } of indexList) {
      nextDocImages = setImageSource(nextDocImages, modality, {
        kind: "dicomWeb",
        series,
        modality,
      });
    }
    setImages(nextDocImages);
    setChannelGroups(ChannelGroups);
    selectFirstChannelGroup(ChannelGroups);
    ensureDefaultWaypointForImageImport();
  };

  const [valid, setValid] = useState({} as ValidObj);

  const onStartRef = React.useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    if (!props.demo_url) return;
    if (useDocumentStore.getState().images.length > 0) {
      // Persisted story already has image metadata (e.g. after refresh); do not
      // re-fetch URL, but clear loading — otherwise `isLoadingImage` stays true
      // from `useState(hasDemo)` and the global HTML loader never dismisses.
      setIsLoadingImage(false);
      return;
    }
    console.log("[minerva] demo_url effect fired");
    if (props.demo_jpeg) {
      console.log(props.demo_jpeg, "demo_jpeg");
      void (async () => {
        await onStartRef.current(
          [[props.demo_url, "Colorimetric", "JPEG-URL"]],
          [] as Handle.File[],
        );
      })();
      return;
    }
    void (async () => {
      await onStartRef.current(
        [[props.demo_url, "Colorimetric", "OME-TIFF-URL"]],
        [] as Handle.File[],
      );
    })();
  }, [props.demo_url, props.demo_jpeg]);

  const loaderHydrationGenRef = React.useRef(0);
  useEffect(() => {
    if (
      jpegLoaderEntries.length > 0 ||
      omeLoaderEntries.length > 0 ||
      dicomIndexList.length > 0
    )
      return;
    if (!images.some((im) => im.source)) return;
    const gen = ++loaderHydrationGenRef.current;
    let cancelled = false;
    void (async () => {
      setIsLoadingImage(true);
      try {
        const {
          jpegLoaderEntries: jpeg,
          omeLoaderEntries: ome,
          dicomIndexList: dicom,
        } = await hydrateLoadersFromImages(images);
        if (cancelled || gen !== loaderHydrationGenRef.current) return;
        setJpegLoaderEntries(jpeg);
        setOmeLoaderEntries(ome);
        setDicomIndexList(dicom);
        const urlIm = images.find((i) => i.source?.kind === "url");
        if (urlIm?.source?.kind === "url") {
          setLastOmeTiffUrl(urlIm.source.url);
          setFileName(urlIm.source.url.split("/").pop() ?? "remote.ome.tif");
        }
      } catch (e) {
        console.error("[minerva] hydrate loaders failed", e);
      } finally {
        if (!cancelled && gen === loaderHydrationGenRef.current) {
          setIsLoadingImage(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    images,
    jpegLoaderEntries.length,
    omeLoaderEntries.length,
    dicomIndexList.length,
  ]);

  const noLoader =
    jpegLoaderEntries.length === 0 &&
    omeLoaderEntries.length === 0 &&
    dicomIndexList.length === 0 &&
    !hasDemo;

  const { name } = exhibit;

  // Data transformation (from Index)
  const imageViewerStateSignature = React.useMemo(
    () => buildImageViewerSignature(channelGroups, sourceChannels),
    [channelGroups, sourceChannels],
  );

  const itemRegistryGroups = React.useMemo(() => {
    const { channelGroups: G, sourceChannels: SC } =
      documentChannelsRef.current;
    if (buildImageViewerSignature(G, SC) !== imageViewerStateSignature) {
      throw new Error("minerva: document channel ref/signature mismatch");
    }
    return G.map((group, g) => {
      const { name, channels: groupChannelsList, expanded } = group;
      const channels = groupChannelsList.map((group_channel) => {
        const defaults = { name: "" };
        const { r, g: gg, b } = group_channel.color;
        const color = ((1 << 24) + (r << 16) + (gg << 8) + b)
          .toString(16)
          .slice(1);
        const { lowerLimit, upperLimit } = group_channel;
        const flat = findSourceChannel(SC, group_channel.channelId);
        const { name: chName } = flat || defaults;
        return {
          color,
          name: chName,
          contrast: [lowerLimit, upperLimit] as [number, number],
        };
      });
      return {
        State: { Expanded: expanded ?? false },
        g,
        name,
        channels,
      };
    });
  }, [imageViewerStateSignature]);

  const viewerImageKey = React.useMemo(() => {
    if (jpegLoaderEntries.length > 0) {
      return "jpeg"; // TODO
    }
    if (omeLoaderEntries.length > 0) {
      return `${fileName || "ome-tiff"}\0${omeLoaderEntries.map((e) => e.sourceImageId).join("\0")}`;
    }
    if (dicomIndexList.length > 0) {
      return dicomIndexList.map((d) => d.series).join("|");
    }
    return "";
  }, [jpegLoaderEntries, omeLoaderEntries, fileName, dicomIndexList]);

  const onEnsureChannelHistograms = React.useCallback(
    async (channelIds: string[]) => {
      if (omeLoaderEntries.length === 0 || channelIds.length === 0) return;
      const imageKey = viewerImageKey;
      if (!imageKey) return;
      const doc = useDocumentStore.getState();
      const prevCh = documentSourceChannels(doc);
      const loaderByImageId = new Map(
        omeLoaderEntries.map((e) => [e.sourceImageId, e.loader] as const),
      );

      type Pair = { imageId: string; index: number; channelId: string };
      const pairs: Pair[] = [];
      for (const cid of channelIds) {
        const sc = prevCh.find((c) => c.id === cid);
        if (!sc) continue;
        if (!loaderByImageId.has(sc.imageId)) continue;
        pairs.push({
          imageId: sc.imageId,
          index: sc.index,
          channelId: sc.id,
        });
      }
      if (pairs.length === 0) return;

      const byImage = new Map<string, Pair[]>();
      for (const p of pairs) {
        const list = byImage.get(p.imageId) ?? [];
        list.push(p);
        byImage.set(p.imageId, list);
      }

      const byChannelId = new Map<string, ConfigSourceDistribution>();
      for (const [imageId, plist] of byImage) {
        const loader = loaderByImageId.get(imageId);
        if (!loader) continue;
        const uniqueIdx = [...new Set(plist.map((p) => p.index))];
        const map = await ensureOmeHistogramDistributions(
          loader,
          imageKey,
          imageId,
          uniqueIdx,
        );
        for (const p of plist) {
          const dist = map.get(p.index);
          if (dist) byChannelId.set(p.channelId, dist);
        }
      }

      if (byChannelId.size === 0) return;
      const next = mergeHistogramsIntoSourceChannelsByChannelId(
        prevCh,
        byChannelId,
      );
      if (next === prevCh) return;
      doc.setImages(applySourceChannelsToImages(doc.images, next));
    },
    [omeLoaderEntries, viewerImageKey],
  );

  const playbackRouterProps = {
    hiddenChannel,
    noLoader,
    ensureChannelHistograms: onEnsureChannelHistograms,
    in_f: fileName,
    name,
    handles: [] as Handle.File[],
    directory_handle,
    ioState,
    presenting,
    stopExport,
    groups: itemRegistryGroups,
  };

  const viewerConfig = React.useMemo(() => {
    const { channelGroups: G, sourceChannels: SC } =
      documentChannelsRef.current;
    if (buildImageViewerSignature(G, SC) !== imageViewerStateSignature) {
      throw new Error("minerva: document channel ref/signature mismatch");
    }
    return {
      toSettings: (
        activeChannelGroupId: string | null,
        modality: string,
        loader?: Loader,
        channelVisibilities?: Record<string, boolean>,
        loaderSourceImageId?: string,
      ) => {
        const { channelGroups: G, sourceChannels: SC } =
          documentChannelsRef.current;
        return toSettings({ channelGroups: G, SourceChannels: SC })(
          activeChannelGroupId,
          modality,
          loader,
          channelVisibilities,
          loaderSourceImageId,
        );
      },
    };
  }, [imageViewerStateSignature]);

  const loaderList: LoaderList = React.useMemo(
    () =>
      [].concat(
        dicomIndexList.map(({ sourceImageId, loader, modality }) => {
          return {
            sourceImageId,
            loader,
            modality,
            Pixels: {
              PhysicalSizeX: 1, //TODO
              PhysicalSizeXUnit: "µm", //TODO
            },
          };
        }),
        omeLoaderEntries.map(({ sourceImageId, loader }) => {
          return {
            sourceImageId,
            loader,
            modality: "Colorimetric",
          };
        }),
        jpegLoaderEntries.map(({ sourceImageId, loader }) => {
          return {
            sourceImageId,
            loader,
            modality: "Colorimetric",
          };
        }),
      ),
    [dicomIndexList, omeLoaderEntries, jpegLoaderEntries],
  );
  const documentMainSettingsList = useMemo(() => {
    return loaderList.map(({ loader, modality, sourceImageId }) =>
      toSettingsInternal(
        loader,
        modality,
        itemRegistryGroups,
        activeChannelGroupId,
        channelVisibilities,
        viewerConfig.toSettings,
        sourceImageId,
      ),
    );
  }, [
    loaderList,
    itemRegistryGroups,
    activeChannelGroupId,
    channelVisibilities,
    viewerConfig.toSettings,
  ]);
  const mainSettingsList = useMemo(
    () =>
      documentMainSettingsList.map((settings) =>
        applyChannelRendering(
          settings,
          channelRendering,
          activeChannelGroupId,
          channelGroups,
        ),
      ),
    [
      documentMainSettingsList,
      channelRendering,
      activeChannelGroupId,
      channelGroups,
    ],
  );
  const layerFunctions = React.useMemo(() => {
    return [].concat(
      dicomIndexList.map((dicomSource, i) => {
        const { series, pyramids, loader, modality } = dicomSource;
        const rgbImage = modality === "Brightfield";
        // Use deterministic ID based on series to prevent layer recreation on settings change
        const imageID = `dicom-${series}-${i}`;
        return ({ mainSettings }) => {
          return createTileLayers({
            pyramids,
            dicomLoader: loader,
            settings: mainSettings,
            rgbImage,
            imageID,
          });
        };
      }),
      omeLoaderEntries.map(({ loader }, i) => {
        return ({ mainSettings }) => {
          const selections = mainSettings.selections || [];
          const selectionId = selections.map(({ c }) => c).join("-");
          return new MultiscaleImageLayer({
            id: `mainLayer-${i}-${selectionId}`,
            ...mainSettings,
            loader: loader.data,
          });
        };
      }),
      jpegLoaderEntries.map(({ loader }) => {
        const imagePath = "jpeg-test"; // TODO: from image source metadata
        return ({ mainSettings }) =>
          createJpegLayers({
            jpegLoader: loader.data,
            settings: mainSettings,
            imagePath,
          });
      }),
    );
  }, [dicomIndexList, omeLoaderEntries, jpegLoaderEntries]);
  const imageLayers = useMemo(() => {
    return layerFunctions.map((fn, i) =>
      fn({
        mainSettings: mainSettingsList[i],
      }),
    );
  }, [layerFunctions, mainSettingsList]);

  const imageProps = React.useMemo(() => {
    return {
      loaderList,
      mainSettingsList,
      imageLayers,
      showSquareViewportOverlay,
    };
  }, [loaderList, mainSettingsList, imageLayers, showSquareViewportOverlay]);

  // Use Zustand store for overlay state management
  const {
    overlayLayers,
    activeTool,
    dragState,
    hoverState,
    handleOverlayInteraction,
    activeStoryIndex,
    setActiveStory,
    setStories,
  } = useAppStore();
  const _waypoints = useDocumentStore((s) => s.waypoints);

  // Document waypoint lifecycle: seed from exhibit props once, then Zustand is authoritative.
  useEffect(() => {
    const configStories = seedStoriesRef.current;
    const storeWaypoints = documentWaypoints(useDocumentStore.getState());

    if (!configStories?.length) return;
    if (!viewerViewportSize?.width || !viewerViewportSize?.height) return;

    const cw = viewerViewportSize.width;
    const ch = viewerViewportSize.height;

    const hasAuthoritativeBounds = (s: ConfigWaypoint) =>
      s.Bounds != null &&
      typeof s.Bounds.x0 === "number" &&
      typeof s.Bounds.x1 === "number" &&
      typeof s.Bounds.y0 === "number" &&
      typeof s.Bounds.y1 === "number";

    const needsPanMigration = (s: ConfigWaypoint) =>
      (s.Pan != null || s.Zoom != null) && !hasAuthoritativeBounds(s);

    if (storeWaypoints.length === 0) {
      if (imageWidth <= 0 || imageHeight <= 0) {
        return;
      }
      const registry = seedShapesRef.current;
      const {
        stories: migrated,
        shapes: mergedShapes,
        didMigrate,
      } = migrateLegacyWaypointShapes(
        configStories.map((s) => ({ ...s })),
        registry,
        imageWidth,
        imageHeight,
      );
      if (import.meta.env.DEV && didMigrate) {
        console.debug("[seed] legacy waypoint markers → shapes registry", {
          waypoints: migrated.length,
          shapesInRegistry: mergedShapes.length,
          shapeIdsPerWp: migrated.map((w) => w.shapeIds?.length ?? 0),
        });
      }
      setStories(
        migrated.map((story) =>
          normalizeWaypointToBounds(story, imageWidth, imageHeight, cw, ch),
        ),
      );
      useDocumentStore.getState().setShapes(mergedShapes);
      return;
    }

    if (
      seedShapesRef.current.length > 0 &&
      documentShapes(useDocumentStore.getState()).length === 0
    ) {
      useDocumentStore.getState().setShapes(seedShapesRef.current);
    }

    const configAlignedWithStore =
      configStories.length === storeWaypoints.length &&
      configStories.every((c, i) => c.id === storeWaypoints[i]?.id);
    if (!configAlignedWithStore && storeWaypoints.length > 0) {
      return;
    }

    if (imageWidth > 0 && imageHeight > 0) {
      const authoringMap = useAppStore.getState().waypointAuthoring;
      const mask = storeWaypoints.map((sw) =>
        needsPanMigration(
          waypointToConfigWaypoint(sw, authoringMap.get(sw.id)),
        ),
      );
      if (mask.some(Boolean)) {
        const nextConfig = storeWaypoints.map((sw, i) => {
          const c = waypointToConfigWaypoint(sw, authoringMap.get(sw.id));
          return mask[i]
            ? normalizeWaypointToBounds(c, imageWidth, imageHeight, cw, ch)
            : c;
        });
        setStories(nextConfig);
      }
    }
  }, [viewerViewportSize, imageWidth, imageHeight, setStories]);

  // Initialize to first active story index
  useEffect(() => {
    const hasWaypoints = _waypoints.length;
    if (hasWaypoints && activeStoryIndex === null) {
      setActiveStory(0);
    }
  }, [_waypoints, activeStoryIndex, setActiveStory]);

  const enterPlaybackPreview = React.useCallback(() => {
    const state = useAppStore.getState();
    if (
      documentWaypoints(useDocumentStore.getState()).length > 0 &&
      state.activeStoryIndex === null
    ) {
      state.setActiveStory(0);
    }
    React.startTransition(() => {
      setPresenting(true);
    });
  }, []);

  const exitPlaybackPreview = React.useCallback(() => {
    React.startTransition(() => {
      setPresenting(false);
    });
  }, []);

  // Remove the global HTML loader once no async image load is pending (dev, demo, or restored doc).
  useEffect(() => {
    if (!isLoadingImage) {
      document.getElementById("global-loader")?.remove();
    }
  }, [isLoadingImage]);

  return (
    <FileHandler
      handleKeys={namespacedHandleKeys}
      autoRestoreOnMount={!hasDemo}
      useLaunchQueue={useLaunchQueue}
      onRestoredHandles={hasDemo ? undefined : onRestoredOmeHandles}
    >
      {({ handles, onAllow, onRecall }) => {
        const onSubmit: FormEventHandler = (event) => {
          const form = event.currentTarget as HTMLFormElement;
          const data = [...new FormData(form).entries()];
          const formOut = data.reduce(
            (o, [k, v]) => {
              o[k] = `${v}`;
              return o;
            },
            {
              mask: "",
              url: "",
              name: "",
            },
          );
          const formOpts = {
            formOut,
            onStart: (list) => onStart(list, handles),
            handles,
          };
          if (isOpts(formOpts)) {
            validate(formOpts).then((valid: ValidObj) => {
              setValid(valid);
            });
          }
          event.preventDefault();
          event.stopPropagation();
        };

        const formProps = { onSubmit, valid };
        const imageLoaded = !noLoader;
        const handleNamesLabel = handles
          .map((h) => h.name)
          .filter(Boolean)
          .join(", ");
        let loadedSource: LoadedSourceSummary | undefined;
        if (imageLoaded) {
          const img = useDocumentStore.getState().images[0];
          const w = img?.sizeX ?? 0;
          const h = img?.sizeY ?? 0;
          const ch = img?.sizeC ?? 0;
          /** Only while demo bootstrap has not produced loaders yet — not “always” when demo_url is set. */
          const isDemoBootstrap =
            hasDemo &&
            dicomIndexList.length === 0 &&
            omeLoaderEntries.length === 0;
          if (dicomIndexList.length > 0) {
            loadedSource = {
              kind: "dicom",
              label:
                fileName ||
                dicomIndexList
                  .map((d) =>
                    d.modality ? `${d.series} (${d.modality})` : `${d.series}`,
                  )
                  .join(", ") ||
                "DICOMweb",
              width: w,
              height: h,
              channelCount: ch,
              isDemo: isDemoBootstrap,
            };
          } else if (omeLoaderEntries.length > 0) {
            const isUrlSource = handles.length === 0;
            const label = isUrlSource
              ? lastOmeTiffUrl || fileName || "Remote OME-TIFF"
              : fileName || handleNamesLabel || "OME-TIFF";
            loadedSource = {
              kind: isUrlSource ? "ome-url" : "ome-local",
              label,
              width: w,
              height: h,
              channelCount: ch,
              isDemo: isDemoBootstrap,
            };
          } else {
            loadedSource = {
              kind: "ome-url",
              label:
                lastOmeTiffUrl || fileName || handleNamesLabel || "Loading…",
              width: w,
              height: h,
              channelCount: ch,
              isDemo: isDemoBootstrap,
            };
          }
        }
        const uploadProps = {
          handleKeys: namespacedHandleKeys,
          formProps,
          handles,
          onAllow,
          onRecall,
          importRevision,
          imageLoaded,
          loadedSource,
        };
        // Update mainProps with actual handles
        const routerProps = {
          ...playbackRouterProps,
          noLoader,
          handles,
          viewerConfig,
          dicomIndexList,
          omeLoaderEntries,
          exitPlaybackPreview,
        };
        // Actual image viewer
        const imagesPanel = <Upload {...uploadProps} />;
        const viewer = noLoader ? null : (
          <ImageViewer
            {...imageProps}
            viewerConfig={viewerConfig}
            overlayLayers={overlayLayers}
            activeTool={activeTool}
            isDragging={dragState.isDragging}
            hoveredShapeId={hoverState.hoveredShapeId}
            onOverlayInteraction={handleOverlayInteraction}
          />
        );
        const imager = (
          <Full>
            <PlaybackRouter
              {...routerProps}
              viewer={viewer}
              imagesPanel={imagesPanel}
            />
          </Full>
        );

        return (
          <Wrapper>
            {!presenting ? (
              <StoryTitleBar
                onExport={startExport}
                onEnterPlaybackPreview={enterPlaybackPreview}
                playbackPreviewDisabled={_waypoints.length === 0}
              />
            ) : null}
            {imager}
          </Wrapper>
        );
      }}
    </FileHandler>
  );
};

const LibraryOrAuthor = (props: Props) => {
  const { storyid } = rootRouteApi.useSearch();
  if (!storyid) {
    return <MinervaLibraryPage />;
  }
  return (
    <>
      <StoryReturnToLibraryBridge />
      <Content {...props} />
    </>
  );
};

const Main = (props: Props) => {
  /** Remove HTML shell splash whenever Main mounts (library / author shell). */
  React.useEffect(() => {
    document.getElementById("global-loader")?.remove();
  }, []);

  if (props.demo_dicom_web || props.demo_url || hasFilesystemAuthorSupport()) {
    return (
      <>
        <StoryPersistenceRoot>
          <LibraryOrAuthor {...props} />
        </StoryPersistenceRoot>
        <BuildStamp />
      </>
    );
  } else {
    return (
      <>
        <div>
          <p>
            Minerva needs a secure context (HTTPS or localhost). Serve this app
            over HTTPS and reload.
          </p>
        </div>
        <BuildStamp />
      </>
    );
  }
};

export { Main };
