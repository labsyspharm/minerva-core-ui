import type { TiffPixelSource } from "@hms-dbmi/viv";
import { getImageSize } from "@hms-dbmi/viv";
import * as React from "react";
import { useMemo, useState } from "react";
import hash from "stable-hash";
import styled from "styled-components";
import type {
  ItemRegistryGroup,
  OmeLoaderEntry,
} from "@/components/shared/viewer/ImageViewer";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import { toLoader } from "@/lib/imaging/filesystem";
import type { Config } from "@/lib/imaging/viv";
import type { PoolClass } from "@/lib/imaging/workers/Pool";
import { Pool } from "@/lib/imaging/workers/Pool";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";

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
};
type CommonIn = InitIn & {
  directory_handle: FileSystemDirectoryHandle;
  index: Index;
};

type SaveIn = CommonIn & {
  step: number;
};
type Save = (i: SaveIn) => Promise<void>;

type StepIn = CommonIn & {
  stepSignal: StepOut;
  next: number;
};
type StepOut = {
  step: number;
  done: boolean;
};
type DoStep = (o: StepIn) => Promise<StepOut | null>;

type CaptureOut = {
  output: Uint8Array;
  filename: string;
};
type Capture = (i: Index, loader: LoaderPlane[]) => Promise<CaptureOut>;

const toSettingsInternal = (
  loader,
  modality,
  groups,
  activeChannelGroupId,
  channelVisibilities,
  toSettings,
  loaderSourceImageId?: string,
) => {
  if (loader === null || !groups) {
    return toSettings(
      activeChannelGroupId,
      modality,
      undefined,
      channelVisibilities,
      loaderSourceImageId,
    );
  }
  return toSettings(
    activeChannelGroupId,
    modality,
    loader,
    channelVisibilities,
    loaderSourceImageId,
  );
};

const toFilename = (index: Index) => {
  const level = -index.z;
  const { x, y } = index;
  return `${level}_${x}_${y}.jpg`;
};

const clampValue = (x, min, max) => {
  return Math.min(255, Math.max(0, (255 * (x - min)) / (max - min)));
};

const clampArray = (imageData, tile_u16, min, max) => {
  var _tile_u8 = new Uint8Array(tile_u16.length);
  for (let i = 0; i < tile_u16.length; i++) {
    const clamped = clampValue(tile_u16[i], min, max);
    imageData.data[i * 4] = clamped;
    imageData.data[i * 4 + 1] = clamped;
    imageData.data[i * 4 + 2] = clamped;
    imageData.data[i * 4 + 3] = 255; // Alpha
  }
  return imageData;
};

const capture: Capture = async (index, loader) => {
  const filename = toFilename(index);
  const level = Math.abs(index.z);
  const z_loader = loader[level];
  const selection = { t: 0, z: 0, c: index.c };
  const signal = AbortSignal.timeout(30 * 1000);
  const { x, y } = index;
  const tile = await z_loader.getTile({
    selection,
    x,
    y,
    signal,
  });
  const { width, height, data } = tile;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const imageData = clampArray(
    ctx.createImageData(width, height),
    data,
    index.lowerLimit,
    index.upperLimit,
  );
  canvas.width = width;
  canvas.height = height;
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise((r: BlobCallback) => {
    canvas.toBlob(r, "image/jpeg", 0.5);
  });

  const buff = await blob.arrayBuffer();
  const output = new Uint8Array(buff);
  return { output, filename };
};

const save: Save = async (inputs) => {
  const create = { create: true };
  const { index, loader, directory_handle } = inputs;
  const { output, filename } = await capture(index, loader);
  const encoded_data = new TextEncoder().encode(index.encoded);
  const sha256 = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoded_data),
  ).toHex();
  const dh = await directory_handle.getDirectoryHandle(sha256, create);
  const fh = await dh.getFileHandle(filename, create);
  const write = await fh.createWritable();
  await write.write(output);
  await write.close();
};

const doStep: DoStep = async (inputs) => {
  const { loader, directory_handle } = inputs;
  const { index, next } = inputs;
  const { step, done } = inputs.stepSignal;
  if (done) return null;
  try {
    save({ step, directory_handle, loader, index });
  } catch (e) {
    // REDO
    console.error(e.message);
    return { done: false, step };
  }
  return { done: next === 0, step: next };
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
  lowerLimit: number;
  upperLimit: number;
  encoded: string;
};
type FullState = {
  indices: Index[];
  tileProps: TileProps;
};
type MainState = null | FullState;
type Initialize = (i: InitIn, c: Index[]) => Partial<FullState>;

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
  grid-template-rows: 1fr 30px 1fr;
  grid-template-columns: 1fr 300px 1fr;
  > div {
    grid-row: 2;
    grid-column: 2;
  }
`;

const ProgressBar = styled.div<ProgressBarProps>`
  display: grid;
  grid-template-columns ${(props) => to_fr(props.$ratio || 0)} auto;
  > div:first-child {
    background-color: ${(props) => to_color(props.$done) || "white"};
  }
  > div:last-child {
    padding: 0.25em;
    font-family: monospace;
  }
`;

const to_fr = (ratio) => {
  const percent = Math.round(parseFloat(ratio) * 100);
  return `${percent}fr ${100 - percent}fr`;
};

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
  directory_handle: Handle.Dir;
  stopExport: () => void;
  groups: ItemRegistryGroup[];
  dicomIndexList: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
  viewerConfig: Config;
};

export const ImageExporter = (props: ImageExporterProps) => {
  const _exportProps = {
    variant: "primary",
    className: "mb-3",
  };
  const { groups, viewerConfig } = props;
  const { omeLoaderEntries, dicomIndexList } = props;

  const { activeChannelGroupId, channelVisibilities } = useAppStore();

  const mainSettingsOmeList = useMemo(() => {
    const modality = "Colorimetric";
    return omeLoaderEntries.map(({ loader, sourceImageId }) =>
      toSettingsInternal(
        loader,
        modality,
        groups,
        activeChannelGroupId,
        channelVisibilities,
        viewerConfig.toSettings,
        sourceImageId,
      ),
    );
  }, [
    omeLoaderEntries,
    groups,
    activeChannelGroupId,
    channelVisibilities,
    viewerConfig.toSettings,
  ]);

  const mainSettingsDicomList = useMemo(() => {
    return dicomIndexList.map((dicomIndex) => {
      const { modality } = dicomIndex;
      return toSettingsInternal(
        dicomIndex.loader,
        modality,
        groups,
        activeChannelGroupId,
        channelVisibilities,
        viewerConfig.toSettings,
      );
    });
  }, [
    dicomIndexList,
    groups,
    activeChannelGroupId,
    channelVisibilities,
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
  const imageChannels = Object.fromEntries(
    [].concat(
      ...images.map(({ channels }) => {
        return channels.map(({ id, index }) => [id, index]);
      }),
    ),
  );
  const [stepSignal, setStepSignal] = useState({
    done: false,
    step: 0,
  });

  const cRange = ([] as Index[]).concat(
    ...channelGroups.map(({ channels }) => {
      return ([] as Index).concat(
        ...channels
          .map(({ channelId, lowerLimit, upperLimit }) => {
            const c = imageChannels[channelId];
            if (c === undefined) {
              return null;
            }
            const opts = { channelId, lowerLimit, upperLimit };
            const encoded = hash(opts);
            return {
              z: 0,
              x: 0,
              y: 0,
              c,
              encoded,
              lowerLimit,
              upperLimit,
            };
          })
          .filter((v) => v),
      );
    }),
  );

  const loader = useMemo(
    () =>
      mainSettingsList.length > 0 ? mainSettingsList[0].loader.data : null,
    [mainSettingsList],
  );

  const state: MainState = useMemo(() => {
    if (loader === null) {
      return null;
    }
    const init = initialize({ loader, cRange });
    if (isFullState(init) && loader?.length) {
      return init;
    }
    return null;
  }, [loader, cRange]);

  const { step, done } = stepSignal;
  const index = (() => {
    if (!state || !isFullState(state)) return null;
    if (state.indices.length === 0) return null;
    return state.indices[step];
  })();
  React.useEffect(() => {
    if (done) {
      //TODO
      setTimeout(() => {
        props.stopExport();
      }, 2000);
    } else {
      if (!state || !loader?.length) return;
      const next = (step + 1) % state.indices.length;
      doStep({
        directory_handle,
        loader,
        index,
        next,
        stepSignal,
      }).then((nextStepSignal) => {
        if (nextStepSignal !== null) {
          setStepSignal(nextStepSignal);
        }
      });
    }
  }, [state, step, done, directory_handle, index, loader, props, stepSignal]);

  const _tileShape = { width: 1024, height: 1024 }; // TODO
  let ratio = done ? 1 : 0;
  if (!done && state !== null) {
    ratio = step / (state.indices.length - 1);
  }
  return (
    <ImageExporterDiv>
      <ProgressBar $ratio={ratio} $done={done}>
        <div></div>
        <div> {`${Math.floor(ratio * 1000) / 10}%`} </div>
      </ProgressBar>
    </ImageExporterDiv>
  );
};
