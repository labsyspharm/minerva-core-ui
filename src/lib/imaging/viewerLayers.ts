import type { Layer } from "@deck.gl/core";
import { isInterleaved, MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useEffect, useMemo, useRef } from "react";
import {
  bitmapLayerOpacity,
  type ImageOpacityPreview,
  imageFadeParameters,
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
import type {
  HeDeconvComponent,
  HeDeconvSplit,
  HeStainView,
} from "./heDeconvView";
import {
  ensureHeHistograms,
  ensureHeStainFit,
  type HeStainFit,
  stainInverseKey,
} from "./heStainFit";
import { orientationForImage } from "./imageOrientation";
import { createJpegLayers } from "./jpeg.js";
import { JPEG_BAKED_CONTRAST_LIMIT } from "./jpegPyramid";
import { ADDITIVE_BLEND_PARAMETERS } from "./pyramidTileLayer";
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

function createDicomTileLayer(args: {
  entry: DicomIndex;
  settings: unknown;
  remountKey?: string | number;
  orientation?: ImageOrientation | null;
  opacity: number;
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
    modelMatrix: layerModelMatrix(args.entry.loader, args.orientation),
    opacity: args.opacity,
  });
}

/** Later OME intensity layers: skip Viv's opaque background and add onto the base. */
const OME_INTENSITY_OVERLAY_PROPS = {
  refinementStrategy: "no-overlap" as const,
  parameters: {
    blend: true,
    ...ADDITIVE_BLEND_PARAMETERS,
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
  hematoxylin: HeStainView;
  eosin: HeStainView;
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
    if (!hematoxylin.visible && !eosin.visible) continue;
    heLayers.push({
      parentIndex: settings.selections[i]?.c ?? 0,
      sourceChannelId: id,
      hematoxylin,
      eosin,
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

  let omeVisiblePainted = 0;
  return [
    ...dicomIndexList.flatMap((entry, i) => {
      const settings = dicomSettingsList[i] as MainSettings | undefined;
      if (!settings?.selections?.length) return [];
      const layer = createDicomTileLayer({
        entry,
        settings,
        remountKey: args.remountKey,
        orientation: orientationForImage(
          images,
          entry.sourceImageId,
          orientationPreview,
        ),
        opacity: opacityOf(entry.sourceImageId),
      });
      if (!layer) return [];
      return [layer];
    }),
    ...omeLoaderEntries.flatMap(({ loader, transfer, sourceImageId }, i) => {
      const settings = omeSettingsList[i] as MainSettings | undefined;
      // Mask-only loaders have no intensity selections; painted by createMaskTileLayer.
      // H&E-split channels leave Viv's settings and paint as their own layer.
      const peeled = peelHeDeconvFromSettings(
        settings,
        args.heDeconvByChannelId,
        args.channelRendering,
      );
      const vivSettings = peeled.settings;
      if (!vivSettings?.selections?.length && !peeled.heLayers.length) {
        return [];
      }
      const overlay = omeVisiblePainted > 0;
      omeVisiblePainted += 1;
      const orientation = orientationForImage(
        images,
        sourceImageId,
        orientationPreview,
      );
      const opacity = opacityOf(sourceImageId);
      const remount =
        args.remountKey === undefined ? "" : `-r${args.remountKey}`;
      const out: Layer[] = [];
      if (vivSettings?.selections?.length) {
        out.push(
          createMultiscaleLayer({
            loader,
            settings: vivSettings,
            layerId: `mainLayer-${sourceImageId}`,
            remountKey: args.remountKey,
            overlay,
            orientation,
            opacity,
            ...(transfer ? { transfer } : {}),
          }),
        );
      }
      for (const he of peeled.heLayers) {
        const layer = createHeDeconvLayer({
          id: `heDeconv-${sourceImageId}-${he.sourceChannelId}${remount}`,
          loader,
          parentIndex: he.parentIndex,
          hematoxylin: he.hematoxylin,
          eosin: he.eosin,
          overlay: overlay || out.length > 0,
          modelMatrix: layerModelMatrix(loader, orientation),
          opacity,
          stainInverse:
            args.heStainFitByChannelId?.[he.sourceChannelId]?.glslInverse,
        });
        if (layer) out.push(layer);
      }
      return out;
    }),
    ...jpegLoaderEntries.flatMap((entry, i) => {
      const settings = jpegSettingsList[i] as MainSettings | undefined;
      if (!settings?.selections?.length) return [];
      return [
        createEncodedImageLayer({
          entry,
          settings,
          remountKey: args.remountKey,
          orientation: orientationForImage(
            images,
            entry.sourceImageId,
            orientationPreview,
          ),
          opacity: opacityOf(entry.sourceImageId),
        }),
      ];
    }),
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
  const heHistogramByChannelId = useAppStore((s) => s.heHistogramByChannelId);

  useEffect(() => {
    const ids = Object.keys(heDeconvByChannelId);
    if (ids.length === 0) return;
    let cancelled = false;

    for (const channelId of ids) {
      const sc = sourceChannels.find((c) => c.id === channelId);
      if (!sc) continue;
      const entry = omeLoaderEntries.find(
        (e) => e.sourceImageId === sc.imageId,
      );
      if (!entry) continue;
      const cacheKey = `${sc.imageId}:${sc.index}`;

      if (!heStainFitByChannelId[channelId]) {
        void ensureHeStainFit({
          loader: entry.loader,
          cacheKey,
          channelIndex: sc.index,
        }).then((fit) => {
          if (cancelled) return;
          const store = useAppStore.getState();
          if (!store.heDeconvByChannelId[channelId]) return;
          store.setHeStainFit(channelId, fit);
        });
        // Wait for fitted inverse before sampling histograms.
        continue;
      }

      const inverse = heStainFitByChannelId[channelId].glslInverse;
      const expectedKey = stainInverseKey(inverse);
      if (heHistogramByChannelId[channelId]?.fitKey === expectedKey) {
        continue;
      }

      void ensureHeHistograms({
        loader: entry.loader,
        cacheKey,
        channelIndex: sc.index,
        inverse,
      }).then((histogram) => {
        if (cancelled) return;
        const store = useAppStore.getState();
        if (!store.heDeconvByChannelId[channelId]) return;
        const current = store.heStainFitByChannelId[channelId]?.glslInverse;
        if (!current || stainInverseKey(current) !== histogram.fitKey) return;
        store.setHeHistogram(channelId, histogram);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    heDeconvByChannelId,
    heStainFitByChannelId,
    heHistogramByChannelId,
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
