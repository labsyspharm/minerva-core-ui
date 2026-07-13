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

type CanvasLike = {
  width: number;
  height: number;
  getContext(contextId: "2d"): {
    putImageData(imageData: ImageData, dx: number, dy: number): void;
  } | null;
  convertToBlob?(options?: { type?: string; quality?: number }): Promise<Blob>;
};

async function blobFromCanvas(
  canvas: CanvasLike,
  width: number,
  height: number,
  rgba: Uint8ClampedArray<ArrayBuffer>,
  quality: number,
): Promise<ArrayBuffer> {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("jpegExportEncode: 2d context unavailable");
  const imageData = new ImageData(rgba, width, height);
  ctx.putImageData(imageData, 0, 0);

  let blob: Blob | null;
  if (typeof canvas.convertToBlob === "function") {
    blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality,
    });
  } else {
    const htmlCanvas = canvas as unknown as HTMLCanvasElement;
    blob = await new Promise<Blob | null>((resolve) => {
      htmlCanvas.toBlob(resolve, "image/jpeg", quality);
    });
  }
  if (!blob) throw new Error("jpegExportEncode: JPEG blob is null");
  return blob.arrayBuffer();
}

/** Encode clamped grayscale pixels to JPEG. Prefer OffscreenCanvas when available. */
export async function encodeGrayscaleJpeg(
  width: number,
  height: number,
  pixels: ArrayLike<number>,
  lowerLimit: number,
  upperLimit: number,
  quality = JPEG_EXPORT_QUALITY,
): Promise<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(
    new ArrayBuffer(width * height * 4),
  ) as Uint8ClampedArray<ArrayBuffer>;
  clampPixelsToRgba(rgba, pixels, lowerLimit, upperLimit);

  if (typeof OffscreenCanvas !== "undefined") {
    return blobFromCanvas(
      new OffscreenCanvas(width, height),
      width,
      height,
      rgba,
      quality,
    );
  }

  if (typeof document !== "undefined") {
    return blobFromCanvas(
      document.createElement("canvas"),
      width,
      height,
      rgba,
      quality,
    );
  }

  throw new Error("jpegExportEncode: no canvas available");
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
