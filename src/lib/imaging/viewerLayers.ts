import type { Layer } from "@deck.gl/core";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useMemo, useRef } from "react";
import type {
  JpegLoaderEntry,
  LoaderList,
  MainSettings,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import type { ChannelRendering } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { buildImageViewerSignature } from "@/lib/viewer/imageViewerSignature";
import type { JpegExportTransfer } from "./cubeRootEncoding";
import { createTileLayers } from "./dicom.js";
import type { DicomIndex } from "./dicomIndex";
import { createJpegLayers } from "./jpeg.js";
import { JPEG_BAKED_CONTRAST_LIMIT } from "./jpegPyramid";
import {
  type Config,
  type Loader,
  toSettings,
  VIV_TILE_MAX_CACHE_SIZE,
} from "./viv";

/** Fold live channel drag preview into Viv settings without writing the document. */
function applyChannelRendering<S extends MainSettings>(
  settings: S,
  live: ChannelRendering | null | undefined,
): S {
  if (!live) return settings;
  const ids = settings.sourceChannelIds;
  if (!ids?.length) return settings;
  const idx = ids.indexOf(live.sourceChannelId);
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

/**
 * Viv TileLayer `updateTriggers.getTileData` is `[loader, selections]` by
 * reference. Contrast/color keep the same `selections` array; eye toggles must
 * too, or the tile cache clears and the loading spinner flashes.
 */
function reuseVivSelections<S extends MainSettings>(
  next: S,
  prev: S | undefined,
): S {
  if (!prev?.selections?.length || !next.selections?.length) return next;
  if (prev.selections.length !== next.selections.length) return next;
  for (let i = 0; i < next.selections.length; i++) {
    if (prev.selections[i]?.c !== next.selections[i]?.c) return next;
  }
  return { ...next, selections: prev.selections };
}

type ViewerLoaderSources = {
  dicomIndexList?: DicomIndex[];
  omeLoaderEntries?: OmeLoaderEntry[];
  jpegLoaderEntries?: JpegLoaderEntry[];
};

/** Loader-list rows in paint order: DICOM → OME → encoded pyramids. */
function loaderListFromEntries(sources: ViewerLoaderSources): LoaderList {
  const {
    dicomIndexList = [],
    omeLoaderEntries = [],
    jpegLoaderEntries = [],
  } = sources;
  return [
    ...dicomIndexList.map(({ sourceImageId, loader, modality }) => ({
      sourceImageId,
      loader,
      modality,
    })),
    ...omeLoaderEntries.map(({ sourceImageId, loader }) => ({
      sourceImageId,
      loader,
      modality: "Colorimetric" as const,
    })),
    ...jpegLoaderEntries.map(({ sourceImageId, loader }) => ({
      sourceImageId,
      loader,
      modality: "Colorimetric" as const,
    })),
  ];
}

function createViewerConfigFromDocument(args: {
  sourceChannels: Channel[];
  channelGroups: ChannelGroup[];
}): Config {
  return {
    toSettings: toSettings({
      SourceChannels: args.sourceChannels,
      channelGroups: args.channelGroups,
    }),
  };
}

function createDicomTileLayer(args: {
  entry: DicomIndex;
  settings: unknown;
  remountKey?: string | number;
}): Layer | null {
  const rgbImage = args.entry.modality === "Brightfield";
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  const imageKey = args.entry.sourceImageId || `dicom-${args.entry.series}`;
  return createTileLayers({
    pyramids: args.entry.pyramids,
    dicomLoader: args.entry.loader,
    settings: args.settings,
    rgbImage,
    imageID: `${imageKey}${remount}`,
  });
}

/** Later OME intensity layers: skip Viv's opaque background and add onto the base. */
const OME_INTENSITY_OVERLAY_PROPS = {
  excludeBackground: true,
  refinementStrategy: "no-overlap" as const,
  parameters: {
    blend: true,
    blendColorOperation: "add",
    blendAlphaOperation: "add",
    blendColorSrcFactor: "one",
    blendColorDstFactor: "one",
    blendAlphaSrcFactor: "one",
    blendAlphaDstFactor: "one",
  },
};

function createMultiscaleLayer(args: {
  loader: Loader;
  settings: MainSettings | Record<string, unknown>;
  /** Stable deck.gl layer id (e.g. sourceImageId); remountKey is appended. */
  layerId: string;
  /** Appended to the layer id (e.g. after export remount). */
  remountKey?: string | number;
  /**
   * JPEG OME-TIFF export transfer. Contrast is baked into tiles — force full
   * display window like jpeg-pyramid (see jpeg.js).
   */
  transfer?: JpegExportTransfer;
  overlay?: boolean;
}): Layer {
  const base = args.settings as MainSettings;
  const settings: MainSettings =
    args.transfer === "contrast" && Array.isArray(base.contrastLimits)
      ? {
          ...base,
          contrastLimits: base.contrastLimits.map(
            () => JPEG_BAKED_CONTRAST_LIMIT,
          ),
        }
      : base;
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  return new MultiscaleImageLayer({
    id: `${args.layerId}${remount}`,
    ...settings,
    visible: true,
    maxCacheSize: VIV_TILE_MAX_CACHE_SIZE,
    ...(args.overlay ? OME_INTENSITY_OVERLAY_PROPS : {}),
    loader: args.loader.data,
  } as never);
}

function createEncodedImageLayer(args: {
  entry: JpegLoaderEntry;
  settings: unknown;
  remountKey?: string | number;
}): Layer {
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  return createJpegLayers({
    jpegLoader: args.entry.loader.data,
    settings: args.settings,
    transfer: args.entry.transfer ?? "contrast",
    layerId: `jpeg-${args.entry.sourceImageId}${remount}`,
  });
}

function buildImageLayers(args: {
  dicomIndexList?: DicomIndex[];
  omeLoaderEntries?: OmeLoaderEntry[];
  jpegLoaderEntries?: JpegLoaderEntry[];
  dicomSettingsList?: unknown[];
  omeSettingsList?: unknown[];
  jpegSettingsList?: unknown[];
  remountKey?: string | number;
}): Layer[] {
  const dicomIndexList = args.dicomIndexList ?? [];
  const omeLoaderEntries = args.omeLoaderEntries ?? [];
  const jpegLoaderEntries = args.jpegLoaderEntries ?? [];
  const dicomSettingsList = args.dicomSettingsList ?? [];
  const omeSettingsList = args.omeSettingsList ?? [];
  const jpegSettingsList = args.jpegSettingsList ?? [];

  let omeVisiblePainted = 0;
  return [
    ...dicomIndexList.flatMap((entry, i) => {
      const layer = createDicomTileLayer({
        entry,
        settings: dicomSettingsList[i],
        remountKey: args.remountKey,
      });
      if (!layer) return [];
      return [layer];
    }),
    ...omeLoaderEntries.flatMap(({ loader, transfer, sourceImageId }, i) => {
      const settings = omeSettingsList[i] as MainSettings | undefined;
      // Mask-only loaders have no intensity selections; painted by createMaskTileLayer.
      if (!settings?.selections?.length) return [];
      const anyVisible = (settings.channelsVisible ?? []).some(Boolean);
      const overlay = omeVisiblePainted > 0;
      if (anyVisible) omeVisiblePainted += 1;
      return [
        createMultiscaleLayer({
          loader,
          settings,
          layerId: `mainLayer-${sourceImageId}`,
          remountKey: args.remountKey,
          overlay: anyVisible ? overlay : true,
          ...(transfer ? { transfer } : {}),
        }),
      ];
    }),
    ...jpegLoaderEntries.map((entry, i) =>
      createEncodedImageLayer({
        entry,
        settings: jpegSettingsList[i],
        remountKey: args.remountKey,
      }),
    ),
  ];
}

/** Settings, loader list, and layers for document-backed playback / authoring. */
export function useViewerLayers(args: {
  dicomIndexList?: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
  jpegLoaderEntries: JpegLoaderEntry[];
  sourceChannels: Channel[];
  channelGroups: ChannelGroup[];
  activeChannelGroupId: string | null;
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities: Record<string, boolean>;
  /** Authoring: live contrast/color drag preview (CDN omits). */
  channelRendering?: ChannelRendering | null;
  /** Authoring: bump after export to recreate GL layers (CDN omits). */
  remountKey?: string | number;
}) {
  const {
    dicomIndexList = [],
    omeLoaderEntries,
    jpegLoaderEntries,
    sourceChannels,
    channelGroups,
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
    channelRendering = null,
    remountKey,
  } = args;

  // Histogram merges rewrite `sourceChannels` identity without changing Viv paint
  // inputs. Key config/settings/layers on a signature that omits distributions.
  const channelsSignature = buildImageViewerSignature(
    channelGroups,
    sourceChannels,
  );
  const channelsRef = useRef({ sourceChannels, channelGroups });
  channelsRef.current = { sourceChannels, channelGroups };

  const viewerConfig = useMemo(() => {
    // `channelsSignature` is the intentional memo key (histogram-stable).
    // Read channels from the ref so we close over the arrays from this signature.
    void channelsSignature;
    const { sourceChannels: sc, channelGroups: cg } = channelsRef.current;
    return createViewerConfigFromDocument({
      sourceChannels: sc,
      channelGroups: cg,
    });
  }, [channelsSignature]);

  const loaderList = useMemo(
    () =>
      loaderListFromEntries({
        dicomIndexList,
        omeLoaderEntries,
        jpegLoaderEntries,
      }),
    [dicomIndexList, omeLoaderEntries, jpegLoaderEntries],
  );

  const prevSettingsRef = useRef<Map<string, MainSettings>>(new Map());

  const { dicomSettingsList, omeSettingsList, jpegSettingsList } =
    useMemo(() => {
      const withSticky = (
        loaderKey: string,
        modality: string,
        loader: Loader | undefined,
        sourceImageId?: string,
      ) => {
        const prev = prevSettingsRef.current.get(loaderKey);
        const built = viewerConfig.toSettings(
          activeChannelGroupId,
          modality,
          loader,
          channelVisibilities,
          sourceImageId,
          channelGroupRowVisibilities,
          prev?.sourceChannelIds ?? [],
        ) as MainSettings;
        const settings = reuseVivSelections(built, prev);
        prevSettingsRef.current.set(loaderKey, settings);
        return settings;
      };

      return {
        dicomSettingsList: dicomIndexList.map(
          ({ loader, modality, sourceImageId }, i) =>
            withSticky(
              sourceImageId || `dicom-${i}`,
              modality,
              loader,
              sourceImageId || undefined,
            ),
        ),
        omeSettingsList: omeLoaderEntries.map(({ loader, sourceImageId }) =>
          withSticky(sourceImageId, "Colorimetric", loader, sourceImageId),
        ),
        jpegSettingsList: jpegLoaderEntries.map(({ loader, sourceImageId }) =>
          withSticky(sourceImageId, "Colorimetric", loader, sourceImageId),
        ),
      };
    }, [
      dicomIndexList,
      omeLoaderEntries,
      jpegLoaderEntries,
      viewerConfig,
      activeChannelGroupId,
      channelVisibilities,
      channelGroupRowVisibilities,
    ]);

  const dicomSettingsWithLive = useMemo(
    () =>
      dicomSettingsList.map((settings) =>
        applyChannelRendering(settings as MainSettings, channelRendering),
      ),
    [dicomSettingsList, channelRendering],
  );

  const omeSettingsWithLive = useMemo(
    () =>
      omeSettingsList.map((settings) =>
        applyChannelRendering(settings as MainSettings, channelRendering),
      ),
    [omeSettingsList, channelRendering],
  );

  const jpegSettingsWithLive = useMemo(
    () =>
      jpegSettingsList.map((settings) =>
        applyChannelRendering(settings as MainSettings, channelRendering),
      ),
    [jpegSettingsList, channelRendering],
  );

  const mainSettingsList = useMemo(
    () => [
      ...dicomSettingsWithLive,
      ...omeSettingsWithLive,
      ...jpegSettingsWithLive,
    ],
    [dicomSettingsWithLive, omeSettingsWithLive, jpegSettingsWithLive],
  );

  const imageLayers = useMemo(
    () =>
      buildImageLayers({
        dicomIndexList,
        omeLoaderEntries,
        jpegLoaderEntries,
        // Live rendering must reach layers (not only mainSettingsList props).
        dicomSettingsList: dicomSettingsWithLive,
        omeSettingsList: omeSettingsWithLive,
        jpegSettingsList: jpegSettingsWithLive,
        remountKey,
      }),
    [
      dicomIndexList,
      omeLoaderEntries,
      jpegLoaderEntries,
      dicomSettingsWithLive,
      omeSettingsWithLive,
      jpegSettingsWithLive,
      remountKey,
    ],
  );

  return { viewerConfig, loaderList, mainSettingsList, imageLayers };
}
