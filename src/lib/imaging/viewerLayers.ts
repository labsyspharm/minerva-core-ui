import type { Layer } from "@deck.gl/core";
import { isInterleaved, MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useEffect, useMemo, useRef } from "react";
import {
  bitmapLayerOpacity,
  type ImageOpacityPreview,
  imageFadeParameters,
  OME_INTENSITY_OVERLAY_PROPS,
  opacityForImage,
} from "@/lib/imaging/imageOpacity";
import type {
  JpegLoaderEntry,
  LoaderList,
  MainSettings,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import {
  type ChannelRendering,
  type ImageOrientationPreview,
  useAppStore,
} from "@/lib/stores/appStore";
import type {
  Channel,
  ChannelGroup,
  Image,
  ImageOrientation,
} from "@/lib/stores/documentStore";
import { buildImageViewerSignature } from "@/lib/viewer/imageViewerSignature";
import type { JpegExportTransfer } from "./cubeRootEncoding";
import { createTileLayers } from "./dicom.js";
import type { DicomIndex } from "./dicomIndex";
import { createHeDeconvLayer } from "./heDeconvTileLayer";
import {
  defaultHeDeconvSplit,
  type HeDeconvComponent,
  type HeDeconvSplit,
  type HeSplitMode,
  type HeStainView,
} from "./heDeconvView";
import {
  ensureHeStainFit,
  type HeStainFit,
  RETRY_FAILED_AFTER_MS,
} from "./heStainFit";
import { orientationForImage } from "./imageOrientation";
import { createJpegLayers } from "./jpeg.js";
import { JPEG_BAKED_CONTRAST_LIMIT } from "./jpegPyramid";
import { stainLayerParameters } from "./stainExtension";
import {
  type Loader,
  PlaceholderTileset2D,
  TILE_CACHE_PROPS,
  toSettings,
} from "./viv";
import "./vivNearestSampling";
import { inheritUnitlessPhysicalSize, layerModelMatrix } from "./worldFrame";

/** Fold live channel drag preview into Viv settings without writing the document. */
function applyChannelRendering<S extends MainSettings>(
  settings: S,
  live: ChannelRendering | null | undefined,
): S {
  if (!live || live.heComponent) return settings;
  const ids = settings.sourceChannelIds;
  if (!ids?.length) return settings;
  const idx = ids.indexOf(live.sourceChannelId);
  if (idx < 0) return settings;
  if (live.kind === "contrast") {
    if (idx >= settings.contrastLimits.length) return settings;
    const contrastLimits = settings.contrastLimits.map((pair, i) =>
      i === idx
        ? ([live.lower, live.upper] as [number, number])
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

type StainSplit = [MainSettings | null, MainSettings | null];

/**
 * Last split per settings object. Viv compares `selections` by identity, so
 * fresh arrays on every rebuild (e.g. each tick of another image's opacity
 * slider) would rebuild every cached tile of this one.
 */
const stainSplitCache = new WeakMap<
  MainSettings,
  { mask: string; split: StainSplit }
>();

/**
 * `settings` split into its fluorescence and its stain channels (either null
 * when empty), so each half fetches only its own planes.
 */
function splitStainChannels(
  settings: MainSettings,
  stainChannelIds: ReadonlySet<string>,
): StainSplit {
  const ids = settings.sourceChannelIds;
  if (!ids?.some((id) => stainChannelIds.has(id))) return [settings, null];
  const isStain = ids.map((id) => stainChannelIds.has(id));
  const mask = isStain.map(Number).join("");
  const cached = stainSplitCache.get(settings);
  if (cached?.mask === mask) return cached.split;
  const part = (stain: boolean): MainSettings | null => {
    if (!isStain.includes(stain)) return null;
    const pick = <T>(values: readonly T[]) =>
      values.filter((_, i) => isStain[i] === stain);
    return {
      ...settings,
      selections: pick(settings.selections),
      contrastLimits: pick(settings.contrastLimits),
      colors: pick(settings.colors),
      channelsVisible:
        settings.channelsVisible && pick(settings.channelsVisible),
      sourceChannelIds: pick(ids),
    };
  };
  const split: StainSplit = [part(false), part(true)];
  stainSplitCache.set(settings, { mask, split });
  return split;
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
  const list = [
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
  inheritUnitlessPhysicalSize(list.map((row) => row.loader));
  return list;
}

/** Brightfield DICOM draws RGB tiles through deck's BitmapLayer. */
const isDicomRgb = (entry: DicomIndex) => entry.modality === "Brightfield";

function createDicomTileLayer(args: {
  entry: DicomIndex;
  settings: unknown;
  remountKey?: string | number;
  orientation?: ImageOrientation | null;
  opacity: number;
}): Layer | null {
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  const imageKey = args.entry.sourceImageId || `dicom-${args.entry.series}`;
  return createTileLayers({
    pyramids: args.entry.pyramids,
    dicomLoader: args.entry.loader,
    settings: args.settings,
    rgbImage: isDicomRgb(args.entry),
    imageID: `${imageKey}${remount}`,
    modelMatrix: layerModelMatrix(args.entry.loader, args.orientation),
    opacity: args.opacity,
  });
}

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
  orientation?: ImageOrientation | null;
  opacity: number;
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
    ...TILE_CACHE_PROPS,
    TilesetClass: PlaceholderTileset2D,
    // Viv's overview ImageLayer getRaster()s the full coarsest plane; isLoaded
    // waits on that decode even after tiles have painted.
    excludeBackground: true,
    ...(args.overlay ? OME_INTENSITY_OVERLAY_PROPS : {}),
    ...imageFadeParameters(Boolean(args.overlay), args.opacity),
    // Viv draws interleaved (packed RGB) tiles with deck's BitmapLayer.
    opacity: isInterleaved(args.loader.data[0].shape)
      ? bitmapLayerOpacity(args.opacity)
      : args.opacity,
    loader: args.loader.data,
    modelMatrix: layerModelMatrix(args.loader, args.orientation),
  } as never);
}

function createEncodedImageLayer(args: {
  entry: JpegLoaderEntry;
  settings: unknown;
  remountKey?: string | number;
  orientation?: ImageOrientation | null;
  opacity: number;
}): Layer {
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  return createJpegLayers({
    jpegLoader: args.entry.loader.data,
    settings: args.settings,
    transfer: args.entry.transfer ?? "contrast",
    layerId: `jpeg-${args.entry.sourceImageId}${remount}`,
    modelMatrix: layerModelMatrix(args.entry.loader, args.orientation),
    opacity: args.opacity,
  });
}

type HeDeconvPaint = {
  parentIndex: number;
  sourceChannelId: string;
  mode: HeSplitMode;
  hematoxylin: HeStainView;
  eosin: HeStainView;
  residual: HeStainView;
};

function liveHeStain(
  stain: HeStainView,
  sourceChannelId: string,
  component: HeDeconvComponent,
  live: ChannelRendering | null | undefined,
): HeStainView {
  if (
    live?.sourceChannelId !== sourceChannelId ||
    live.heComponent !== component
  ) {
    return stain;
  }
  if (live.kind === "contrast") {
    return { ...stain, lower: live.lower, upper: live.upper };
  }
  return { ...stain, color: [live.r, live.g, live.b] };
}

function peelHeDeconvFromSettings(
  settings: MainSettings | undefined,
  heDeconvByChannelId: Record<string, HeDeconvSplit> | undefined,
  live: ChannelRendering | null | undefined,
): { settings: MainSettings | undefined; heLayers: HeDeconvPaint[] } {
  const ids = settings?.sourceChannelIds;
  if (!settings || !ids?.length || !heDeconvByChannelId) {
    return { settings, heLayers: [] };
  }
  const heLayers: HeDeconvPaint[] = [];
  const keep: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const split = id ? heDeconvByChannelId[id] : undefined;
    if (!id || !split) {
      keep.push(i);
      continue;
    }
    const hematoxylin = liveHeStain(split.hematoxylin, id, "hematoxylin", live);
    const eosin = liveHeStain(split.eosin, id, "eosin", live);
    // Splits made before the residual existed have none: use the default.
    const residual = liveHeStain(
      split.residual ?? defaultHeDeconvSplit().residual,
      id,
      "residual",
      live,
    );
    if (!hematoxylin.visible && !eosin.visible && !residual.visible) continue;
    heLayers.push({
      parentIndex: settings.selections[i]?.c ?? 0,
      sourceChannelId: id,
      mode: split.mode,
      hematoxylin,
      eosin,
      residual,
    });
  }
  if (keep.length === ids.length) return { settings, heLayers };
  const visibleFlags = settings.channelsVisible;
  return {
    settings: {
      ...settings,
      selections: keep.map((i) => settings.selections[i]),
      colors: keep.map((i) => settings.colors[i]),
      contrastLimits: keep.map((i) => settings.contrastLimits[i]),
      channelsVisible: visibleFlags
        ? keep.map((i) => visibleFlags[i] ?? true)
        : undefined,
      sourceChannelIds: keep.map((i) => ids[i]),
    },
    heLayers,
  };
}

function buildImageLayers(args: {
  dicomIndexList?: DicomIndex[];
  omeLoaderEntries?: OmeLoaderEntry[];
  jpegLoaderEntries?: JpegLoaderEntry[];
  dicomSettingsList?: unknown[];
  omeSettingsList?: unknown[];
  jpegSettingsList?: unknown[];
  remountKey?: string | number;
  images?: Image[];
  orientationPreview?: ImageOrientationPreview | null;
  opacityPreview?: ImageOpacityPreview | null;
  heDeconvByChannelId?: Record<string, HeDeconvSplit>;
  heStainFitByChannelId?: Record<string, HeStainFit>;
  channelRendering?: ChannelRendering | null;
}): Layer[] {
  const dicomIndexList = args.dicomIndexList ?? [];
  const omeLoaderEntries = args.omeLoaderEntries ?? [];
  const jpegLoaderEntries = args.jpegLoaderEntries ?? [];
  const dicomSettingsList = args.dicomSettingsList ?? [];
  const omeSettingsList = args.omeSettingsList ?? [];
  const jpegSettingsList = args.jpegSettingsList ?? [];
  const { images, orientationPreview, opacityPreview } = args;
  const opacityOf = (sourceImageId: string | undefined) =>
    opacityForImage(images, sourceImageId, opacityPreview);

  const stainChannelIds = new Set(
    images?.flatMap((im) =>
      im.channels.filter((ch) => ch.stain).map((ch) => ch.id),
    ),
  );
  // Stains multiply what is already drawn, so they paint after everything.
  const stains: Layer[] = [];
  /**
   * The fluorescence layer for `settings`. Its stain channels, if any, are
   * built the same way and set aside in `stains`.
   */
  const withStains = (
    settings: MainSettings,
    canStain: boolean,
    make: (settings: MainSettings, stain: boolean) => Layer | null,
  ): Layer[] => {
    const [fluorescence, stain] = canStain
      ? splitStainChannels(settings, stainChannelIds)
      : [settings, null];
    const layer = fluorescence && make(fluorescence, false);
    const stainLayer = stain && make(stain, true);
    if (stainLayer) stains.push(stainLayer);
    return layer ? [layer] : [];
  };

  let omeVisiblePainted = 0;
  const layers = [
    ...dicomIndexList.flatMap((entry, i) => {
      const settings = dicomSettingsList[i] as MainSettings | undefined;
      if (!settings?.selections?.length) return [];
      return withStains(settings, !isDicomRgb(entry), (part) =>
        createDicomTileLayer({
          entry,
          settings: part,
          remountKey: args.remountKey,
          orientation: orientationForImage(
            images,
            entry.sourceImageId,
            orientationPreview,
          ),
          opacity: opacityOf(entry.sourceImageId),
        }),
      );
    }),
    ...omeLoaderEntries.flatMap(({ loader, transfer, sourceImageId }, i) => {
      // Packed RGB draws through deck's BitmapLayer, which has no stain
      // shader, and is the only layout the H&E split reads.
      const packedRgb = isInterleaved(loader.data[0].shape);
      // Mask-only loaders have no intensity selections; painted by createMaskTileLayer.
      // H&E-split channels leave Viv's settings and paint as their own layer.
      const peeled = peelHeDeconvFromSettings(
        omeSettingsList[i] as MainSettings | undefined,
        packedRgb ? args.heDeconvByChannelId : undefined,
        args.channelRendering,
      );
      const settings = peeled.settings;
      const orientation = orientationForImage(
        images,
        sourceImageId,
        orientationPreview,
      );
      const opacity = opacityOf(sourceImageId);
      const canStain = !packedRgb;
      const out = settings?.selections?.length
        ? withStains(settings, canStain, (part, stain) =>
            createMultiscaleLayer({
              loader,
              settings: part,
              layerId: `mainLayer-${sourceImageId}`,
              remountKey: args.remountKey,
              ...(transfer ? { transfer } : {}),
              overlay: !stain && omeVisiblePainted++ > 0,
              orientation,
              opacity,
            }),
          )
        : [];
      const remount =
        args.remountKey === undefined ? "" : `-r${args.remountKey}`;
      for (const he of peeled.heLayers) {
        const layer = createHeDeconvLayer({
          id: `heDeconv-${sourceImageId}-${he.sourceChannelId}${remount}`,
          loader,
          parentIndex: he.parentIndex,
          mode: he.mode,
          hematoxylin: he.hematoxylin,
          eosin: he.eosin,
          residual: he.residual,
          overlay: omeVisiblePainted > 0,
          modelMatrix: layerModelMatrix(loader, orientation),
          opacity,
          stainInverse:
            args.heStainFitByChannelId?.[he.sourceChannelId]?.glslInverse,
        });
        if (layer) {
          out.push(layer);
          omeVisiblePainted += 1;
        }
      }
      return out;
    }),
    ...jpegLoaderEntries.flatMap((entry, i) => {
      const settings = jpegSettingsList[i] as MainSettings | undefined;
      if (!settings?.selections?.length) return [];
      return withStains(settings, true, (part) =>
        createEncodedImageLayer({
          entry,
          settings: part,
          remountKey: args.remountKey,
          orientation: orientationForImage(
            images,
            entry.sourceImageId,
            orientationPreview,
          ),
          opacity: opacityOf(entry.sourceImageId),
        }),
      );
    }),
  ];
  for (const layer of stains) {
    layers.push(
      layer.clone({
        id: `${layer.id}-stain`,
        ...stainLayerParameters(layers.length > 0),
      } as never),
    );
  }
  return layers;
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
  /** Document images (for per-image orientation → modelMatrix). */
  images?: Image[];
  /** Authoring: live orientation drag preview (CDN omits). */
  orientationPreview?: ImageOrientationPreview | null;
  /** Authoring: live image-opacity slider (CDN omits). */
  opacityPreview?: ImageOpacityPreview | null;
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
    images,
    orientationPreview = null,
    opacityPreview = null,
    remountKey,
  } = args;
  const heDeconvByChannelId = useAppStore((s) => s.heDeconvByChannelId);
  const heStainFitByChannelId = useAppStore((s) => s.heStainFitByChannelId);

  useEffect(() => {
    const ids = Object.keys(heDeconvByChannelId);
    if (ids.length === 0) return;
    let cancelled = false;

    for (const channelId of ids) {
      if (heStainFitByChannelId[channelId]) continue;
      const sc = sourceChannels.find((c) => c.id === channelId);
      if (!sc) continue;
      const entry = omeLoaderEntries.find(
        (e) => e.sourceImageId === sc.imageId,
      );
      if (!entry) continue;
      void ensureHeStainFit({
        loader: entry.loader,
        cacheKey: `${sc.imageId}:${sc.index}`,
        channelIndex: sc.index,
      }).then((fit) => {
        if (cancelled) return;
        const store = useAppStore.getState();
        if (!store.heDeconvByChannelId[channelId]) return;
        store.setHeStainFit(channelId, fit);
        if (!fit.failed) return;
        // A failed read still draws (default vectors, empty sparklines) until
        // the cache lets it be read again; dropping it then reruns this effect.
        setTimeout(() => {
          const app = useAppStore.getState();
          if (app.heStainFitByChannelId[channelId] === fit) {
            app.setHeStainFit(channelId, null);
          }
        }, RETRY_FAILED_AFTER_MS);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    heDeconvByChannelId,
    heStainFitByChannelId,
    omeLoaderEntries,
    sourceChannels,
  ]);

  // Histogram merges rewrite `sourceChannels` identity without changing Viv paint
  // inputs. Key config/settings/layers on a signature that omits distributions.
  const channelsSignature = buildImageViewerSignature(
    channelGroups,
    sourceChannels,
  );
  const channelsRef = useRef({ sourceChannels, channelGroups });
  channelsRef.current = { sourceChannels, channelGroups };

  const toDocSettings = useMemo(() => {
    // `channelsSignature` is the intentional memo key (histogram-stable).
    // Read channels from the ref so we close over the arrays from this signature.
    void channelsSignature;
    const { sourceChannels: sc, channelGroups: cg } = channelsRef.current;
    return toSettings({
      SourceChannels: sc,
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

  const { dicomSettingsList, omeSettingsList, jpegSettingsList } =
    useMemo(() => {
      const settingsFor = (
        modality: string,
        loader: Loader | undefined,
        sourceImageId?: string,
      ) =>
        toDocSettings(
          activeChannelGroupId,
          modality,
          loader,
          channelVisibilities,
          sourceImageId,
          channelGroupRowVisibilities,
        ) as MainSettings;

      return {
        dicomSettingsList: dicomIndexList.map(
          ({ loader, modality, sourceImageId }) =>
            settingsFor(modality, loader, sourceImageId || undefined),
        ),
        omeSettingsList: omeLoaderEntries.map(({ loader, sourceImageId }) =>
          settingsFor("Colorimetric", loader, sourceImageId),
        ),
        jpegSettingsList: jpegLoaderEntries.map(({ loader, sourceImageId }) =>
          settingsFor("Colorimetric", loader, sourceImageId),
        ),
      };
    }, [
      dicomIndexList,
      omeLoaderEntries,
      jpegLoaderEntries,
      toDocSettings,
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
        images,
        orientationPreview,
        opacityPreview,
        heDeconvByChannelId,
        heStainFitByChannelId,
        channelRendering,
      }),
    [
      dicomIndexList,
      omeLoaderEntries,
      jpegLoaderEntries,
      dicomSettingsWithLive,
      omeSettingsWithLive,
      jpegSettingsWithLive,
      remountKey,
      images,
      orientationPreview,
      opacityPreview,
      heDeconvByChannelId,
      heStainFitByChannelId,
      channelRendering,
    ],
  );

  return { loaderList, mainSettingsList, imageLayers };
}
