import type { Layer } from "@deck.gl/core";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useEffect, useMemo, useRef } from "react";
import type {
  JpegLoaderEntry,
  LoaderList,
  MainSettings,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import { type ChannelRendering, useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { buildImageViewerSignature } from "@/lib/viewer/imageViewerSignature";
import type { JpegExportTransfer } from "./cubeRootEncoding";
import { createTileLayers } from "./dicom.js";
import type { DicomIndex } from "./dicomIndex";
import {
  createHeDeconvLayer,
  type HeDeconvComponent,
  type HeDeconvSplit,
  type HeStainView,
} from "./hedDeconvTileLayer";
import {
  DEFAULT_STAIN_INVERSE,
  ensureHeHistograms,
  ensureHeStainFit,
  type HeStainFit,
  stainInverseKey,
} from "./heStainFit";
import { createJpegLayers } from "./jpeg.js";
import { JPEG_BAKED_CONTRAST_LIMIT } from "./jpegPyramid";
import { type Config, type Loader, toSettings } from "./viv";

/** Fold live channel drag preview into Viv settings without writing the document. */
export function applyChannelRendering<S extends MainSettings>(
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

export type ViewerLoaderSources = {
  dicomIndexList?: DicomIndex[];
  omeLoaderEntries?: OmeLoaderEntry[];
  jpegLoaderEntries?: JpegLoaderEntry[];
};

/** Loader-list rows in paint order: DICOM → OME → encoded pyramids. */
export function loaderListFromEntries(
  sources: ViewerLoaderSources,
): LoaderList {
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

export function createViewerConfigFromDocument(args: {
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

export function createDicomTileLayer(args: {
  entry: DicomIndex;
  settings: unknown;
  index: number;
  remountKey?: string | number;
}): Layer {
  const rgbImage = args.entry.modality === "Brightfield";
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  return createTileLayers({
    pyramids: args.entry.pyramids,
    dicomLoader: args.entry.loader,
    settings: args.settings,
    rgbImage,
    imageID: `dicom-${args.entry.series}-${args.index}${remount}`,
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

export function createMultiscaleLayer(args: {
  loader: Loader;
  settings: MainSettings | Record<string, unknown>;
  index: number;
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
  const selections = settings.selections ?? [];
  const selectionId = selections.map(({ c }) => c).join("-");
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  return new MultiscaleImageLayer({
    id: `mainLayer-${args.index}-${selectionId}${remount}`,
    ...settings,
    ...(args.overlay ? OME_INTENSITY_OVERLAY_PROPS : {}),
    loader: args.loader.data,
  } as never);
}

export function createEncodedImageLayer(args: {
  entry: JpegLoaderEntry;
  settings: unknown;
}): Layer {
  return createJpegLayers({
    jpegLoader: args.entry.loader.data,
    settings: args.settings,
    imagePath: args.entry.imagePath ?? ".",
    channelFolders: args.entry.channelFolders ?? {},
    transfer: args.entry.transfer ?? "contrast",
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

export function buildImageLayers(args: {
  dicomIndexList?: DicomIndex[];
  omeLoaderEntries?: OmeLoaderEntry[];
  jpegLoaderEntries?: JpegLoaderEntry[];
  dicomSettingsList?: unknown[];
  omeSettingsList?: unknown[];
  jpegSettingsList?: unknown[];
  remountKey?: string | number;
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

  // One global index across DICOM → OME → JPEG so layer ids stay unique and
  // align with loaderList / mainSettingsList order.
  let nextIndex = 0;
  let omeIntensityPainted = 0;
  return [
    ...dicomIndexList.map((entry, i) =>
      createDicomTileLayer({
        entry,
        settings: dicomSettingsList[i],
        index: nextIndex++,
        remountKey: args.remountKey,
      }),
    ),
    ...omeLoaderEntries.flatMap(({ loader, transfer }, i) => {
      const settings = omeSettingsList[i] as MainSettings | undefined;
      // Mask-only loaders have no intensity selections; painted by createMaskTileLayer.
      const peeled = peelHeDeconvFromSettings(
        settings,
        args.heDeconvByChannelId,
        args.channelRendering,
      );
      const vivSettings = peeled.settings;
      if (!vivSettings?.selections?.length && !peeled.heLayers.length) {
        return [];
      }
      const overlay = omeIntensityPainted > 0;
      omeIntensityPainted += 1;
      const remount =
        args.remountKey === undefined ? "" : `-r${args.remountKey}`;
      const out: Layer[] = [];
      if (vivSettings?.selections?.length) {
        out.push(
          createMultiscaleLayer({
            loader,
            settings: vivSettings,
            index: nextIndex,
            remountKey: args.remountKey,
            overlay,
            ...(transfer ? { transfer } : {}),
          }),
        );
      }
      for (const he of peeled.heLayers) {
        const layer = createHeDeconvLayer({
          id: `heDeconv-${i}${remount}`,
          loader,
          parentIndex: he.parentIndex,
          hematoxylin: he.hematoxylin,
          eosin: he.eosin,
          overlay: overlay || out.length > 0,
          stainInverse:
            args.heStainFitByChannelId?.[he.sourceChannelId]?.glslInverse,
        });
        if (layer) out.push(layer);
      }
      nextIndex += 1;
      return out;
    }),
    ...jpegLoaderEntries.map((entry, i) =>
      createEncodedImageLayer({
        entry,
        settings: jpegSettingsList[i],
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
  const heDeconvByChannelId = useAppStore((s) => s.heDeconvByChannelId);
  const heStainFitByChannelId = useAppStore((s) => s.heStainFitByChannelId);
  const heHistogramByChannelId = useAppStore((s) => s.heHistogramByChannelId);

  useEffect(() => {
    const ids = Object.keys(heDeconvByChannelId);
    if (ids.length === 0) return;
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
          useAppStore.getState().setHeStainFit(channelId, fit);
        });
      }
      const inverse =
        heStainFitByChannelId[channelId]?.glslInverse ?? DEFAULT_STAIN_INVERSE;
      if (
        heHistogramByChannelId[channelId]?.fitKey === stainInverseKey(inverse)
      ) {
        continue;
      }
      void ensureHeHistograms({
        loader: entry.loader,
        cacheKey,
        channelIndex: sc.index,
        inverse,
      }).then((histogram) => {
        useAppStore.getState().setHeHistogram(channelId, histogram);
      });
    }
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

  const dicomSettingsList = useMemo(
    () =>
      dicomIndexList.map(({ loader, modality, sourceImageId }) =>
        viewerConfig.toSettings(
          activeChannelGroupId,
          modality,
          loader,
          channelVisibilities,
          sourceImageId || undefined,
          channelGroupRowVisibilities,
        ),
      ),
    [
      dicomIndexList,
      viewerConfig,
      activeChannelGroupId,
      channelVisibilities,
      channelGroupRowVisibilities,
    ],
  );

  const omeSettingsList = useMemo(
    () =>
      omeLoaderEntries.map(({ loader, sourceImageId }) =>
        viewerConfig.toSettings(
          activeChannelGroupId,
          "Colorimetric",
          loader,
          channelVisibilities,
          sourceImageId,
          channelGroupRowVisibilities,
        ),
      ),
    [
      omeLoaderEntries,
      viewerConfig,
      activeChannelGroupId,
      channelVisibilities,
      channelGroupRowVisibilities,
    ],
  );

  const jpegSettingsList = useMemo(
    () =>
      jpegLoaderEntries.map(({ loader, sourceImageId }) =>
        viewerConfig.toSettings(
          activeChannelGroupId,
          "Colorimetric",
          loader,
          channelVisibilities,
          sourceImageId,
          channelGroupRowVisibilities,
        ),
      ),
    [
      jpegLoaderEntries,
      viewerConfig,
      activeChannelGroupId,
      channelVisibilities,
      channelGroupRowVisibilities,
    ],
  );

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
      heDeconvByChannelId,
      heStainFitByChannelId,
      channelRendering,
    ],
  );

  return { viewerConfig, loaderList, mainSettingsList, imageLayers };
}
