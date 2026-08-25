import type { Layer } from "@deck.gl/core";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useMemo, useRef } from "react";
import type {
  JpegLoaderEntry,
  LoaderList,
  MainSettings,
  OmeLoaderEntry,
} from "@/lib/imaging/loaderEntries";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { createTileLayers } from "./dicom.js";
import type { DicomIndex } from "./dicomIndex";
import { createJpegLayers } from "./jpeg.js";
import { type Config, type Loader, toSettings } from "./viv";

type SelectionPick = { c: number; z?: number; t?: number };

type VivSettings = MainSettings & {
  loader?: unknown;
  selections: readonly SelectionPick[];
};

function samePicks(
  a: readonly SelectionPick[],
  b: readonly SelectionPick[],
): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => s.c === b[i].c && s.z === b[i].z && s.t === b[i].t)
  );
}

function sameTuples(
  a: readonly number[][] | undefined,
  b: readonly number[][] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (tuple, i) =>
      tuple.length === b[i].length && tuple.every((n, j) => n === b[i][j]),
  );
}

/**
 * Viv reloads tiles when `selections` is a new array. Color/contrast are
 * uniforms — reuse the previous selections (and the whole settings object when
 * paint is unchanged) so the layer stack stays put.
 */
function keepStableSelections<S extends VivSettings>(
  next: S,
  prev: S | undefined,
): S {
  if (!prev || prev.loader !== next.loader) return next;
  if (!samePicks(prev.selections, next.selections)) return next;
  const visA = prev.channelsVisible ?? [];
  const visB = next.channelsVisible ?? [];
  const visSame =
    visA.length === visB.length && visA.every((v, i) => v === visB[i]);
  if (
    visSame &&
    sameTuples(prev.colors, next.colors) &&
    sameTuples(prev.contrastLimits, next.contrastLimits)
  ) {
    return prev;
  }
  return { ...next, selections: prev.selections };
}

function stabilizeSettingsList<S extends VivSettings>(
  nextList: S[],
  prevList: readonly S[],
): S[] {
  const out = nextList.map((next, i) =>
    keepStableSelections(next, prevList[i]),
  );
  if (
    out.length === prevList.length &&
    out.every((settings, i) => settings === prevList[i])
  ) {
    return prevList as S[];
  }
  return out;
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
    remountKey,
  } = args;

  const viewerConfig = useMemo(
    () =>
      createViewerConfigFromDocument({
        sourceChannels,
        channelGroups,
      }),
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

  const prevSettingsRef = useRef({
    dicom: [] as VivSettings[],
    ome: [] as VivSettings[],
    jpeg: [] as VivSettings[],
  });

  const { dicomSettingsList, omeSettingsList, jpegSettingsList } =
    useMemo(() => {
      const dicom = stabilizeSettingsList(
        dicomIndexList.map(({ loader, modality, sourceImageId }) =>
          viewerConfig.toSettings(
            activeChannelGroupId,
            modality,
            loader,
            channelVisibilities,
            sourceImageId || undefined,
            channelGroupRowVisibilities,
          ),
        ) as VivSettings[],
        prevSettingsRef.current.dicom,
      );
      const ome = stabilizeSettingsList(
        omeLoaderEntries.map(({ loader, sourceImageId }) =>
          viewerConfig.toSettings(
            activeChannelGroupId,
            "Colorimetric",
            loader,
            channelVisibilities,
            sourceImageId,
            channelGroupRowVisibilities,
          ),
        ) as VivSettings[],
        prevSettingsRef.current.ome,
      );
      const jpeg = stabilizeSettingsList(
        jpegLoaderEntries.map(({ loader, sourceImageId }) =>
          viewerConfig.toSettings(
            activeChannelGroupId,
            "Colorimetric",
            loader,
            channelVisibilities,
            sourceImageId,
            channelGroupRowVisibilities,
          ),
        ) as VivSettings[],
        prevSettingsRef.current.jpeg,
      );
      prevSettingsRef.current = { dicom, ome, jpeg };
      return {
        dicomSettingsList: dicom,
        omeSettingsList: ome,
        jpegSettingsList: jpeg,
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
        remountKey,
      }),
    [
      dicomIndexList,
      omeLoaderEntries,
      jpegLoaderEntries,
      dicomSettingsList,
      omeSettingsList,
      jpegSettingsList,
      remountKey,
    ],
  );

  return { viewerConfig, loaderList, mainSettingsList, imageLayers };
}
