import type { TiffPixelSource } from "@hms-dbmi/viv";
import { getImageSize } from "@hms-dbmi/viv";
import * as React from "react";
import { useMemo, useState } from "react";
import styled from "styled-components";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import { toLoader } from "@/lib/imaging/filesystem";
import {
  encodeTileJpeg,
  jpegExportConcurrency,
} from "@/lib/imaging/jpegExportPool";
import { jpegPyramidFolderName } from "@/lib/imaging/jpegPyramid";
import type { OmeLoaderEntry } from "@/lib/imaging/loaderEntries";
import type { Config } from "@/lib/imaging/viv";
import type { PoolClass } from "@/lib/imaging/workers/pool";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  type StoryExportMode,
  writeStoryBundleSidecars,
} from "@/lib/storyExport/storyBundle";

///

type Dtype =
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Int8"
  | "Int16"
  | "Int32"
  | "Float32"
  | "Float64";

type LoaderPlane = TiffPixelSource<string[]>;

type ToTilePlane = (z: number, l: LoaderPlane[]) => LoaderPlane;
type TileCounts = { x: number; y: number };
type TileCountsIn = {
  tileProps: TileProps;
  zoom: number;
};
type ToTileCounts = (i: TileCountsIn) => TileCounts;

type InitIn = {
  loader: LoaderPlane[];
  cRange: Index[];
};

type Progress = {
  completed: number;
  total: number;
  done: boolean;
  startedAt: number | null;
};

const formatMinutesLeft = (ms: number): string => {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m left";
  if (mins < 60) return `~${mins}m left`;
  const h = Math.floor(mins / 60);
  const rm = mins % 60;
  return rm > 0 ? `~${h}h ${rm}m left` : `~${h}h left`;
};

/** Remaining time from average tile throughput so far; null until first tile finishes. */
const estimateRemainingMs = (
  completed: number,
  total: number,
  startedAt: number | null,
  now: number,
): number | null => {
  if (startedAt === null || completed <= 0 || total <= completed) return null;
  const elapsed = now - startedAt;
  if (elapsed <= 0) return null;
  return ((total - completed) * elapsed) / completed;
};

const toSettingsInternal = (
  loader,
  modality,
  activeChannelGroupId,
  channelVisibilities,
  channelGroupRowVisibilities,
  toSettings,
  loaderSourceImageId?: string,
) => {
  if (loader === null) {
    return toSettings(
      activeChannelGroupId,
      modality,
      undefined,
      channelVisibilities,
      loaderSourceImageId,
      channelGroupRowVisibilities,
    );
  }
  return toSettings(
    activeChannelGroupId,
    modality,
    loader,
    channelVisibilities,
    loaderSourceImageId,
    channelGroupRowVisibilities,
  );
};

const toFilename = (index: Index) => {
  const level = -index.z;
  const { x, y } = index;
  return `${level}_${x}_${y}.jpg`;
};

const exportTile = async (
  index: Index,
  loader: LoaderPlane[],
  signal: AbortSignal,
) => {
  const filename = toFilename(index);
  const level = Math.abs(index.z);
  const z_loader = loader[level];
  const selection = { t: 0, z: 0, c: index.c };
  const { x, y } = index;
  const tile = await z_loader.getTile({
    selection,
    x,
    y,
    signal,
  });
  if (signal.aborted) return;
  const { width, height, data } = tile;
  const jpeg = await encodeTileJpeg({
    width,
    height,
    data: data as ArrayLike<number> & {
      buffer: ArrayBufferLike;
      byteOffset: number;
      byteLength: number;
    },
    lowerLimit: index.lowerLimit,
    upperLimit: index.upperLimit,
  });
  if (signal.aborted) return;
  const fh = await index.dh.getFileHandle(filename, { create: true });
  const write = await fh.createWritable();
  await write.write(jpeg);
  await write.close();
};

const createCRange = async (
  setCRange,
  channelGroups,
  imageChannels,
  directory_handle,
) => {
  const pending = channelGroups.flatMap(({ channels }) =>
    channels.map(async ({ channelId, lowerLimit, upperLimit }) => {
      const c = imageChannels[channelId];
      if (c === undefined) {
        return null;
      }
      const folderName = await jpegPyramidFolderName(
        channelId,
        lowerLimit,
        upperLimit,
      );
      const dh = await directory_handle.getDirectoryHandle(folderName, {
        create: true,
      });
      const fh = await dh.getFileHandle("settings.json", {
        create: true,
      });
      const write = await fh.createWritable();
      await write.write(
        JSON.stringify(
          {
            channel: c,
            channelId,
            lowerLimit,
            upperLimit,
          },
          null,
          2,
        ),
      );
      await write.close();
      return {
        z: 0,
        x: 0,
        y: 0,
        c,
        dh,
        encoded: folderName,
        lowerLimit,
        upperLimit,
      } as Index;
    }),
  );
  const resolved = await Promise.all(pending);
  setCRange(resolved.filter((v): v is Index => v !== null));
};

type TileProps = {
  id: string;
  dtype?: Dtype;
  tileSize: number;
  minZoom?: number;
  maxZoom?: number;
  extent?: [number, number, number, number];
};
type Index = {
  x: number;
  y: number;
  z: number;
  c: number;
  encoded: string;
  lowerLimit: number;
  upperLimit: number;
  dh: FileSystemDirectoryHandle;
};
type FullState = {
  indices: Index[];
  tileProps: TileProps;
};
type MainState = null | FullState;
type Initialize = (i: InitIn) => Partial<FullState>;

type One = [number];
type Two = [number, number];
type Three = [number, number, number];
type Four = [number, number, number, number];

function toTileScale(zoom: number, ...vals: One): One;
function toTileScale(zoom: number, ...vals: Two): Two;
function toTileScale(zoom: number, ...vals: Three): Three;
function toTileScale(zoom: number, ...vals: Four): Four;
function toTileScale(zoom: number, ...vals: number[]): number[] {
  const scale = 2 ** Math.abs(zoom);
  return vals.map((v) => {
    return v * scale;
  });
}

const toTilePlane: ToTilePlane = (zoom, loaders) => {
  return loaders[Math.max(0, Math.abs(zoom))];
};

const toTileLayer = (loader: LoaderPlane[]): TileProps => {
  const i = 0;
  const id = `Tiled-Image-${i}`;
  const plane = toTilePlane(0, loader);
  const { height, width } = getImageSize(plane);
  const extent: Four = [0, 0, width, height];
  const { tileSize, dtype } = plane;
  const props = {
    id,
    dtype,
    tileSize,
    extent,
    minZoom: -(loader.length - 1),
    maxZoom: 0,
  };
  return props;
};

const toTileCounts: ToTileCounts = ({ zoom, tileProps }) => {
  const { tileSize } = tileProps;
  const width = tileProps.extent[2];
  const height = tileProps.extent[3];
  const [ts] = toTileScale(zoom, tileSize);
  const y = Math.ceil(height / ts);
  const x = Math.ceil(width / ts);
  return { x, y };
};

const initialize: Initialize = (inputs) => {
  const { loader, cRange } = inputs;
  const tileProps = toTileLayer(loader);
  const mz = Math.abs(tileProps.minZoom || 0) + 1;
  const zoomRange = [...new Array(mz).keys()];
  const zr = zoomRange.reverse().map((z) => -z);
  const cRangeUnique = [] as Index[];
  const cEncodedSet = new Set();
  for (const index of cRange) {
    if (!index) continue;
    if (!cEncodedSet.has(index.encoded)) {
      cEncodedSet.add(index.encoded);
      cRangeUnique.push(index);
    }
  }
  const indices = ([] as Index[]).concat(
    ...zr.map((zoom) => {
      const counts = toTileCounts({ zoom, tileProps });
      const xRange = [...new Array(counts.x).keys()];
      const yRange = [...new Array(counts.y).keys()];
      return ([] as Index[]).concat(
        ...xRange.map((x) => {
          return ([] as Index[]).concat(
            ...yRange.map((y) => {
              return cRangeUnique.map((opts) => {
                return { ...opts, z: zoom, x, y };
              });
            }),
          );
        }),
      );
    }),
  );
  return { indices, tileProps };
};

function isFullState(o: Partial<FullState>): o is FullState {
  const needs: string[] = ["indices", "tileProps"];
  return needs.every((x: string) => x in o && o[x] !== null);
}

///

const ImageExporterDiv = styled.div`
  height: 100%;
  display: grid;
  grid-template-rows: 1fr auto 1fr;
  grid-template-columns: 1fr minmax(300px, 420px) 1fr;
  > div {
    grid-row: 2;
    grid-column: 2;
  }
`;

const ExportStatus = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25em;
`;

const ProgressBar = styled.div<ProgressBarProps>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5em;
  align-items: center;

  > div:first-child {
    box-sizing: border-box;
    height: 1.25em;
    border: 1px solid color-mix(in srgb, currentColor 85%, transparent);
    background-color: transparent;
    overflow: hidden;

    > div {
      height: 100%;
      width: ${(props) => `${Math.min(100, Math.max(0, props.$ratio * 100))}%`};
      background-color: ${(props) => to_color(props.$done) || "white"};
    }
  }

  > div:last-child {
    padding: 0.25em;
    font-family: monospace;
    white-space: nowrap;
  }
`;

const EtaLine = styled.div`
  font-family: monospace;
  font-size: 0.9em;
  text-align: center;
  opacity: 0.85;
`;

const ExportMessage = styled.div`
  grid-row: 2;
  grid-column: 2;
  padding: 0.5em 0.75em;
  font-family: monospace;
  text-align: center;
`;

const to_color = (done) => {
  if (done) {
    return "hwb(220 70% 30% / .9)";
  }
  return "hwb(220 10% 20% / .5)";
};

type LoaderOpts = {
  pool: PoolClass;
  handle: Handle.File | null;
};
interface ProgressBarProps {
  $ratio: number;
  $done: boolean;
}

const getLoader = async (opts: LoaderOpts) => {
  const { handle, pool } = opts;
  if (handle === null) return null;
  const in_file = await handle.getFile();
  const in_f = in_file.name;
  const loader = await toLoader({
    handle,
    in_f,
    pool,
  });
  const { data } = loader;
  return data;
};

export type ImageExporterProps = {
  in_f: string;
  handles: Handle.File[];
  directory_handle: Handle.Dir;
  stopExport: () => void;
  dicomIndexList: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
  viewerConfig: Config;
  /** Default: bake JPEG pyramids. `remote-url` writes sidecars only. */
  exportMode?: StoryExportMode;
};

export const ImageExporter = (props: ImageExporterProps) => {
  const _exportProps = {
    variant: "primary",
    className: "mb-3",
  };
  const { viewerConfig } = props;
  const { omeLoaderEntries, dicomIndexList } = props;
  const exportMode: StoryExportMode = props.exportMode ?? "jpeg-pyramid";

  const {
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
  } = useAppStore();

  const mainSettingsOmeList = useMemo(() => {
    const modality = "Colorimetric";
    return omeLoaderEntries.map(({ loader, sourceImageId }) =>
      toSettingsInternal(
        loader,
        modality,
        activeChannelGroupId,
        channelVisibilities,
        channelGroupRowVisibilities,
        viewerConfig.toSettings,
        sourceImageId,
      ),
    );
  }, [
    omeLoaderEntries,
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
    viewerConfig.toSettings,
  ]);

  const mainSettingsDicomList = useMemo(() => {
    return dicomIndexList.map((dicomIndex) => {
      const { modality } = dicomIndex;
      return toSettingsInternal(
        dicomIndex.loader,
        modality,
        activeChannelGroupId,
        channelVisibilities,
        channelGroupRowVisibilities,
        viewerConfig.toSettings,
      );
    });
  }, [
    dicomIndexList,
    activeChannelGroupId,
    channelVisibilities,
    channelGroupRowVisibilities,
    viewerConfig.toSettings,
  ]);

  const mainSettingsList = useMemo(
    () =>
      omeLoaderEntries.length > 0 ? mainSettingsOmeList : mainSettingsDicomList,
    [omeLoaderEntries, mainSettingsOmeList, mainSettingsDicomList],
  );

  const { handles, directory_handle } = props;
  const handle = handles ? handles[0] : null; //TODO
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const imageChannels = useMemo(() => {
    return Object.fromEntries(
      [].concat(
        ...images.map(({ channels }) => {
          return channels.map(({ id, index }) => [id, index]);
        }),
      ),
    );
  }, [images]);
  const [progress, setProgress] = useState<Progress>({
    completed: 0,
    total: 0,
    done: false,
    startedAt: null,
  });
  const [nowMs, setNowMs] = useState(() => performance.now());
  const [cRange, setCRange] = useState<Index[] | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const hasChannelGroup =
    channelGroups.length > 0 &&
    channelGroups.some((g) => g.channels.length > 0);

  React.useEffect(() => {
    if (exportMode === "remote-url") {
      setCRange([]);
      return;
    }
    if (!hasChannelGroup) {
      setCRange([]);
      setExportError(
        "Add a channel group with at least one channel before exporting.",
      );
      return;
    }
    setExportError(null);
    createCRange(setCRange, channelGroups, imageChannels, directory_handle);
  }, [
    channelGroups,
    imageChannels,
    directory_handle,
    hasChannelGroup,
    exportMode,
  ]);
  const loader = useMemo(
    () =>
      mainSettingsList.length > 0 ? mainSettingsList[0].loader.data : null,
    [mainSettingsList],
  );

  const state: MainState = useMemo(() => {
    if (exportMode === "remote-url") return null;
    if (loader === null || cRange === null) {
      return null;
    }
    const init = initialize({ loader, cRange });
    if (isFullState(init) && loader?.length) {
      return init;
    }
    return null;
  }, [loader, cRange, exportMode]);

  const stopExport = props.stopExport;

  React.useEffect(() => {
    if (exportMode !== "remote-url") return;
    if (exportError) {
      const t = setTimeout(() => stopExport(), 2000);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const wallStart = performance.now();
    setProgress({ completed: 0, total: 1, done: false, startedAt: wallStart });
    void (async () => {
      try {
        await writeStoryBundleSidecars(
          directory_handle,
          useDocumentStore.getState().toDocumentData(),
          { mode: "remote-url" },
        );
        if (cancelled) return;
        setProgress({
          completed: 1,
          total: 1,
          done: true,
          startedAt: wallStart,
        });
        setTimeout(() => stopExport(), 1500);
      } catch (e) {
        if (cancelled) return;
        console.error("[minerva] failed to write story bundle sidecars", e);
        setExportError(
          e instanceof Error
            ? e.message
            : "Failed to write document.json / index.html",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exportMode, directory_handle, stopExport, exportError]);

  React.useEffect(() => {
    if (exportMode === "remote-url") return;
    if (exportError) {
      const t = setTimeout(() => stopExport(), 2000);
      return () => clearTimeout(t);
    }
    if (!state || !loader?.length) return;
    if (cRange !== null && cRange.length === 0) {
      setExportError("No exportable channels in the current channel groups.");
      return;
    }
    if (state.indices.length === 0) {
      setExportError("No exportable channels in the current channel groups.");
      return;
    }

    let cancelled = false;
    let finishedOk = false;
    const abort = new AbortController();
    const indices = state.indices;
    const total = indices.length;
    const wallStart = performance.now();

    setProgress({ completed: 0, total, done: false, startedAt: wallStart });

    const etaInterval = window.setInterval(() => {
      if (!cancelled) setNowMs(performance.now());
    }, 1000);

    const run = async () => {
      let nextIndex = 0;
      let completed = 0;
      const concurrency = Math.min(jpegExportConcurrency(), total);

      const workerLoop = async () => {
        while (!cancelled && !abort.signal.aborted) {
          const i = nextIndex++;
          if (i >= total) return;
          const index = indices[i];
          try {
            await exportTile(index, loader, abort.signal);
          } catch (e) {
            if (abort.signal.aborted || cancelled) return;
            console.error(e instanceof Error ? e.message : e);
            try {
              await exportTile(index, loader, abort.signal);
            } catch (e2) {
              console.error(e2 instanceof Error ? e2.message : e2);
            }
          }
          if (cancelled) return;
          completed += 1;
          setProgress({
            completed,
            total,
            done: completed >= total,
            startedAt: wallStart,
          });
        }
      };

      await Promise.all(
        Array.from({ length: concurrency }, () => workerLoop()),
      );

      if (!cancelled) {
        finishedOk = true;
        console.log(
          `[minerva] jpeg-export took ${((performance.now() - wallStart) / 1000).toFixed(1)}s (${concurrency} workers, ${total} tiles)`,
        );
        try {
          await writeStoryBundleSidecars(
            directory_handle,
            useDocumentStore.getState().toDocumentData(),
            { mode: "jpeg-pyramid" },
          );
        } catch (e) {
          console.error("[minerva] failed to write story bundle sidecars", e);
          setExportError(
            e instanceof Error
              ? e.message
              : "Failed to write document.json / index.html",
          );
          return;
        }
        setProgress({
          completed: total,
          total,
          done: true,
          startedAt: wallStart,
        });
        setTimeout(() => stopExport(), 2000);
      }
    };

    run();

    return () => {
      cancelled = true;
      window.clearInterval(etaInterval);
      // Avoid aborting the shared Viv loader after a successful export.
      if (!finishedOk) abort.abort();
    };
  }, [
    state,
    loader,
    stopExport,
    cRange,
    exportError,
    directory_handle,
    exportMode,
  ]);

  const { completed, total, done, startedAt } = progress;
  let ratio = done ? 1 : 0;
  if (!done && total > 1) {
    ratio = completed / total;
  } else if (!done && total === 1 && completed === 1) {
    ratio = 1;
  } else if (!done && total === 1) {
    ratio = 0;
  }

  const remainingMs = estimateRemainingMs(
    completed,
    total,
    startedAt,
    Math.max(nowMs, performance.now()),
  );
  const percentLabel = `${(ratio * 100).toFixed(3)}%`;
  let etaLabel = "";
  if (done) {
    etaLabel = "done";
  } else if (remainingMs !== null) {
    etaLabel = formatMinutesLeft(remainingMs);
  } else if (total > 0) {
    etaLabel = "estimating…";
  }

  return (
    <ImageExporterDiv>
      {exportError ? (
        <ExportMessage>{exportError}</ExportMessage>
      ) : exportMode === "remote-url" ? (
        <ExportStatus>
          <ExportMessage>
            {done
              ? "Exported document.json + index.html (remote URLs)"
              : "Writing document.json + index.html…"}
          </ExportMessage>
        </ExportStatus>
      ) : (
        <ExportStatus>
          <ProgressBar $ratio={ratio} $done={done}>
            <div>
              <div></div>
            </div>
            <div> {percentLabel} </div>
          </ProgressBar>
          {etaLabel ? <EtaLine>{etaLabel}</EtaLine> : null}
        </ExportStatus>
      )}
    </ImageExporterDiv>
  );
};
