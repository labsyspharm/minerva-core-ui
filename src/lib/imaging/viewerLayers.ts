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
import { type Loader, TILE_CACHE_PROPS, toSettings } from "./viv";
import { inheritUnitlessPhysicalSize, layerModelMatrix } from "./worldFrame";

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
    modelMatrix: layerModelMatrix(args.entry.loader),
  });
}

/** Later OME intensity layers: skip Viv's opaque background and add onto the base. */
const OME_INTENSITY_OVERLAY_PROPS = {
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
    ...TILE_CACHE_PROPS,
    // Viv's overview ImageLayer getRaster()s the full coarsest plane; isLoaded
    // waits on that decode even after tiles have painted.
    excludeBackground: true,
    ...(args.overlay ? OME_INTENSITY_OVERLAY_PROPS : {}),
    loader: args.loader.data,
    modelMatrix: layerModelMatrix(args.loader),
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
    modelMatrix: layerModelMatrix(args.entry.loader),
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
      const overlay = omeVisiblePainted > 0;
      omeVisiblePainted += 1;
      return [
        createMultiscaleLayer({
          loader,
          settings,
          layerId: `mainLayer-${sourceImageId}`,
          remountKey: args.remountKey,
          overlay,
          ...(transfer ? { transfer } : {}),
        }),
      ];
    }),
    ...jpegLoaderEntries.flatMap((entry, i) => {
      const settings = jpegSettingsList[i] as MainSettings | undefined;
      if (!settings?.selections?.length) return [];
      return [
        createEncodedImageLayer({
          entry,
          settings,
          remountKey: args.remountKey,
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

  return { loaderList, mainSettingsList, imageLayers };
}
