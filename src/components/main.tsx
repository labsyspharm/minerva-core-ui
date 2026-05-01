import type { FormEventHandler } from "react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { StoryTitleBar } from "@/components/authoring/StoryTitleBar";
import { MinervaLibraryPage } from "@/components/library/MinervaLibraryPage";
import { PlaybackRouter } from "@/components/playback/PlaybackRouter";
import { StoryReturnToLibraryBridge } from "@/components/StoryReturnToLibraryBridge";
import { FileHandler } from "@/components/shared/FileHandler";
import type { LoadedSourceSummary, ValidObj } from "@/components/shared/Upload";
import { Upload } from "@/components/shared/Upload";
import {
  ImageViewer,
  type OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import type {
  ConfigSourceDistribution,
  ConfigWaypoint,
  ItemRegistryProps,
  MutableFields,
} from "@/lib/authoring/config";
import {
  extractChannels,
  extractDistributions,
  mutableItemRegistry,
} from "@/lib/authoring/config";
import { loadDicomWeb, parseDicomWeb } from "@/lib/imaging/dicom.js";
import type { DicomIndex, DicomLoader } from "@/lib/imaging/dicomIndex";
import {
  findFile,
  hasFileSystemAccess,
  toLoader,
  toLoaderFromUrl,
} from "@/lib/imaging/filesystem";
import {
  clearOmeHistogramCache,
  ensureOmeHistogramDistributions,
  mergeHistogramsIntoSourceChannelsByChannelId,
} from "@/lib/imaging/histogramLazy";
import { type Loader, toSettings } from "@/lib/imaging/viv";
import { Pool } from "@/lib/imaging/workers/Pool";
import type {
  ConfigGroup,
  ExhibitConfig,
  Waypoint as WaypointType,
} from "@/lib/legacy/exhibit";
import { readConfig } from "@/lib/legacy/exhibit";
import { bootstrapStoryPersistence } from "@/lib/persistence/bootstrap";
import { getFileHandle, putFileHandle } from "@/lib/persistence/fileHandles";
import { imageHandleStorageKey } from "@/lib/persistence/imageHandles";
import { useStoryAutoSave } from "@/lib/persistence/useAutoSave";
import { applyOmeRoisFromLoaderToFirstWaypoint } from "@/lib/shapes/applyOmeRoisToDocument";
import { getOmeTiffImageDescriptionOmeXml } from "@/lib/shapes/omeTiffOmeDescription";
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
  applyGroupChannelRange,
  applyLoaderPixelSizeToImage,
  applySourceChannelsToImages,
  configWaypointsHaveLegacyArrowsOrOverlays,
  type LegacyExhibitWaypoint,
  migrateLegacyWaypointShapes,
  type SetGroupChannelRangePayload,
  setImageSource,
  waypointsToConfigWaypoints,
  waypointToConfigWaypoint,
} from "@/lib/stores/storeUtils";
import { isOpts, validate } from "@/lib/util/validate";
import { buildImageViewerSignature } from "@/lib/viewer/imageViewerSignature";
import { ensureDefaultWaypointForImageImport } from "@/lib/waypoints/ensureDefaultWaypointForImageImport";
import { normalizeWaypointToBounds } from "@/lib/waypoints/waypoint";
import { author } from "@/minerva-author-ui/author";
import { toAuthorElement } from "@/minerva-author-ui/index";
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

const setContainer = ({ container, idx, key, newItem }) => {
  const extra = idx >= container[key].length ? [newItem] : [];
  const newItems = container[key].concat(extra).map((item, i) => {
    return i === idx ? newItem : item;
  });
  return { ...container, [key]: newItems };
};

const setStory = ({ exhibit, s, newStory }) => {
  return setContainer({
    newItem: newStory,
    container: exhibit,
    key: "stories",
    idx: s,
  });
};

const setWaypoint = ({ exhibit, s, w, newWaypoint }) => {
  const story = exhibit.stories[s];
  const newStory = setContainer({
    newItem: newWaypoint,
    container: story,
    key: "waypoints",
    idx: w,
  });
  return setStory({ exhibit, s, newStory });
};

const setGroup = ({ exhibit, g, newGroup }) => {
  return setContainer({
    newItem: newGroup,
    container: exhibit,
    key: "groups",
    idx: g,
  });
};

const setChannel = ({ exhibit, g, idx, newChannel }) => {
  const group = exhibit.groups[g];
  const newGroup = setContainer({
    newItem: newChannel,
    container: group,
    key: "channels",
    idx,
  });
  return setGroup({ exhibit, g, newGroup });
};

const removeKey = (container, key, idx) => {
  const newList = container[key].filter((_, i) => i !== idx);
  return { ...container, [key]: newList };
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
  omeLoaderEntries: OmeLoaderEntry[];
  dicomIndexList: DicomIndex[];
}> {
  const omeLoaderEntries: OmeLoaderEntry[] = [];
  const dicomIndexList: DicomIndex[] = [];
  const pool = new Pool();
  const dicomSeriesSeen = new Set<string>();

  for (const im of images) {
    if (!im.source) continue;
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
        });
        break;
      }
    }
  }

  return { omeLoaderEntries, dicomIndexList };
}

const APP_TAB_TITLE_PREFIX =
  import.meta.env.MODE === "demo" ? "Minerva 2.0 Demo" : "Minerva";

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
  const [exhibit, setExhibit] = useState(firstExhibit);
  const [omeLoaderEntries, setOmeLoaderEntries] = useState<OmeLoaderEntry[]>(
    [],
  );
  const [dicomIndexList, setDicomIndexList] = useState([] as DicomIndex[]);
  const {
    setActiveChannelGroup,
    setChannelVisibilities,
    setGroupChannelLists,
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
  const documentChannelsRef = React.useRef({ channelGroups, sourceChannels });
  documentChannelsRef.current = { channelGroups, sourceChannels };
  const [config, setConfig] = useState(() => ({
    ItemRegistry: {
      Name: "",
      ChannelGroups: channelGroups,
      SourceChannels: sourceChannels,
      SourceDistributions: [],
      Shapes: [],
      Stories: cloneConfigWaypoints(props.configWaypoints),
    } as ItemRegistryProps,
    ID: crypto.randomUUID(),
  }));

  // UI State (from Index)
  const [ioState, setIoState] = useState("IDLE");
  const [directory_handle, setDirectoryHandle] = useState(
    null as Handle.Dir | null,
  );
  const [presenting, setPresenting] = useState(false);
  const [editable, setEditable] = useState(false);
  const checkWindow = React.useCallback(() => window.innerWidth > 600, []);

  const [twoNavOk, setTwoNavOk] = useState(checkWindow());
  const [hiddenWaypoint, setHideWaypoint] = useState(false);
  const [hiddenChannel, setHideChannel] = useState(!twoNavOk);

  const handleResize = React.useCallback(() => {
    const twoNavPossible = checkWindow();

    if (!twoNavPossible) {
      setHideWaypoint(false);
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

  const startExport = async () => {
    const dirHandle = await showDirectoryPicker();
    setDirectoryHandle(dirHandle);
    setIoState("EXPORTING");
  };
  const stopExport = () => setIoState("IDLE");
  const toggleEditor = () => setEditable(!editable);

  const setHiddenChannelWithLogic = (v: boolean) => {
    if (!twoNavOk && !v) {
      setHideWaypoint(true);
    }
    setHideChannel(v);
  };

  const setHiddenWaypointWithLogic = (v: boolean) => {
    if (!twoNavOk && !v) {
      setHideChannel(true);
    }
    setHideWaypoint(v);
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
      const defaultGroup = ChannelGroups[0] || {
        channels: [],
        name: "",
      };
      const groupName = defaultGroup.name;
      const channelList = groupChannelLists[groupName] || [];
      setChannelVisibilities(
        Object.fromEntries(channelList.map((name) => [name, true])),
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

  const resetItems = (ItemRegistry) => {
    setConfig((config) => ({
      ...config,
      ItemRegistry: {
        ...config.ItemRegistry,
        ...ItemRegistry,
      },
      ID: crypto.randomUUID(),
    }));
    const { ChannelGroups } = ItemRegistry;
    if (ChannelGroups?.length > 0) {
      setActiveChannelGroup(ChannelGroups[0].id);
    }
  };

  const setItems = React.useCallback((ItemRegistry) => {
    setConfig((config) => ({
      ...config,
      ItemRegistry: {
        ...config.ItemRegistry,
        ...ItemRegistry,
      },
    }));
  }, []);

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
    updateGroupChannelLists({
      ChannelGroups,
      SourceChannels,
    });
    resetItems({
      SourceChannels,
      ChannelGroups,
    });
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
    updateGroupChannelLists({ ChannelGroups, SourceChannels });
    resetItems({ SourceChannels, ChannelGroups });
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
      // setStories, document setShapes/setWaypoints, setConfig clearing Stories/Shapes, or
      // resetDocument — only transient viewer state + OME reconnect below.
      useAppStore.getState().clearOverlayLayers();
      const file = await restored[0].getFile();
      await onStartOmeTiffRef.current(file.name, restored);
      setImportRevision((r) => r + 1);
      setHideWaypoint(false);
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
    // OME-TIFF loaded from a remote URL
    const omeTiffUrlList = imagePropList
      .filter(([_url, _modality, type]) => type === "OME-TIFF-URL")
      .map(([url]) => url);
    const willLoad =
      dicomPropList.length > 0 ||
      (omeTiffPropList.length > 0 && handles.length > 0) ||
      omeTiffUrlList.length > 0;
    if (!willLoad) return;

    const t0 = performance.now();
    console.log("[minerva] onStart: will load, setting loading state");
    // Switch to waypoints tab and show loading immediately.
    setImportRevision((r) => r + 1);
    setHiddenWaypointWithLogic(false);
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
    updateGroupChannelLists({
      ChannelGroups,
      SourceChannels,
    });
    ensureDefaultWaypointForImageImport();
  };

  const mutableFields: MutableFields = [];
  const ItemRegistry = mutableItemRegistry(
    config.ItemRegistry,
    setItems,
    mutableFields,
  );

  const getSourceDistribution = React.useMemo(() => {
    return (source_uuid) => {
      const source_channel = sourceChannels.find((x) => {
        return x.id === source_uuid;
      });
      if (source_channel) {
        const { sourceDistribution } = source_channel;
        return sourceDistribution;
      }
      return null;
    };
  }, [sourceChannels]);

  // Recreate the author web components only when config.ID changes (same behavior
  // as the previous useMemo([config.ID]) + ref, without hook dependency noise).
  const controlPanelCacheRef = React.useRef<{
    configId: string;
    element: string;
  } | null>(null);
  if (
    !controlPanelCacheRef.current ||
    controlPanelCacheRef.current.configId !== config.ID
  ) {
    controlPanelCacheRef.current = {
      configId: config.ID,
      element: author({
        ...config,
        ItemRegistry,
        actions: {
          startExport,
        },
      }),
    };
  }
  const controlPanelElement = controlPanelCacheRef.current.element;

  const setGroupChannelRange = React.useCallback(
    (payload: SetGroupChannelRangePayload) => {
      const doc = useDocumentStore.getState();
      doc.setChannelGroups(applyGroupChannelRange(doc.channelGroups, payload));
    },
    [],
  );

  // Define a WebComponent for a channel
  const channelItemElement = React.useMemo(() => {
    return toAuthorElement("channel-item", {
      ID: crypto.randomUUID(),
      setGroupChannelRange,
      getSourceDistribution,
    });
  }, [getSourceDistribution, setGroupChannelRange]);

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
    void (async () => {
      await onStartRef.current(
        [[props.demo_url, "Colorimetric", "OME-TIFF-URL"]],
        [] as Handle.File[],
      );
    })();
  }, [props.demo_url]);

  const loaderHydrationGenRef = React.useRef(0);
  useEffect(() => {
    if (omeLoaderEntries.length > 0 || dicomIndexList.length > 0) return;
    if (!images.some((im) => im.source)) return;
    const gen = ++loaderHydrationGenRef.current;
    let cancelled = false;
    void (async () => {
      setIsLoadingImage(true);
      try {
        const { omeLoaderEntries: ome, dicomIndexList: dicom } =
          await hydrateLoadersFromImages(images);
        if (cancelled || gen !== loaderHydrationGenRef.current) return;
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
  }, [images, omeLoaderEntries.length, dicomIndexList.length]);

  const noLoader =
    omeLoaderEntries.length === 0 && dicomIndexList.length === 0 && !hasDemo;

  // Exhibit editing operations (from Index)
  const { name, groups: exhibitGroups, stories } = exhibit;

  const updateWaypoint = (newWaypoint: WaypointType, { s, w }) => {
    const oldWaypoint = stories[s]?.waypoints[w];
    if (!oldWaypoint) {
      throw `Cannot update waypoint. Waypoint ${w} does not exist!`;
    }
    const ex = setWaypoint({ exhibit, s, w, newWaypoint });
    setExhibit(ex);
  };

  const pushWaypoint = (newWaypoint: WaypointType, { s }) => {
    if (!stories[s]) {
      throw `Cannot push waypoint. Story ${s} does not exist!`;
    }
    const w = stories[s].waypoints.length;
    const ex = setWaypoint({ exhibit, s, w, newWaypoint });
    setExhibit(ex);
  };

  const popWaypoint = ({ s, w }) => {
    const story = stories[s];
    const oldWaypoints = story?.waypoints;
    if (oldWaypoints?.length <= 1) {
      throw "Unable to pop last waypoint";
    }
    const newStory = removeKey(story, "waypoints", w);
    const ex = setStory({ exhibit, s, newStory });
    setExhibit(ex);
  };

  const updateGroup = (newGroup, { g }) => {
    const ex = setGroup({ exhibit, g, newGroup });
    setExhibit(ex);
  };

  const pushGroup = (newGroup) => {
    const g = exhibit.groups.length;
    const ex = setGroup({ exhibit, g, newGroup });
    setExhibit(ex);
  };

  const popGroup = ({ g }) => {
    if (exhibitGroups.length <= 1) {
      throw "Unable to pop last group";
    }
    const ex = removeKey(exhibit, "groups", g);
    const newGroups = ex.groups.map((group) => {
      const gNext = group.g >= g ? group.g - 1 : group.g;
      return { ...group, g: gNext };
    });
    const newStories = ex.stories.map((story) => {
      const newWaypoints = story.waypoints.map((waypoint) => {
        const gNext = waypoint.g >= g ? 0 : g;
        return { ...waypoint, g: gNext };
      });
      return { ...story, waypoints: newWaypoints };
    });
    setExhibit({ ...ex, groups: newGroups, stories: newStories });
  };

  const updateChannel = (newChannel, { g, idx }) => {
    const group = exhibitGroups[g];
    if (!group?.channels[idx]) {
      throw `Cannot update channel. Channel ${idx} does not exist!`;
    }
    const ex = setChannel({ exhibit, g, idx, newChannel });
    setExhibit(ex);
  };

  const pushChannel = (newChannel, { g }) => {
    const group = exhibitGroups[g];
    if (!group) {
      throw `Cannot push channel. Group ${g} does not exist!`;
    }
    const idx = group.channels.length;
    const ex = setChannel({ exhibit, g, idx, newChannel });
    setExhibit(ex);
  };

  const popChannel = ({ g, idx }) => {
    const group = exhibitGroups[g];
    const channels = group?.channels;
    if (channels.length <= 1) {
      throw "Unable to pop last channel";
    }
    const newGroup = removeKey(group, "channels", idx);
    const ex = setGroup({ exhibit, g, newGroup });
    setExhibit(ex);
  };

  // Data transformation (from Index)
  const itemRegistryMarkerNames = sourceChannels.map(
    (source_channel) => source_channel.name,
  );

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
    if (omeLoaderEntries.length > 0) {
      return `${fileName || "ome-tiff"}\0${omeLoaderEntries.map((e) => e.sourceImageId).join("\0")}`;
    }
    if (dicomIndexList.length > 0) {
      return dicomIndexList.map((d) => d.series).join("|");
    }
    return "";
  }, [omeLoaderEntries, fileName, dicomIndexList]);

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
      setItems({ SourceChannels: next });
    },
    [omeLoaderEntries, viewerImageKey, setItems],
  );

  const channelProps = {
    name,
    stories,
    authorMode: !presenting,
    groups: itemRegistryGroups,
    controlPanelElement,
    channelItemElement,
    config: config,
    editable,
    hiddenChannel,
    setHiddenChannel: setHiddenChannelWithLogic,
    updateGroup,
    pushGroup,
    popGroup,
    updateChannel,
    pushChannel,
    popChannel,
    ensureChannelHistograms: onEnsureChannelHistograms,
  };

  const mainProps = {
    ...channelProps,
    in_f: fileName,
    name,
    handles: [] as Handle.File[],
    directory_handle,
    ioState,
    presenting,
    hiddenWaypoint,
    setHiddenWaypoint: setHiddenWaypointWithLogic,
    startExport,
    stopExport,
    toggleEditor,
    updateWaypoint,
    pushWaypoint,
    popWaypoint,
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

  const imageProps = React.useMemo(() => {
    return {
      ChannelGroups: channelGroups,
      SourceChannels: sourceChannels,
      omeLoaderEntries,
      dicomIndexList,
      marker_names: itemRegistryMarkerNames,
      groups: itemRegistryGroups,
      stories,
      name,
      showSquareViewportOverlay,
      viewerImageKey,
    };
  }, [
    channelGroups,
    sourceChannels,
    omeLoaderEntries,
    dicomIndexList,
    itemRegistryMarkerNames,
    itemRegistryGroups,
    stories,
    name,
    showSquareViewportOverlay,
    viewerImageKey,
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

  // Document waypoint lifecycle: `index.tsx` waypoints are copied once into
  // `config` (see `useState` initializer). Then `useDocumentStore.waypoints` is
  // authoritative; this effect seeds empty state or migrates legacy markers.
  // The subscription mirrors waypoints + shapes into `config.ItemRegistry`.
  useEffect(() => {
    const configStories = config.ItemRegistry.Stories;
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

    // First paint: fill empty store from config only once image dimensions exist so
    // `Arrows` / `Overlays` can be converted to `ShapeIds` + registry (`Shapes`)
    // before anything enters Zustand.
    if (storeWaypoints.length === 0) {
      if (imageWidth <= 0 || imageHeight <= 0) {
        return;
      }
      const registry = config.ItemRegistry.Shapes ?? [];
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

    // Exhibit `Shapes` can arrive after `Stories`, or the seed path may have seen `Shapes`
    // as undefined. Hydrate **before** the alignment early-return so imports always resolve
    // when the exhibit registry has data (even if ids are temporarily out of sync).
    if (
      (config.ItemRegistry.Shapes?.length ?? 0) > 0 &&
      documentShapes(useDocumentStore.getState()).length === 0
    ) {
      useDocumentStore.getState().setShapes(config.ItemRegistry.Shapes ?? []);
    }

    // Store rows and config `Stories` are different arrays; keep Pan/Zoom → Bounds
    // migration when image + viewer metrics are ready. Avoid clobbering the store
    // when exhibit `Stories` no longer match store waypoint ids (e.g. external swap).
    const configAlignedWithStore =
      configStories.length === storeWaypoints.length &&
      configStories.every((c, i) => c.id === storeWaypoints[i]?.id);
    if (!configAlignedWithStore && storeWaypoints.length > 0) {
      return;
    }

    // `config` is initialized from `cloneConfigWaypoints`, which includes legacy
    // `Arrows` / `Overlays`. Zustand is seeded via migration above, but React can
    // reinstantiate `useState` (e.g. Strict Mode) while the store keeps migrated
    // rows — UUIDs still match, so we never re-run seed. The subscription only
    // fires when the *store* changes, so `ItemRegistry.Stories` can stay stale.
    // Push canonical Stories + Shapes from Zustand whenever config still shows
    // legacy markers while aligned with the store.
    if (
      configAlignedWithStore &&
      configWaypointsHaveLegacyArrowsOrOverlays(configStories)
    ) {
      const doc = useDocumentStore.getState();
      setItemsRef.current({
        Stories: waypointsToConfigWaypoints(
          documentWaypoints(doc),
          useAppStore.getState().waypointAuthoring,
        ),
        Shapes: documentShapes(doc),
      });
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
  }, [
    config.ItemRegistry.Stories,
    config.ItemRegistry.Shapes,
    viewerViewportSize,
    imageWidth,
    imageHeight,
    setStories,
  ]);

  // Sync document waypoints + shapes into config for persistence.
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
        const mainPropsWithHandle = {
          ...mainProps,
          noLoader,
          handles,
          viewerConfig,
          dicomIndexList,
          omeLoaderEntries,
          enterPlaybackPreview,
          exitPlaybackPreview,
        };
        // Actual image viewer
        const imager = noLoader ? (
          <Full>
            <PlaybackRouter {...mainPropsWithHandle}>
              <Upload {...uploadProps} />
            </PlaybackRouter>
          </Full>
        ) : (
          <Full>
            <PlaybackRouter {...mainPropsWithHandle}>
              <ImageViewer
                {...imageProps}
                viewerConfig={viewerConfig}
                overlayLayers={overlayLayers}
                activeTool={activeTool}
                isDragging={dragState.isDragging}
                hoveredShapeId={hoverState.hoveredShapeId}
                onOverlayInteraction={handleOverlayInteraction}
              />
              <Upload {...uploadProps} />
            </PlaybackRouter>
          </Full>
        );

        return (
          <Wrapper>
            {!presenting ? (
              <StoryTitleBar
                authorUiTagName={controlPanelElement}
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
  if (props.demo_dicom_web || props.demo_url || hasFileSystemAccess()) {
    return (
      <StoryPersistenceRoot>
        <LibraryOrAuthor {...props} />
      </StoryPersistenceRoot>
    );
  } else {
    return (
      <div>
        <p>Unable to access FileSystem API.</p>
      </div>
    );
  }
};

export { Main };
