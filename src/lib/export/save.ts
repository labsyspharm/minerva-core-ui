import type { TiffPixelSource } from "@hms-dbmi/viv";

export type Index = {
  x: number;
  y: number;
  z: number;
  c: number;
  encoded: string;
  lowerLimit: number;
  upperLimit: number;
  dh: FileSystemDirectoryHandle;
};
export type Getter = TiffPixelSource<string[]>["getTile"];

export type SaveIn = {
  index: Index;
  tileGetters: Getter[];
  directory_handle: FileSystemDirectoryHandle;
};
export type Save = (i: SaveIn) => Promise<void>;

type CaptureOut = {
  output: Uint8Array<ArrayBuffer>;
  filename: string;
};
type Capture = (i: Index, tileGetters: Getter[]) => Promise<CaptureOut>;

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

const capture: Capture = async (index, tileGetters) => {
  const filename = toFilename(index);
  const level = Math.abs(index.z);
  const z_getter = tileGetters[level];
  const selection = { t: 0, z: 0, c: index.c };
  const signal = AbortSignal.timeout(30 * 1000);
  const { x, y } = index;
  const tile = await z_getter({
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
  const { index, tileGetters, directory_handle } = inputs;
  const { output, filename } = await capture(index, tileGetters);
  const fh = await index.dh.getFileHandle(filename, create);
  const write = await fh.createWritable();
  await write.write(output);
  await write.close();
};

export { save };
