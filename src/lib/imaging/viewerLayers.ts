import type { Layer } from "@deck.gl/core";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useMemo } from "react";
import type {
  JpegLoaderEntry,
  LoaderList,
  MainSettings,
  OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { createTileLayers } from "./dicom.js";
import type { DicomIndex } from "./dicomIndex";
import { createJpegLayers } from "./jpeg.js";
import { type Config, type Loader, toSettings } from "./viv";

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

/** Settings, loader list, and layers for document-backed playback. */
export function useViewerLayers(args: {
  dicomIndexList?: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
  jpegLoaderEntries: JpegLoaderEntry[];
  sourceChannels: Channel[];
  channelGroups: ChannelGroup[];
  activeChannelGroupId: string | null;
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities: Record<string, boolean>;
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
  } = args;

  const viewerConfig = useMemo(
    () => createViewerConfigFromDocument({ sourceChannels, channelGroups }),
    [sourceChannels, channelGroups],
  );

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

  const mainSettingsList = useMemo(
    () => [...dicomSettingsList, ...omeSettingsList, ...jpegSettingsList],
    [dicomSettingsList, omeSettingsList, jpegSettingsList],
  );

  const imageLayers = useMemo(
    () =>
      buildImageLayers({
        dicomIndexList,
        omeLoaderEntries,
        jpegLoaderEntries,
        dicomSettingsList,
        omeSettingsList,
        jpegSettingsList,
      }),
    [
      dicomIndexList,
      omeLoaderEntries,
      jpegLoaderEntries,
      dicomSettingsList,
      omeSettingsList,
      jpegSettingsList,
    ],
  );

  return { viewerConfig, loaderList, mainSettingsList, imageLayers };
}
