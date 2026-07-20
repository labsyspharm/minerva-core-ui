import { fromBlob, fromUrl } from "geotiff";
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
import type {
  LoadedSourceSummary,
  OmeImportRequest,
  OmeImportResult,
  ValidObj,
} from "@/components/shared/Upload";
import { Upload } from "@/components/shared/Upload";
import { ImageViewer } from "@/components/shared/viewer/ImageViewer";
import type {
  ConfigSourceDistribution,
  ConfigWaypoint,
} from "@/lib/authoring/config";
import { extractChannels, extractDistributions } from "@/lib/authoring/config";
import {
  type ContrastLimits,
  clearOmeGmmContrastCache,
  ensureOmeGmmContrastLimits,
  invalidateOmeGmmContrastCache,
  looksLikeImportDefaultLimits,
  mergeGmmContrastLimitsIntoSourceChannelsByChannelId,
} from "@/lib/imaging/autoContrast";
import { defaultVisibilitiesForSources } from "@/lib/imaging/channelCompositor";
import { isImageChannel } from "@/lib/imaging/channelKind";
import { loadDicomWeb, parseDicomWeb } from "@/lib/imaging/dicom.js";
import type { DicomIndex, DicomLoader } from "@/lib/imaging/dicomIndex";
import {
  ensureFileHandlePermission,
  findFile,
  hasAuthorShellSupport,
  hasDirectoryPickerAccess,
  loadOmeLoaderForRole,
  toFile,
} from "@/lib/imaging/filesystem";
import {
  clearOmeHistogramCache,
  ensureOmeHistogramDistributions,
  mergeHistogramsIntoSourceChannelsByChannelId,
} from "@/lib/imaging/histogramLazy";
import { hydrateDocumentLoaders } from "@/lib/imaging/hydrateDocumentLoaders";
import type {
  JpegLoaderEntry,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import {
  jpegLoaderEntriesFromImages,
  useSyncJpegChannelFolders,
} from "@/lib/imaging/loadJpegFromDocument";
import { validateMaskBasenameForAppend } from "@/lib/imaging/omeImport";
import {
  applyPaletteToFlatImportImages,
  applyPaletteToGroupedImport,
  buildOmeImportSlice,
  finalizeAppendedIntensityGroups,
} from "@/lib/imaging/omeImportPipeline";
import { warmupPsudoPalette } from "@/lib/imaging/psudoPalette";
import { useViewerLayers } from "@/lib/imaging/viewerLayers";
import { Pool } from "@/lib/imaging/workers/Pool";
import type { ConfigGroup, ExhibitConfig } from "@/lib/legacy/exhibit";
import { bootstrapStoryPersistence } from "@/lib/persistence/bootstrap";
import { getDemoDocumentTitle } from "@/lib/persistence/demo";
import { putFileHandle } from "@/lib/persistence/fileHandles";
import { imageHandleStorageKey } from "@/lib/persistence/imageHandles";
import { saveStoryDocument } from "@/lib/persistence/storyPersistence";
import { useStoryAutoSave } from "@/lib/persistence/useAutoSave";
import { applyOmeRoisFromLoaderToFirstWaypoint } from "@/lib/shapes/applyOmeRoisToDocument";
import {
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
  applySourceChannelsToImages,
  dedupeImagesForImport,
  hydrateConfigWaypoint,
  type LegacyExhibitWaypoint,
  setImageSource,
  waypointsToConfigWaypoints,
} from "@/lib/stores/storeUtils";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import { tileFetcherForStory } from "@/lib/storyExport/importStoryFolder";
import {
  canExportWithRemoteUrls,
  type StoryExportMode,
} from "@/lib/storyExport/storyBundle";
import { isOpts, validate } from "@/lib/util/validate";
import {
  applyWaypointSeedAction,
  planWaypointConfigSeedTick,
  type WaypointSeedMirror,
} from "@/lib/waypoints/seedWaypointConfig";
import {
  parsePreferredStoryIdFromLocation,
  rootRouteApi,
  StoryIdUrlSync,
} from "@/router/appRouter";

/** When the story has no waypoints yet, add a default row for image import to attach to. */
function ensureDefaultWaypointForImageImport(): void {
  const doc = useDocumentStore.getState();
  if (doc.waypoints.length > 0) return;

  const groupId = doc.channelGroups[0]?.id;
  const raw: ConfigWaypoint = {
    id: crypto.randomUUID(),
    State: { Expanded: true },
    Name: "Waypoint 1",
    Content: "",
    shapeIds: [],
    ...(groupId !== undefined ? { groupId } : {}),
  };
  const app = useAppStore.getState();
  app.addStory(hydrateConfigWaypoint(raw, doc.channelGroups));
  app.setActiveStory(0);
}

type GeoTiffWithImage = {
  getImage: (i: number) => Promise<{
    fileDirectory?: { ImageDescription?: string | undefined };
  }>;
};

/** Read OME-XML from OME-TIFF ImageDescription without loading pixels. */
async function getOmeTiffImageDescriptionOmeXml(
  source: File | string,
  urlOptions: Parameters<typeof fromUrl>[1] = {},
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const tiff: GeoTiffWithImage = (
      typeof source === "string"
        ? await fromUrl(source, urlOptions, signal)
        : await fromBlob(source, signal)
    ) as GeoTiffWithImage;
    const first = await tiff.getImage(0);
    const desc = first.fileDirectory?.ImageDescription;
    if (typeof desc !== "string" || !desc.trim()) {
      return null;
    }
    return /OME|openmicroscopy|Pixels/i.test(desc) ? desc : null;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(
        "[ome-roi] could not read ImageDescription from OME-TIFF",
        e,
      );
    }
    return null;
  }
}

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
  flex: 1;
  height: 100%;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const Full = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

/** Rebuild Viv / DICOM loaders from persisted image rows (after Dexie load / refresh). */
async function hydrateLoadersFromImages(
  images: Image[],
  requestPermission = false,
  opts?: {
    channelGroups?: Parameters<
      typeof hydrateDocumentLoaders
    >[1]["channelGroups"];
    documentUrl?: string;
  },
): Promise<Awaited<ReturnType<typeof hydrateDocumentLoaders>>> {
  const storyId = useDocumentStore.getState().activeStoryId;
  return hydrateDocumentLoaders(images, {
    channelGroups: opts?.channelGroups ?? [],
    documentUrl: opts?.documentUrl ?? window.location.href,
    pool: new Pool(),
    requestPermission,
    includeLocal: true,
    fetchTile: await tileFetcherForStory(storyId),
  });
}

function clearOmeDerivedCaches(): void {
  clearOmeHistogramCache();
  clearOmeGmmContrastCache();
}

const APP_TAB_TITLE_PREFIX = getDemoDocumentTitle();

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
  const [jpegLoaderEntries, setJpegLoaderEntries] = useState<JpegLoaderEntry[]>(
    [],
  );
  const [omeLoaderEntries, setOmeLoaderEntries] = useState<OmeLoaderEntry[]>(
    [],
  );
  const [dicomIndexList, setDicomIndexList] = useState([] as DicomIndex[]);
  const [deniedHandleKeys, setDeniedHandleKeys] = useState<string[]>([]);
  const [missingHandleKeys, setMissingHandleKeys] = useState<string[]>([]);
  /** Skip auto-hydrate while import sets loaders (avoids racing publishChannelState). */
  const skipLoaderHydrateRef = React.useRef(false);
  const {
    setActiveChannelGroup,
    setChannelVisibilities,
    setGroupChannelLists,
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
    channelRendering,
    setGroupNames,
  } = useAppStore();
  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setImages = useDocumentStore((s) => s.setImages);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  /** Stories/Shapes seed + migration mirror only — channels live in documentStore. */
  const [waypointMirror, setWaypointMirror] = useState<WaypointSeedMirror>(
    () => ({
      Shapes: [],
      Stories: cloneConfigWaypoints(props.configWaypoints),
    }),
  );

  // UI State (from Index)
  const [ioState, setIoState] = useState("IDLE");
  const [exportMode, setExportMode] = useState<StoryExportMode>("jpeg-pyramid");
  const [viewerRemountKey, setViewerRemountKey] = useState(0);
  const [directory_handle, setDirectoryHandle] = useState(
    null as Handle.Dir | null,
  );
  const [presenting, setPresenting] = useState(false);
  const checkWindow = React.useCallback(() => window.innerWidth > 600, []);

  const [twoNavOk, setTwoNavOk] = useState(checkWindow());
  const [hiddenChannel, setHideChannel] = useState(!twoNavOk);

  const revealWaypointOnNarrow = React.useCallback(() => {
    if (!twoNavOk) {
      setHideChannel(true);
    }
  }, [twoNavOk]);

  const handleResize = React.useCallback(() => {
    const twoNavPossible = checkWindow();

    if (!twoNavPossible) {
      setHideChannel(true);
    }
    setTwoNavOk(twoNavPossible);
  }, [checkWindow]);

  React.useEffect(() => {
    // sync once on mount (and when handleResize changes)
    handleResize();

    window.addEventListener("resize", handleResize, false);
    return () => {
      window.removeEventListener("resize", handleResize, false);
    };
  }, [handleResize]);

  const startExport = async (mode: StoryExportMode = "jpeg-pyramid") => {
    if (!hasDirectoryPickerAccess()) {
      window.alert(
        "Export to a folder needs the File System Access API (directory picker). Try Chrome or Edge, or use “OME-TIFF URL” workflows in other browsers.",
      );
      return;
    }
    const doc = useDocumentStore.getState();
    if (mode === "remote-url" && !canExportWithRemoteUrls(doc.images)) {
      window.alert(
        "Remote URL export needs every image to use an OME-TIFF URL (no local files).",
      );
      return;
    }
    if (mode === "jpeg-pyramid") {
      const groups = doc.channelGroups;
      const hasChannels = groups.some((g) => g.channels.length > 0);
      if (groups.length === 0 || !hasChannels) {
        window.alert(
          "Add a channel group with at least one channel before exporting a JPEG pyramid.",
        );
        return;
      }
    }
    const dirHandle = await showDirectoryPicker();
    setExportMode(mode);
    setDirectoryHandle(dirHandle);
    setIoState("EXPORTING");
  };
  const stopExport = () => {
    setIoState("IDLE");
    // Recreate Viv/deck layers in case GL state was disturbed during export.
    setViewerRemountKey((k) => k + 1);
  };

  const updateGroupChannelLists = useCallback(
    ({ ChannelGroups, SourceChannels }) => {
      setGroupNames(
        Object.fromEntries(ChannelGroups.map(({ name, id }) => [id, name])),
      );
      const toChannelList = (groupChannels) => {
        return groupChannels
          .map((gc) => findSourceChannel(SourceChannels, gc.channelId))
          .filter((x) => x)
          .map(({ name: chName }) => chName);
      };
      const groupChannelLists = Object.fromEntries(
        ChannelGroups.map(({ name, channels }) => {
          return [name, toChannelList(channels)];
        }),
      );
      setGroupChannelLists(groupChannelLists);
      setChannelVisibilities(
        defaultVisibilitiesForSources(
          SourceChannels,
          useAppStore.getState().channelVisibilities,
          ChannelGroups,
        ),
      );
    },
    [setGroupNames, setGroupChannelLists, setChannelVisibilities],
  );

  /** After reload, app store resets while channel groups persist — select first group and sync lists/visibilities. */
  useEffect(() => {
    if (channelGroups.length === 0 || sourceChannels.length === 0) return;
    const active = useAppStore.getState().activeChannelGroupId;
    if (active != null && channelGroups.some((g) => g.id === active)) return;
    updateGroupChannelLists({
      ChannelGroups: channelGroups,
      SourceChannels: sourceChannels,
    });
    setActiveChannelGroup(channelGroups[0].id);
  }, [
    channelGroups,
    sourceChannels,
    updateGroupChannelLists,
    setActiveChannelGroup,
  ]);

  /** Stories/Shapes only — do not mirror channels into React config. */
  const setItems = React.useCallback((patch: Partial<WaypointSeedMirror>) => {
    setWaypointMirror((prev) => ({
      ...prev,
      ...patch,
    }));
  }, []);

  const publishChannelState = useCallback(
    (
      nextImages: Image[],
      nextChannelGroups: ChannelGroup[],
      opts: { resetActiveGroup: boolean; mergeVisibilities?: boolean },
    ) => {
      const flat = flattenImageChannelsInDocumentOrder(nextImages);
      setImages(nextImages);
      setChannelGroups(nextChannelGroups);
      if (nextChannelGroups.length === 0) {
        useAppStore.setState({ activeChannelGroupId: null });
      } else if (opts.resetActiveGroup) {
        setActiveChannelGroup(nextChannelGroups[0].id);
      }
      updateGroupChannelLists({
        ChannelGroups: nextChannelGroups,
        SourceChannels: flat,
      });
      const prev = opts.mergeVisibilities
        ? useAppStore.getState().channelVisibilities
        : undefined;
      setChannelVisibilities(
        defaultVisibilitiesForSources(flat, prev, nextChannelGroups),
      );
    },
    [
      setImages,
      setChannelGroups,
      updateGroupChannelLists,
      setChannelVisibilities,
      setActiveChannelGroup,
    ],
  );

  // Keep a stable reference for store subscriptions.
  const setItemsRef = React.useRef(setItems);
  useEffect(() => {
    setItemsRef.current = setItems;
  }, [setItems]);

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

  const onStartOmeTiff = async (
    in_f: string,
    handles: Handle.File[],
    role: OmeImportRequest["role"] = "intensity",
  ) => {
    if (handles.length === 0) return;
    clearOmeDerivedCaches();
    setDicomIndexList([]);
    setLastOmeTiffUrl(null);
    const relevant_groups = [] as ConfigGroup[];
    let nextImages: Image[] = [];
    let registry = {
      SourceChannels: [] as Channel[],
    };
    const entries: OmeLoaderEntry[] = [];

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const loader = await loadOmeLoaderForRole(role, {
        kind: "local",
        handle,
        in_f: i === 0 ? in_f : handle.name,
        pool: new Pool(),
      });
      const sourceImageId = crypto.randomUUID();
      const basename = i === 0 ? in_f : handle.name;
      const slice = buildOmeImportSlice({
        loader,
        role,
        basename,
        sourceImageId,
        existingImages: nextImages,
        relevantGroups: relevant_groups,
      });
      nextImages = slice.nextImages;
      registry = {
        SourceChannels: [...registry.SourceChannels, ...slice.sourceChannels],
      };
      entries.push({ loader, sourceImageId });
    }

    const storyId = useDocumentStore.getState().activeStoryId;
    if (storyId) {
      for (let i = 0; i < entries.length; i++) {
        const { sourceImageId } = entries[i];
        const handle = handles[i];
        const key = imageHandleStorageKey(storyId, sourceImageId);
        // Always record local source so refresh can prompt re-select (Firefox) or
        // re-grant (Chrome). putFileHandle no-ops IDB for ephemeral handles.
        await putFileHandle(key, handle);
        nextImages = setImageSource(nextImages, sourceImageId, {
          kind: "local",
          handleKey: key,
        });
      }
    }

    const { SourceChannels } = registry;
    // Fresh local replace: flat channels + shared palette; user creates groups in the panel.
    const ChannelGroups: ChannelGroup[] = [];
    if (role !== "segmentation") {
      nextImages = await applyPaletteToFlatImportImages(
        nextImages,
        SourceChannels,
      );
    }
    skipLoaderHydrateRef.current = true;
    setOmeLoaderEntries(entries);
    setDeniedHandleKeys([]);
    setMissingHandleKeys([]);
    publishChannelState(nextImages, ChannelGroups, { resetActiveGroup: true });
    ensureDefaultWaypointForImageImport();
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

  /** Add another local OME-TIFF without replacing the primary image stack. */
  const onAppendLocalOmeTiff = async (
    in_f: string,
    handles: Handle.File[],
    role: OmeImportRequest["role"],
  ): Promise<OmeImportResult> => {
    if (handles.length === 0) {
      return { ok: false, error: "Choose a mask file first." };
    }
    clearOmeDerivedCaches();
    const doc = useDocumentStore.getState();
    const mergedGroups = [...doc.channelGroups];
    let nextImages = [...doc.images];
    let removedLoaderIds: string[] = [];
    const newEntries: OmeLoaderEntry[] = [];
    const newIntensityGroups: ChannelGroup[] = [];

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const basename = i === 0 ? in_f : handle.name;
      const clash = validateMaskBasenameForAppend(nextImages, basename, role);
      if (clash) return clash;
      const deduped = dedupeImagesForImport(nextImages, basename, role);
      nextImages = deduped.images;
      removedLoaderIds = [...removedLoaderIds, ...deduped.removedImageIds];

      const loader = await loadOmeLoaderForRole(role, {
        kind: "local",
        handle,
        in_f: basename,
        pool: new Pool(),
      });
      const sourceImageId = crypto.randomUUID();
      const slice = buildOmeImportSlice({
        loader,
        role,
        basename,
        sourceImageId,
        existingImages: nextImages,
      });
      nextImages = slice.nextImages;
      newEntries.push({ loader, sourceImageId });

      const storyId = useDocumentStore.getState().activeStoryId;
      if (storyId) {
        const key = imageHandleStorageKey(storyId, sourceImageId);
        await putFileHandle(key, handle);
        nextImages = setImageSource(nextImages, sourceImageId, {
          kind: "local",
          handleKey: key,
        });
      }

      if (role !== "segmentation") {
        if (slice.extractedGroups.length > 0) {
          newIntensityGroups.push(...slice.extractedGroups);
        } else {
          nextImages = await applyPaletteToFlatImportImages(
            nextImages,
            slice.sourceChannels,
          );
        }
      }
    }

    const ChannelGroups = await finalizeAppendedIntensityGroups({
      mergedGroups,
      newIntensityGroups: role === "intensity" ? newIntensityGroups : [],
      nextImages,
    });
    skipLoaderHydrateRef.current = true;
    setOmeLoaderEntries((prev) => {
      const drop = new Set(removedLoaderIds);
      return [...prev.filter((e) => !drop.has(e.sourceImageId)), ...newEntries];
    });
    publishChannelState(nextImages, ChannelGroups, {
      resetActiveGroup: false,
      mergeVisibilities: true,
    });
    return { ok: true };
  };

  const onStartJpegUrl = async (url: string) => {
    jpegUrlLoadGenerationRef.current += 1;
    const loadGeneration = jpegUrlLoadGenerationRef.current;
    setDicomIndexList([]);
    setOmeLoaderEntries([]);
    const storyRoot = url.replace(/\/$/, "");
    const documentUrl = `${storyRoot}/document.json`;
    // Before hydrate: otherwise auto-hydrate races while jpeg entries are empty.
    // Always clear on early exit / failure so a superseded load cannot stick.
    skipLoaderHydrateRef.current = true;
    try {
      const res = await fetch(documentUrl);
      if (!res.ok) {
        throw new Error(`Failed to load ${documentUrl} (${res.status})`);
      }
      const data = validateDocumentData(await res.json());
      const storyId =
        useDocumentStore.getState().activeStoryId ??
        data.metadata.id ??
        crypto.randomUUID();
      useDocumentStore.getState().hydrateFromDocument(data, storyId);
      const flat = flattenImageChannelsInDocumentOrder(data.images);
      setImages(data.images);
      setChannelGroups(data.channelGroups);
      updateGroupChannelLists({
        ChannelGroups: data.channelGroups,
        SourceChannels: flat,
      });
      if (data.channelGroups.length > 0) {
        setActiveChannelGroup(data.channelGroups[0].id);
      } else {
        useAppStore.setState({ activeChannelGroupId: null });
      }
      ensureDefaultWaypointForImageImport();
      const jpegEntries = await jpegLoaderEntriesFromImages({
        images: data.images,
        channelGroups: data.channelGroups,
        documentUrl,
      });
      if (loadGeneration !== jpegUrlLoadGenerationRef.current) return;
      setJpegLoaderEntries(jpegEntries);
    } catch (e) {
      if (loadGeneration === jpegUrlLoadGenerationRef.current) {
        skipLoaderHydrateRef.current = false;
      }
      throw e;
    } finally {
      if (loadGeneration !== jpegUrlLoadGenerationRef.current) {
        skipLoaderHydrateRef.current = false;
      }
    }
  };

  const onStartOmeTiffUrl = async (
    url: string,
    role: OmeImportRequest["role"] = "intensity",
  ) => {
    omeTiffUrlLoadGenerationRef.current += 1;
    const loadGeneration = omeTiffUrlLoadGenerationRef.current;
    clearOmeDerivedCaches();
    setDicomIndexList([]);
    const loader = await loadOmeLoaderForRole(role, {
      kind: "url",
      url,
      pool: new Pool(),
    });
    if (loadGeneration !== omeTiffUrlLoadGenerationRef.current) {
      return;
    }
    const relevant_groups =
      props.demo_url != null && url === props.demo_url
        ? (props.exhibit_config.Groups ?? []).filter(
            ({ Image }) => Image.Method === "Colorimetric",
          )
        : ([] as ConfigGroup[]);
    const sourceImageId = crypto.randomUUID();
    const basename = url.split("/").pop() || "remote.ome.tif";
    const slice = buildOmeImportSlice({
      loader,
      role,
      basename,
      sourceImageId,
      existingImages: [],
      relevantGroups: relevant_groups,
    });
    let SourceChannels = slice.sourceChannels;
    let nextImages = slice.nextImages;
    let ChannelGroups: ChannelGroup[];
    if (role === "segmentation") {
      ChannelGroups = [];
    } else if (slice.extractedGroups.length > 0) {
      ChannelGroups = await applyPaletteToGroupedImport(
        slice.extractedGroups,
        SourceChannels,
      );
    } else {
      nextImages = await applyPaletteToFlatImportImages(
        nextImages,
        SourceChannels,
      );
      SourceChannels = flattenImageChannelsInDocumentOrder(nextImages);
      ChannelGroups = [];
    }
    nextImages = setImageSource(nextImages, sourceImageId, {
      kind: "url",
      url,
    });
    skipLoaderHydrateRef.current = true;
    setOmeLoaderEntries([{ loader, sourceImageId }]);
    setDeniedHandleKeys([]);
    publishChannelState(nextImages, ChannelGroups, { resetActiveGroup: true });
    ensureDefaultWaypointForImageImport();
    const omeXml = await getOmeTiffImageDescriptionOmeXml(url);
    applyOmeRoisFromLoaderToFirstWaypoint(loader, omeXml);
    setLastOmeTiffUrl(url);
    setFileName(basename);
  };

  const onAppendOmeTiffUrl = async (
    url: string,
    role: OmeImportRequest["role"],
  ): Promise<OmeImportResult> => {
    omeTiffUrlLoadGenerationRef.current += 1;
    const loadGeneration = omeTiffUrlLoadGenerationRef.current;
    clearOmeDerivedCaches();
    const loader = await loadOmeLoaderForRole(role, {
      kind: "url",
      url,
      pool: new Pool(),
    });
    if (loadGeneration !== omeTiffUrlLoadGenerationRef.current) {
      return { ok: false, error: "Import was superseded by a newer request." };
    }
    const basename = url.split("/").pop() || "remote.ome.tif";
    const doc = useDocumentStore.getState();
    const clash = validateMaskBasenameForAppend(doc.images, basename, role);
    if (clash) return clash;
    const mergedGroups = [...doc.channelGroups];
    const deduped = dedupeImagesForImport(doc.images, basename, role);
    let nextImages = deduped.images;
    const sourceImageId = crypto.randomUUID();
    const slice = buildOmeImportSlice({
      loader,
      role,
      basename,
      sourceImageId,
      existingImages: nextImages,
    });
    nextImages = slice.nextImages;
    nextImages = setImageSource(nextImages, sourceImageId, {
      kind: "url",
      url,
    });
    if (role !== "segmentation" && slice.extractedGroups.length === 0) {
      nextImages = await applyPaletteToFlatImportImages(
        nextImages,
        slice.sourceChannels,
      );
    }
    const ChannelGroups = await finalizeAppendedIntensityGroups({
      mergedGroups,
      newIntensityGroups: role !== "segmentation" ? slice.extractedGroups : [],
      nextImages,
    });
    skipLoaderHydrateRef.current = true;
    setOmeLoaderEntries((prev) => {
      const drop = new Set(deduped.removedImageIds);
      return [
        ...prev.filter((e) => !drop.has(e.sourceImageId)),
        { loader, sourceImageId },
      ];
    });
    publishChannelState(nextImages, ChannelGroups, {
      resetActiveGroup: false,
      mergeVisibilities: true,
    });
    return { ok: true };
  };

  const onStartOmeTiffRef = React.useRef(onStartOmeTiff);
  onStartOmeTiffRef.current = onStartOmeTiff;

  const applyHydratedLoaders = React.useCallback(
    (result: Awaited<ReturnType<typeof hydrateLoadersFromImages>>) => {
      setJpegLoaderEntries(result.jpegLoaderEntries);
      setOmeLoaderEntries(result.omeLoaderEntries);
      setDicomIndexList(result.dicomIndexList);
      setDeniedHandleKeys(result.deniedHandleKeys);
      setMissingHandleKeys(result.missingHandleKeys);
    },
    [],
  );

  const syncRegistryFromDocument = React.useCallback(() => {
    const doc = useDocumentStore.getState();
    const flat = flattenImageChannelsInDocumentOrder(doc.images);
    updateGroupChannelLists({
      ChannelGroups: doc.channelGroups,
      SourceChannels: flat,
    });
    setChannelVisibilities(
      defaultVisibilitiesForSources(
        flat,
        useAppStore.getState().channelVisibilities,
        doc.channelGroups,
      ),
    );
  }, [updateGroupChannelLists, setChannelVisibilities]);

  /** Chrome needs a click to re-grant File System Access after refresh. */
  const requestLoaderFileAccess = React.useCallback(async () => {
    setIsLoadingImage(true);
    try {
      const doc = useDocumentStore.getState();
      const result = await hydrateLoadersFromImages(doc.images, true, {
        channelGroups: doc.channelGroups,
        documentUrl: window.location.href,
      });
      applyHydratedLoaders(result);
      if (
        result.omeLoaderEntries.length +
          result.jpegLoaderEntries.length +
          result.dicomIndexList.length >
        0
      ) {
        syncRegistryFromDocument();
        setImportRevision((r) => r + 1);
        revealWaypointOnNarrow();
      }
    } catch (e) {
      console.error("[minerva] requestLoaderFileAccess failed", e);
    } finally {
      setIsLoadingImage(false);
      document.getElementById("global-loader")?.remove();
    }
  }, [applyHydratedLoaders, syncRegistryFromDocument, revealWaypointOnNarrow]);

  /**
   * Firefox (and any browser without persistable handles): pick the file again after
   * refresh, bind it to the image's handleKey (session map), then hydrate loaders.
   */
  const reselectLoaderFile = React.useCallback(
    async (imageId: string) => {
      setIsLoadingImage(true);
      try {
        const picked = await toFile();
        if (picked.length === 0) return;
        const handle = picked[0];
        if (!(await ensureFileHandlePermission(handle))) return;
        if (!(await findFile({ handle }))) return;

        const doc = useDocumentStore.getState();
        const im = doc.images.find((i) => i.id === imageId);
        if (!im?.source || im.source.kind !== "local") return;

        await putFileHandle(im.source.handleKey, handle);
        const result = await hydrateLoadersFromImages(doc.images, true, {
          channelGroups: doc.channelGroups,
          documentUrl: window.location.href,
        });
        applyHydratedLoaders(result);
        if (
          result.omeLoaderEntries.length +
            result.jpegLoaderEntries.length +
            result.dicomIndexList.length >
          0
        ) {
          syncRegistryFromDocument();
          setImportRevision((r) => r + 1);
          revealWaypointOnNarrow();
          const file = await handle.getFile();
          setFileName(file.name);
        }
      } catch (e) {
        console.error("[minerva] reselectLoaderFile failed", e);
      } finally {
        setIsLoadingImage(false);
        document.getElementById("global-loader")?.remove();
      }
    },
    [applyHydratedLoaders, syncRegistryFromDocument, revealWaypointOnNarrow],
  );

  /** Shared by FileHandler: auto-restore on mount, “Use recent”, and PWA launch — same rules. */
  const onRestoredOmeHandles = React.useCallback(
    async (restored: Handle.File[]) => {
      if (restored.length === 0) {
        document.getElementById("global-loader")?.remove();
        return;
      }
      const doc = useDocumentStore.getState();
      if (doc.images.some((im) => im.source)) {
        useAppStore.getState().clearOverlayLayers();
        setIsLoadingImage(true);
        try {
          // FileHandler already requested permission on the click path.
          applyHydratedLoaders(
            await hydrateLoadersFromImages(doc.images, false, {
              channelGroups: doc.channelGroups,
              documentUrl: window.location.href,
            }),
          );
          syncRegistryFromDocument();
        } finally {
          setIsLoadingImage(false);
        }
        setImportRevision((r) => r + 1);
        revealWaypointOnNarrow();
        document.getElementById("global-loader")?.remove();
        return;
      }
      useAppStore.getState().clearOverlayLayers();
      const file = await restored[0].getFile();
      await onStartOmeTiffRef.current(file.name, restored);
      setImportRevision((r) => r + 1);
      revealWaypointOnNarrow();
      document.getElementById("global-loader")?.remove();
    },
    [applyHydratedLoaders, syncRegistryFromDocument, revealWaypointOnNarrow],
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
    revealWaypointOnNarrow();
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
    clearOmeDerivedCaches();
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
          // Fresh DICOM import keys document images by modality (see setImageSource below).
          sourceImageId: modality,
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
    const { SourceChannels } = registry;
    const ChannelGroups = await applyPaletteToGroupedImport(
      registry.ChannelGroups,
      SourceChannels,
    );
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
    updateGroupChannelLists({
      ChannelGroups,
      SourceChannels,
    });
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
    if (props.demo_jpeg) {
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
    ) {
      skipLoaderHydrateRef.current = false;
      return;
    }
    if (skipLoaderHydrateRef.current) return;
    if (!images.some((im) => im.source)) return;
    const gen = ++loaderHydrationGenRef.current;
    let cancelled = false;
    void (async () => {
      setIsLoadingImage(true);
      try {
        const result = await hydrateLoadersFromImages(images, false, {
          channelGroups: useDocumentStore.getState().channelGroups,
          documentUrl: window.location.href,
        });
        if (
          cancelled ||
          gen !== loaderHydrationGenRef.current ||
          skipLoaderHydrateRef.current
        ) {
          return;
        }
        applyHydratedLoaders(result);
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
    applyHydratedLoaders,
  ]);

  const noLoader =
    jpegLoaderEntries.length === 0 &&
    omeLoaderEntries.length === 0 &&
    dicomIndexList.length === 0 &&
    !hasDemo;

  useSyncJpegChannelFolders(
    jpegLoaderEntries,
    images,
    activeChannelGroupId,
    channelGroups,
    setJpegLoaderEntries,
  );

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

  const onEnsureChannelGmmContrastLimits = React.useCallback(
    async (
      channelIds: string[],
      opts?: { overwriteExistingLimits?: boolean },
    ): Promise<Map<string, ContrastLimits>> => {
      const empty = new Map<string, ContrastLimits>();
      if (omeLoaderEntries.length === 0 || channelIds.length === 0) {
        return empty;
      }
      const imageKey = viewerImageKey;
      if (!imageKey) return empty;
      const doc = useDocumentStore.getState();
      const prevCh = documentSourceChannels(doc);
      const loaderByImageId = new Map(
        omeLoaderEntries.map((e) => [e.sourceImageId, e.loader] as const),
      );

      type Pair = { imageId: string; index: number; channelId: string };
      const pairs: Pair[] = [];
      const overwrite = !!opts?.overwriteExistingLimits;
      for (const cid of channelIds) {
        const sc = prevCh.find((c) => c.id === cid);
        if (!sc) continue;
        if (!loaderByImageId.has(sc.imageId)) continue;
        if (!isImageChannel(sc)) continue;
        if (!overwrite && sc.gmmContrastLimits) {
          continue;
        }
        pairs.push({
          imageId: sc.imageId,
          index: sc.index,
          channelId: sc.id,
        });
      }

      const byChannelId = new Map<string, ContrastLimits>();
      if (pairs.length > 0) {
        const byImage = new Map<string, Pair[]>();
        for (const p of pairs) {
          const list = byImage.get(p.imageId) ?? [];
          list.push(p);
          byImage.set(p.imageId, list);
        }
        for (const [imageId, plist] of byImage) {
          const loader = loaderByImageId.get(imageId);
          if (!loader) continue;
          const uniqueIdx = [...new Set(plist.map((p) => p.index))];
          if (overwrite) {
            invalidateOmeGmmContrastCache(imageKey, imageId, uniqueIdx);
          }
          const map = await ensureOmeGmmContrastLimits(
            loader,
            imageKey,
            imageId,
            uniqueIdx,
          );
          for (const p of plist) {
            const limits = map.get(p.index);
            if (limits) byChannelId.set(p.channelId, limits);
          }
        }
      }

      for (const cid of channelIds) {
        if (byChannelId.has(cid)) continue;
        const sc = prevCh.find((c) => c.id === cid);
        const cached = sc?.gmmContrastLimits;
        if (cached && cached.lower != null && cached.upper != null) {
          byChannelId.set(cid, { lower: cached.lower, upper: cached.upper });
        }
      }

      if (byChannelId.size === 0) return empty;

      const docNow = useDocumentStore.getState();
      const prevChNow = documentSourceChannels(docNow);
      const nextCh = mergeGmmContrastLimitsIntoSourceChannelsByChannelId(
        prevChNow,
        byChannelId,
        { overwrite },
      );
      if (nextCh !== prevChNow) {
        docNow.setImages(applySourceChannelsToImages(docNow.images, nextCh));
      }

      const docAfterCh = useDocumentStore.getState();
      const groupsNow = docAfterCh.channelGroups;
      let groupsChanged = false;
      const nextGroups = groupsNow.map((g) => {
        const channels = g.channels.map((gc) => {
          const fit = byChannelId.get(gc.channelId);
          if (!fit) return gc;
          if (
            !overwrite &&
            !looksLikeImportDefaultLimits(gc.lowerLimit, gc.upperLimit)
          ) {
            return gc;
          }
          groupsChanged = true;
          return { ...gc, lowerLimit: fit.lower, upperLimit: fit.upper };
        });
        return { ...g, channels };
      });
      if (groupsChanged) {
        docAfterCh.setChannelGroups(nextGroups);
      }
      return byChannelId;
    },
    [omeLoaderEntries, viewerImageKey],
  );

  const lastEagerGmmKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!viewerImageKey || omeLoaderEntries.length === 0) return;
    if (lastEagerGmmKeyRef.current === viewerImageKey) return;
    const doc = useDocumentStore.getState();
    // Existing channel groups already carry contrast limits — only eager-fit
    // when there are no groups yet (or first group creation will fit).
    if (doc.channelGroups.length > 0) {
      lastEagerGmmKeyRef.current = viewerImageKey;
      return;
    }
    const scs = documentSourceChannels(doc);
    const loaderImageIds = new Set(
      omeLoaderEntries.map((e) => e.sourceImageId),
    );
    const ids = scs
      .filter(
        (sc) =>
          loaderImageIds.has(sc.imageId) &&
          isImageChannel(sc) &&
          sc.samples !== 3 &&
          !sc.gmmContrastLimits,
      )
      .map((sc) => sc.id);
    // Only mark this image as handled once there are channels to fit (or none needed).
    if (scs.length === 0) return;
    lastEagerGmmKeyRef.current = viewerImageKey;
    if (ids.length === 0) return;
    void onEnsureChannelGmmContrastLimits(ids).catch((e) => {
      if (import.meta.env.DEV) {
        console.warn("[psudo] eager auto contrast on import failed", e);
      }
    });
  }, [viewerImageKey, omeLoaderEntries, onEnsureChannelGmmContrastLimits]);

  const channelProps = {
    hiddenChannel,
    ensureChannelHistograms: onEnsureChannelHistograms,
    ensureChannelGmmContrastLimits: onEnsureChannelGmmContrastLimits,
  };

  const mainProps = {
    ...channelProps,
    in_f: fileName,
    handles: [] as Handle.File[],
    directory_handle,
    ioState,
    exportMode,
    presenting,
    stopExport,
  };

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
      channelRendering,
      remountKey: viewerRemountKey,
    });

  const imageProps = React.useMemo(() => {
    return {
      loaderList,
      mainSettingsList,
      imageLayers,
      omeLoaderEntries,
      showSquareViewportOverlay,
    };
  }, [
    showSquareViewportOverlay,
    mainSettingsList,
    imageLayers,
    loaderList,
    omeLoaderEntries,
  ]);

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

  // Document waypoint lifecycle: props waypoints seed a thin mirror; documentStore
  // is authoritative after migration. Logic lives in seedWaypointConfig.
  useEffect(() => {
    if (!viewerViewportSize?.width || !viewerViewportSize?.height) return;
    const action = planWaypointConfigSeedTick({
      mirror: waypointMirror,
      viewportWidth: viewerViewportSize.width,
      viewportHeight: viewerViewportSize.height,
      imageWidth,
      imageHeight,
    });
    applyWaypointSeedAction(action, {
      setStories,
      setMirror: setItems,
    });
  }, [
    waypointMirror,
    viewerViewportSize,
    imageWidth,
    imageHeight,
    setStories,
    setItems,
  ]);

  // Keep the Stories/Shapes mirror warm for Strict Mode / legacy-marker checks.
  useEffect(() => {
    const unsub = useDocumentStore.subscribe((state, prevState) => {
      const waypointsChanged = state.waypoints !== prevState.waypoints;
      const shapesChanged = state.shapes !== prevState.shapes;
      if (!waypointsChanged && !shapesChanged) return;
      setItemsRef.current({
        ...(waypointsChanged
          ? {
              Stories: waypointsToConfigWaypoints(
                documentWaypoints(state),
                useAppStore.getState().waypointAuthoring,
              ),
            }
          : {}),
        ...(shapesChanged ? { Shapes: documentShapes(state) } : {}),
      });
    });
    return () => unsub();
  }, []);

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
      {({ handles, onAllow, onRecall, hasRecent }) => {
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
        const importOme = async (
          req: OmeImportRequest,
        ): Promise<OmeImportResult> => {
          setIsLoadingImage(true);
          try {
            if (req.source.kind === "local") {
              if (req.append) {
                const result = await onAppendLocalOmeTiff(
                  req.source.path,
                  req.source.handles,
                  req.role,
                );
                if (!result.ok) return result;
              } else {
                await onStartOmeTiff(
                  req.source.path,
                  req.source.handles,
                  req.role,
                );
              }
            } else if (req.append) {
              const result = await onAppendOmeTiffUrl(req.source.url, req.role);
              if (!result.ok) return result;
            } else {
              await onStartOmeTiffUrl(req.source.url, req.role);
            }
            setImportRevision((r) => r + 1);
            revealWaypointOnNarrow();
            const storyId = useDocumentStore.getState().activeStoryId;
            if (storyId) {
              await saveStoryDocument(
                storyId,
                useDocumentStore.getState().toDocumentData(),
              );
            }
            return { ok: true };
          } finally {
            setIsLoadingImage(false);
            document.getElementById("global-loader")?.remove();
          }
        };

        const uploadProps = {
          formProps,
          handles,
          onAllow,
          onRecall,
          hasRecent,
          importRevision,
          imageLoaded,
          loadedSource,
          fileName,
          lastOmeTiffUrl,
          onImportOme: importOme,
          needsFileAccess: deniedHandleKeys.length > 0,
          onRequestFileAccess: requestLoaderFileAccess,
          missingHandleKeys,
          onReselectFile: reselectLoaderFile,
        };
        const routerProps = {
          ...mainProps,
          noLoader,
          handles,
          viewerConfig,
          dicomIndexList,
          omeLoaderEntries,
          exitPlaybackPreview,
        };
        const imagesPanel = <Upload {...uploadProps} />;
        const viewer = noLoader ? null : (
          <ImageViewer
            key={viewerRemountKey}
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
                onExportRemoteUrl={
                  canExportWithRemoteUrls(images)
                    ? () => void startExport("remote-url")
                    : undefined
                }
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

  /** Preload psudo worker pool WASM once (avoids cold-start on first Optimize). */
  React.useEffect(() => {
    void warmupPsudoPalette().catch((e) => {
      if (import.meta.env.DEV) {
        console.warn("[psudo] warmup failed", e);
      }
    });
  }, []);

  if (props.demo_dicom_web || props.demo_url || hasAuthorShellSupport()) {
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
