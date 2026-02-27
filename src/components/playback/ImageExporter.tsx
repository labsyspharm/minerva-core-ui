import type { TiffPixelSource } from "@hms-dbmi/viv";
import { getImageSize, loadOmeTiff } from "@hms-dbmi/viv";
import * as React from "react";
import { useState } from "react";
import styled from "styled-components";

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
  handle: FileSystemDirectoryHandle;
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
  const selection = { t: 0, z: 0, c: 0 };
  const signal = AbortSignal.timeout(10 * 1000);
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
    1000,
    30000,
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
  const { index, loader, handle } = inputs;
  const { output, filename } = await capture(index, loader);
  const fh = await handle.getFileHandle(filename, create);
  const write = await fh.createWritable();
  await write.write(output);
  await write.close();
};

const doStep: DoStep = async (inputs) => {
  const { loader, handle } = inputs;
  const { index, next } = inputs;
  const { step, done } = inputs.stepSignal;
  if (done) return null;

  save({ step, handle, loader, index });
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
  const { loader } = inputs;
  const tileProps = toTileLayer(loader);
  const mz = Math.abs(tileProps.minZoom || 0) + 1;
  const zoomRange = [...new Array(mz).keys()];
  const zr = zoomRange.reverse().map((z) => -z);
  const indices = ([] as Index[]).concat(
    ...zr.map((zoom) => {
      const counts = toTileCounts({ zoom, tileProps });
      const xRange = [...new Array(counts.x).keys()];
      const yRange = [...new Array(counts.y).keys()];
      return ([] as Index[]).concat(
        ...xRange.map((x) => {
          return yRange.map((y) => {
            return { z: zoom, x, y };
          });
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
  grid-template-columns ${(props) => to_fr(props.$ratio || 0)};
  > div {
    background-color: ${(props) => to_color(props.$done) || "white"};
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

type LoaderIn = {
  in_f: string;
  handle: Handle.Dir;
};
type LoaderOut = {
  data: LoaderPlane[];
};
type LoaderOpts = {
  in_f: string;
  handle: Handle.Dir | null;
};
type ToLoader = (i: LoaderIn) => Promise<LoaderOut>;
interface ProgressBarProps {
  $ratio: number;
  $done: boolean;
}

const toLoader: ToLoader = async ({ in_f, handle }) => {
  const in_fh = await handle.getFileHandle(in_f);
  const in_file = await in_fh.getFile();
  const in_tiff = await loadOmeTiff(in_file);
  const { data } = in_tiff;
  return { data };
};

const getLoader = async (opts: LoaderOpts) => {
  const { handle, in_f } = opts;
  if (handle === null) return;
  const data = await toLoader({ in_f, handle });
  return data.data;
};

export type ImageExporterProps = {
  in_f: string;
  handle: Handle.Dir;
  stopExport: () => void;
};

export const ImageExporter = (props: ImageExporterProps) => {
  const _exportProps = {
    variant: "primary",
    className: "mb-3",
  };

  const { in_f, handle } = props;

  const [state, setState] = useState(null as MainState);
  const [loader, setLoader] = useState([] as LoaderPlane[]);
  const [stepSignal, setStepSignal] = useState({
    done: false,
    step: 0,
  });

  React.useEffect(() => {
    getLoader({ handle, in_f }).then((loader) => {
      const init = initialize({ loader });
      if (isFullState(init) && loader.length) {
        setLoader(loader);
        setState(init);
      }
    });
  }, [in_f, handle]);

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
      if (!state || !loader.length) return;
      const next = (step + 1) % state.indices.length;
      doStep({
        handle,
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
  }, [state, step, done, handle, index, loader, props, stepSignal]);

  const _tileShape = { width: 1024, height: 1024 }; // TODO
  let ratio = done ? 1 : 0;
  if (!done && state !== null) {
    ratio = step / (state.indices.length - 1);
  }
  return (
    <ImageExporterDiv>
      <ProgressBar $ratio={ratio} $done={done}>
        <div></div>
      </ProgressBar>
    </ImageExporterDiv>
  );
};
