import type { Layer } from "@deck.gl/core";
import { isInterleaved, MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useMemo, useRef } from "react";
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
import type {
  ChannelRendering,
  ImageOrientationPreview,
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
  if (!live) return settings;
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

/**
 * `settings` split into its fluorescence and its stain channels (either null
 * when empty), so each half fetches only its own planes.
 */
function splitStainChannels(
  settings: MainSettings,
  stainChannelIds: ReadonlySet<string>,
): [MainSettings | null, MainSettings | null] {
  const ids = settings.sourceChannelIds;
  if (!ids?.some((id) => stainChannelIds.has(id))) return [settings, null];
  const part = (stain: boolean): MainSettings | null => {
    const keep = ids.map((id) => stainChannelIds.has(id) === stain);
    if (!keep.includes(true)) return null;
    const pick = <T>(values: readonly T[]) => values.filter((_, i) => keep[i]);
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
  return [part(false), part(true)];
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
  /** Stain layer: whether anything is drawn below it to absorb from. */
  stainBelow?: boolean;
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
    ...(args.stainBelow === undefined
      ? {
          ...(args.overlay ? OME_INTENSITY_OVERLAY_PROPS : {}),
          ...imageFadeParameters(Boolean(args.overlay), args.opacity),
        }
      : stainLayerParameters(args.stainBelow)),
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
  stainBelow?: boolean;
  orientation?: ImageOrientation | null;
  opacity: number;
}): Layer {
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  const stain = args.stainBelow === undefined ? "" : "-stain";
  return createJpegLayers({
    jpegLoader: args.entry.loader.data,
    settings: args.settings,
    transfer: args.entry.transfer ?? "contrast",
    layerId: `jpeg-${args.entry.sourceImageId}${stain}${remount}`,
    modelMatrix: layerModelMatrix(args.entry.loader, args.orientation),
    opacity: args.opacity,
    stainBelow: args.stainBelow,
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
  images?: Image[];
  orientationPreview?: ImageOrientationPreview | null;
  opacityPreview?: ImageOpacityPreview | null;
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
  const stains: ((stainBelow: boolean) => Layer)[] = [];

  let omeVisiblePainted = 0;
  const painted = [
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
      if (!settings?.selections?.length) return [];
      const layerId = `mainLayer-${sourceImageId}`;
      const layerArgs = {
        loader,
        remountKey: args.remountKey,
        orientation: orientationForImage(
          images,
          sourceImageId,
          orientationPreview,
        ),
        opacity: opacityOf(sourceImageId),
        ...(transfer ? { transfer } : {}),
      };
      // Packed RGB draws through deck's BitmapLayer, which has no stain shader.
      const [fluorescence, stain] = isInterleaved(loader.data[0].shape)
        ? [settings, null]
        : splitStainChannels(settings, stainChannelIds);
      if (stain) {
        stains.push((stainBelow) =>
          createMultiscaleLayer({
            ...layerArgs,
            settings: stain,
            layerId: `${layerId}-stain`,
            stainBelow,
          }),
        );
      }
      if (!fluorescence) return [];
      const overlay = omeVisiblePainted > 0;
      omeVisiblePainted += 1;
      return [
        createMultiscaleLayer({
          ...layerArgs,
          settings: fluorescence,
          layerId,
          overlay,
        }),
      ];
    }),
    ...jpegLoaderEntries.flatMap((entry, i) => {
      const settings = jpegSettingsList[i] as MainSettings | undefined;
      if (!settings?.selections?.length) return [];
      const layerArgs = {
        entry,
        remountKey: args.remountKey,
        orientation: orientationForImage(
          images,
          entry.sourceImageId,
          orientationPreview,
        ),
        opacity: opacityOf(entry.sourceImageId),
      };
      const [fluorescence, stain] = splitStainChannels(
        settings,
        stainChannelIds,
      );
      if (stain) {
        stains.push((stainBelow) =>
          createEncodedImageLayer({
            ...layerArgs,
            settings: stain,
            stainBelow,
          }),
        );
      }
      return fluorescence
        ? [createEncodedImageLayer({ ...layerArgs, settings: fluorescence })]
        : [];
    }),
  ];
  return [
    ...painted,
    ...stains.map((make, i) => make(painted.length > 0 || i > 0)),
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
    ],
  );

  return { loaderList, mainSettingsList, imageLayers };
}
