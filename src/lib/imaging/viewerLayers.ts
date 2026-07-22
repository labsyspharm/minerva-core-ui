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
import { createTileLayers } from "./dicom.js";
import type { DicomIndex } from "./dicomIndex";
import { createJpegLayers } from "./jpeg.js";
import { type Config, type Loader, toSettings } from "./viv";

/** Fold live channel drag preview into Viv settings without writing the document. */
export function applyChannelRendering<S extends MainSettings>(
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

export function createMultiscaleLayer(args: {
  loader: Loader;
  settings: MainSettings | Record<string, unknown>;
  index: number;
  /** Appended to the layer id (e.g. after export remount). */
  remountKey?: string | number;
}): Layer {
  const selections =
    (args.settings as MainSettings | undefined)?.selections ?? [];
  const selectionId = selections.map(({ c }) => c).join("-");
  const remount = args.remountKey === undefined ? "" : `-r${args.remountKey}`;
  return new MultiscaleImageLayer({
    id: `mainLayer-${args.index}-${selectionId}${remount}`,
    ...args.settings,
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
  });
}

export function buildImageLayers(args: {
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

  // One global index across DICOM → OME → JPEG so layer ids stay unique and
  // align with loaderList / mainSettingsList order.
  let nextIndex = 0;
  return [
    ...dicomIndexList.map((entry, i) =>
      createDicomTileLayer({
        entry,
        settings: dicomSettingsList[i],
        index: nextIndex++,
        remountKey: args.remountKey,
      }),
    ),
    ...omeLoaderEntries.map(({ loader }, i) =>
      createMultiscaleLayer({
        loader,
        settings: omeSettingsList[i] as MainSettings,
        index: nextIndex++,
        remountKey: args.remountKey,
      }),
    ),
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
