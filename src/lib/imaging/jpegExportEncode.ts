import encodeJpeg, { init as initJpegEncode } from "@jsquash/jpeg/encode";
import type { JpegExportTransfer } from "./cubeRootEncoding";
import { encodeCubeRootU16ToU8 } from "./cubeRootEncoding";
import { JPEG_PYRAMID_TILE_SIZE } from "./jpegPyramid";

/** MozJpegColorSpace.GRAYSCALE — const enum is erased at runtime. */
const MOZJPEG_COLORSPACE_GRAYSCALE = 1;

/** Historical 0–1 scale (Canvas); MozJPEG uses 0–100 via {@link mozJpegQuality}. */
export const JPEG_EXPORT_QUALITY = 0.5;

export const PIXEL_CTORS: Record<
  string,
  new (
    buf: ArrayBuffer,
  ) => ArrayLike<number>
> = {
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Float32Array,
  Float64Array,
};

export function clampValue(x: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(255, Math.max(0, (255 * (x - min)) / (max - min)));
}

/** Fill grayscale RGBA into a preallocated buffer (length = width * height * 4). */
export function clampPixelsToRgba(
  out: Uint8ClampedArray,
  pixels: ArrayLike<number>,
  min: number,
  max: number,
): void {
  for (let i = 0; i < pixels.length; i++) {
    const clamped = clampValue(pixels[i], min, max);
    const o = i * 4;
    out[o] = clamped;
    out[o + 1] = clamped;
    out[o + 2] = clamped;
    out[o + 3] = 255;
  }
}

function cubeRootPixelsToRgba(
  out: Uint8ClampedArray,
  pixels: ArrayLike<number>,
): void {
  for (let i = 0; i < pixels.length; i++) {
    const v = encodeCubeRootU16ToU8(pixels[i]);
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
}

/**
 * Pad edge tiles so JPEG SOF dimensions match declared TIFF TileWidth/TileLength.
 * Input is grayscale RGBA (R=G=B=intensity). Output is tileW×tileH RGBA.
 */
export function padGrayscaleRgbaToTile(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  tileWidth = JPEG_PYRAMID_TILE_SIZE,
  tileLength = JPEG_PYRAMID_TILE_SIZE,
): Uint8ClampedArray<ArrayBuffer> {
  if (width === tileWidth && height === tileLength) {
    return rgba.buffer instanceof ArrayBuffer
      ? (rgba as Uint8ClampedArray<ArrayBuffer>)
      : (new Uint8ClampedArray(rgba) as Uint8ClampedArray<ArrayBuffer>);
  }
  const out = new Uint8ClampedArray(
    new ArrayBuffer(tileWidth * tileLength * 4),
  ) as Uint8ClampedArray<ArrayBuffer>;
  const copyW = Math.min(width, tileWidth);
  const copyH = Math.min(height, tileLength);
  for (let row = 0; row < copyH; row++) {
    const src = row * width * 4;
    const dst = row * tileWidth * 4;
    out.set(rgba.subarray(src, src + copyW * 4), dst);
  }
  return out;
}

/** Accept legacy 0–1 quality or MozJPEG 0–100. */
function mozJpegQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 50;
  return quality <= 1 ? Math.round(quality * 100) : Math.round(quality);
}

let jsquashReady: Promise<void> | null = null;

/** Pre-warm MozJPEG WASM (once per worker / main thread). */
export function ensureJpegEncoderReady(): Promise<void> {
  if (!jsquashReady) {
    jsquashReady = initJpegEncode().then(() => undefined);
  }
  return jsquashReady;
}

async function encodeRgbaToJpeg(
  width: number,
  height: number,
  rgba: Uint8ClampedArray<ArrayBuffer>,
  quality: number,
): Promise<ArrayBuffer> {
  await ensureJpegEncoderReady();
  const imageData = new ImageData(rgba, width, height);
  return encodeJpeg(imageData, {
    quality: mozJpegQuality(quality),
    color_space: MOZJPEG_COLORSPACE_GRAYSCALE,
    baseline: true,
    progressive: false,
    arithmetic: false,
    optimize_coding: false,
  });
}

/** Encode grayscale pixels to JPEG (contrast-windowed or cube-root transfer). */
export async function encodeGrayscaleJpeg(
  width: number,
  height: number,
  pixels: ArrayLike<number>,
  lowerLimit: number,
  upperLimit: number,
  quality = JPEG_EXPORT_QUALITY,
  transfer: JpegExportTransfer = "contrast",
  padTileWidth?: number,
  padTileLength?: number,
): Promise<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(
    new ArrayBuffer(width * height * 4),
  ) as Uint8ClampedArray<ArrayBuffer>;
  if (transfer === "cube-root") {
    cubeRootPixelsToRgba(rgba, pixels);
  } else {
    clampPixelsToRgba(rgba, pixels, lowerLimit, upperLimit);
  }
  const padW = padTileWidth ?? width;
  const padH = padTileLength ?? height;
  if (padW === width && padH === height) {
    return encodeRgbaToJpeg(width, height, rgba, quality);
  }
  const padded = padGrayscaleRgbaToTile(rgba, width, height, padW, padH);
  return encodeRgbaToJpeg(padW, padH, padded, quality);
}

export function typedArrayCtorName(data: ArrayLike<number>): string {
  return (data as { constructor?: { name?: string } }).constructor?.name ?? "";
}

export function copyPixelBuffer(
  data: ArrayLike<number> & {
    buffer: ArrayBufferLike;
    byteOffset: number;
    byteLength: number;
  },
): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = data;
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  const copy = new ArrayBuffer(byteLength);
  new Uint8Array(copy).set(new Uint8Array(buffer, byteOffset, byteLength));
  return copy;
}
