import type { TiffPixelSource } from "@hms-dbmi/viv";
import { getImageSize } from "@hms-dbmi/viv";
import * as React from "react";
import { type CSSProperties, useMemo, useState } from "react";
import {
  folderLimitsForTransfer,
  imageSourceFromJpegTransfer,
  imageSourceFromOmeTiffTransfer,
  isJpegOmeTiffImageSource,
  type JpegExportTransfer,
  jpegTransferFromImageSource,
} from "@/lib/imaging/cubeRootEncoding";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import { exportJpegOmeTiffStory } from "@/lib/imaging/exportJpegOmeTiff";
import {
  encodeTileJpeg,
  jpegExportConcurrency,
} from "@/lib/imaging/jpegExportPool";
import { jpegPyramidFolderName } from "@/lib/imaging/jpegPyramid";
import type { OmeLoaderEntry } from "@/lib/imaging/loaderEntries";
import type { Config } from "@/lib/imaging/viv";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  type StoryExportMode,
  writeStoryBundleSidecars,
} from "@/lib/storyExport/storyBundle";
import styles from "./ImageExporter.module.css";

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
  return toSettings(
    activeChannelGroupId,
    modality,
    loader ?? undefined,
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
  transfer: JpegExportTransfer,
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
    transfer,
  });
  if (signal.aborted) return;
  const fh = await index.dh.getFileHandle(filename, { create: true });
  const write = await fh.createWritable();
  await write.write(jpeg);
  await write.close();
};

const createCRange = async (
  channelGroups,
  imageChannels,
  directory_handle,
  transfer: JpegExportTransfer,
): Promise<Index[]> => {
  const pending = channelGroups.flatMap(({ channels }) =>
    channels.map(async ({ channelId, lowerLimit, upperLimit }) => {
      const c = imageChannels[channelId];
      if (c === undefined) {
        return null;
      }
      const folderLimits = folderLimitsForTransfer(
        transfer,
        lowerLimit,
        upperLimit,
      );
      const folderName = await jpegPyramidFolderName(
        channelId,
        folderLimits.lowerLimit,
        folderLimits.upperLimit,
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
  return resolved.filter((v): v is Index => v !== null);
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

type Four = [number, number, number, number];

function toTileScale(zoom: number, value: number): number {
  return value * 2 ** Math.abs(zoom);
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
  const ts = toTileScale(zoom, tileSize);
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

export type ImageExporterProps = {
  directory_handle: Handle.Dir;
  stopExport: () => void;
  dicomIndexList: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
  viewerConfig: Config;
  /** Default: bake JPEG pyramids. `remote-url` writes sidecars only. */
  exportMode?: StoryExportMode;
  /** When set, offer a document.json-only update (current transfer only). */
  onDocumentOnlyUpdate?: () => Promise<void>;
};

export const ImageExporter = (props: ImageExporterProps) => {
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

  const { directory_handle } = props;
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
  const [jpegTransfer, setJpegTransfer] = useState<JpegExportTransfer>(() =>
    jpegTransferFromImageSource(
      useDocumentStore.getState().metadata.imageSource,
    ),
  );
  /** Session mode: props.exportMode, or jpeg-ome-tiff when that option is checked. */
  const [mode, setMode] = useState<StoryExportMode>(() => {
    if (exportMode === "remote-url") return "remote-url";
    // Prefer last published format so re-export still shows the confirm UI
    // with the previous choice preselected.
    if (
      isJpegOmeTiffImageSource(useDocumentStore.getState().metadata.imageSource)
    ) {
      return "jpeg-ome-tiff";
    }
    return exportMode;
  });
  const [exportArmed, setExportArmed] = useState(false);
  /** Frozen at Start so post-export store updates cannot re-trigger the job. */
  const armedSnapshotRef = React.useRef<{
    omeLoaderEntries: OmeLoaderEntry[];
    dicomIndexList: DicomIndex[];
  } | null>(null);

  const docTransfer = jpegTransferFromImageSource(
    useDocumentStore((s) => s.metadata.imageSource),
  );
  const canUpdateDocumentOnly =
    !!props.onDocumentOnlyUpdate &&
    mode === "jpeg-pyramid" &&
    jpegTransfer === docTransfer;

  const armExport = () => {
    armedSnapshotRef.current = { omeLoaderEntries, dicomIndexList };
    setExportArmed(true);
  };

  const hasChannelGroup =
    channelGroups.length > 0 &&
    channelGroups.some((g) => g.channels.length > 0);

  React.useEffect(() => {
    if (mode === "remote-url" || mode === "jpeg-ome-tiff") {
      setCRange([]);
      return;
    }
    if (!exportArmed) {
      setCRange(null);
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
    let cancelled = false;
    void createCRange(
      channelGroups,
      imageChannels,
      directory_handle,
      jpegTransfer,
    )
      .then((range) => {
        if (!cancelled) setCRange(range);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[minerva] jpeg export setup failed", e);
        setExportError(
          e instanceof Error ? e.message : "Failed to prepare JPEG export",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    channelGroups,
    imageChannels,
    directory_handle,
    hasChannelGroup,
    mode,
    exportArmed,
    jpegTransfer,
  ]);
  const loader = useMemo(
    () =>
      mainSettingsList.length > 0 ? mainSettingsList[0].loader.data : null,
    [mainSettingsList],
  );

  const state: MainState = useMemo(() => {
    if (mode !== "jpeg-pyramid" || !exportArmed) return null;
    if (loader === null || cRange === null) {
      return null;
    }
    const init = initialize({ loader, cRange });
    if (isFullState(init) && loader?.length) {
      return init;
    }
    return null;
  }, [loader, cRange, mode, exportArmed]);

  const stopExport = props.stopExport;

  React.useEffect(() => {
    if (mode !== "remote-url") return;
    if (exportError) return;
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
  }, [mode, directory_handle, exportError]);

  React.useEffect(() => {
    if (mode !== "jpeg-ome-tiff" || !exportArmed || exportError) return;

    const snap = armedSnapshotRef.current;
    if (!snap) return;

    let cancelled = false;
    let finishedOk = false;
    const abort = new AbortController();
    const wallStart = performance.now();
    const loaderEntries: OmeLoaderEntry[] =
      snap.omeLoaderEntries.length > 0
        ? snap.omeLoaderEntries
        : snap.dicomIndexList
            .filter((d) => d.sourceImageId)
            .map((d) => ({
              loader: d.loader as OmeLoaderEntry["loader"],
              sourceImageId: d.sourceImageId as string,
            }));
    const imagesSnapshot = useDocumentStore.getState().images;
    const channelGroupsSnapshot = useDocumentStore.getState().channelGroups;

    setProgress({ completed: 0, total: 1, done: false, startedAt: wallStart });

    const etaInterval = window.setInterval(() => {
      if (!cancelled) setNowMs(performance.now());
    }, 1000);

    void (async () => {
      try {
        const remappedImages = await exportJpegOmeTiffStory({
          directory: directory_handle,
          omeLoaderEntries: loaderEntries,
          images: imagesSnapshot,
          channelGroups: channelGroupsSnapshot,
          transfer: jpegTransfer,
          signal: abort.signal,
          onProgress: (completed, total) => {
            if (cancelled) return;
            setProgress({
              completed,
              total: Math.max(total, 1),
              done: false,
              startedAt: wallStart,
            });
          },
        });
        if (cancelled) return;
        finishedOk = true;
        const nextSource = imageSourceFromOmeTiffTransfer(jpegTransfer);
        const baseDoc = useDocumentStore.getState().toDocumentData();
        const doc = {
          ...baseDoc,
          images: remappedImages,
          metadata: {
            ...baseDoc.metadata,
            imageSource: nextSource,
          },
        };
        await writeStoryBundleSidecars(directory_handle, doc, {
          mode: "jpeg-ome-tiff",
        });
        const store = useDocumentStore.getState();
        store.setImages(remappedImages);
        store.setMetadata({
          imageSource: nextSource,
        });
        console.log(
          `[minerva] jpeg-ome-tiff export took ${((performance.now() - wallStart) / 1000).toFixed(1)}s (transfer=${jpegTransfer})`,
        );
        setProgress((p) => ({
          ...p,
          done: true,
          completed: p.total,
        }));
      } catch (e) {
        if (cancelled || abort.signal.aborted) return;
        console.error("[minerva] jpeg-ome-tiff export failed", e);
        setExportError(
          e instanceof Error ? e.message : "Failed to export OME-TIFF",
        );
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(etaInterval);
      if (!finishedOk) abort.abort();
    };
  }, [mode, exportArmed, exportError, directory_handle, jpegTransfer]);

  React.useEffect(() => {
    if (mode !== "jpeg-pyramid" || !exportArmed || exportError) return;
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
      let exportFailed: Error | null = null;
      const concurrency = Math.min(jpegExportConcurrency(), total);

      const failExport = (e: unknown) => {
        if (exportFailed || cancelled) return;
        exportFailed =
          e instanceof Error ? e : new Error(String(e ?? "JPEG export failed"));
        abort.abort();
      };

      const workerLoop = async () => {
        while (!cancelled && !abort.signal.aborted) {
          const i = nextIndex++;
          if (i >= total) return;
          const index = indices[i];
          try {
            await exportTile(index, loader, abort.signal, jpegTransfer);
          } catch (e) {
            if (abort.signal.aborted || cancelled) return;
            console.error(e instanceof Error ? e.message : e);
            try {
              await exportTile(index, loader, abort.signal, jpegTransfer);
            } catch (e2) {
              console.error(e2 instanceof Error ? e2.message : e2);
              failExport(e2);
              return;
            }
          }
          if (cancelled || abort.signal.aborted) return;
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

      if (cancelled) return;
      if (exportFailed) {
        console.error("[minerva] jpeg-export failed", exportFailed);
        setExportError(exportFailed.message);
        return;
      }

      finishedOk = true;
      console.log(
        `[minerva] jpeg-export took ${((performance.now() - wallStart) / 1000).toFixed(1)}s (${concurrency} workers, ${total} tiles, transfer=${jpegTransfer}, encoder=jsquash)`,
      );
      try {
        const nextSource = imageSourceFromJpegTransfer(jpegTransfer);
        const doc = useDocumentStore.getState().toDocumentData();
        await writeStoryBundleSidecars(
          directory_handle,
          {
            ...doc,
            metadata: { ...doc.metadata, imageSource: nextSource },
          },
          { mode: "jpeg-pyramid" },
        );
        useDocumentStore.getState().setMetadata({ imageSource: nextSource });
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
    };

    void run().catch((e) => {
      if (cancelled) return;
      console.error("[minerva] jpeg-export failed", e);
      setExportError(e instanceof Error ? e.message : "JPEG export failed");
    });

    return () => {
      cancelled = true;
      window.clearInterval(etaInterval);
      // Avoid aborting the shared Viv loader after a successful export.
      if (!finishedOk) abort.abort();
    };
  }, [
    state,
    loader,
    cRange,
    exportError,
    directory_handle,
    mode,
    exportArmed,
    jpegTransfer,
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

  const clampedRatio = Math.min(1, Math.max(0, ratio));

  return (
    <div className={styles.imageExporter}>
      {exportError ? (
        <div className={styles.exportStatus}>
          <div className={styles.exportMessage}>
            Export failed: {exportError}
          </div>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={stopExport}
          >
            Dismiss
          </button>
        </div>
      ) : mode === "remote-url" ? (
        <div className={styles.exportStatus}>
          <div className={styles.exportMessage}>
            {done
              ? "Exported document.json + index.html (remote URLs)"
              : "Writing document.json + index.html…"}
          </div>
          {done ? (
            <button
              type="button"
              className={styles.dismissButton}
              onClick={stopExport}
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ) : !exportArmed ? (
        <div className={styles.exportStatus}>
          <div className={styles.exportMessage}>
            {mode === "jpeg-ome-tiff"
              ? "Export JPEG OME-TIFF"
              : "Export JPEG pyramid"}
          </div>
          <label className={styles.transferToggle}>
            <input
              type="checkbox"
              checked={mode === "jpeg-ome-tiff"}
              onChange={(e) => {
                if (e.target.checked) {
                  setMode("jpeg-ome-tiff");
                } else {
                  setMode("jpeg-pyramid");
                }
              }}
            />
            <span>Single-file OME-TIFF</span>
          </label>
          <label className={styles.transferToggle}>
            <input
              type="checkbox"
              checked={jpegTransfer === "cube-root"}
              onChange={(e) =>
                setJpegTransfer(e.target.checked ? "cube-root" : "contrast")
              }
            />
            <span>Cube-root intensity encoding</span>
          </label>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={armExport}
            >
              Start export
            </button>
            {canUpdateDocumentOnly ? (
              <button
                type="button"
                className={styles.dismissButton}
                onClick={() => {
                  void props.onDocumentOnlyUpdate?.().catch((e) => {
                    console.error(
                      "[minerva] failed to write story bundle sidecars",
                      e,
                    );
                    setExportError(
                      e instanceof Error
                        ? e.message
                        : "Failed to write document.json / index.html",
                    );
                  });
                }}
              >
                Update document.json only
              </button>
            ) : null}
            <button
              type="button"
              className={styles.dismissButton}
              onClick={stopExport}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.exportStatus}>
          <div
            className={[
              styles.progressBar,
              done ? styles.progressBarDone : null,
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--progress-ratio": clampedRatio } as CSSProperties}
          >
            <div>
              <div></div>
            </div>
            <div> {percentLabel} </div>
          </div>
          {etaLabel ? <div className={styles.etaLine}>{etaLabel}</div> : null}
          {done ? (
            <button
              type="button"
              className={styles.dismissButton}
              onClick={stopExport}
            >
              Dismiss
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
