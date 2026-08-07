function encodeCubeRootU16ToU8(pixel) {
  if (!Number.isFinite(pixel) || pixel <= 0) return 0;
  return Math.min(
    255,
    Math.max(0, Math.round((pixel / 65536) ** (1 / 3) * 256))
  );
}

const JPEG_EXPORT_QUALITY = 0.5;
const PIXEL_CTORS = {
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Float32Array,
  Float64Array
};
function clampValue(x, min, max) {
  if (max === min) return 0;
  return Math.min(255, Math.max(0, 255 * (x - min) / (max - min)));
}
function clampPixelsToRgba(out, pixels, min, max) {
  for (let i = 0; i < pixels.length; i++) {
    const clamped = clampValue(pixels[i], min, max);
    const o = i * 4;
    out[o] = clamped;
    out[o + 1] = clamped;
    out[o + 2] = clamped;
    out[o + 3] = 255;
  }
}
function cubeRootPixelsToRgba(out, pixels) {
  for (let i = 0; i < pixels.length; i++) {
    const v = encodeCubeRootU16ToU8(pixels[i]);
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
}
async function blobFromCanvas(canvas, width, height, rgba, quality) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("jpegExportEncode: 2d context unavailable");
  const imageData = new ImageData(rgba, width, height);
  ctx.putImageData(imageData, 0, 0);
  let blob;
  if (typeof canvas.convertToBlob === "function") {
    blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality
    });
  } else {
    const htmlCanvas = canvas;
    blob = await new Promise((resolve) => {
      htmlCanvas.toBlob(resolve, "image/jpeg", quality);
    });
  }
  if (!blob) throw new Error("jpegExportEncode: JPEG blob is null");
  return blob.arrayBuffer();
}
async function encodeRgbaToJpeg(width, height, rgba, quality) {
  if (typeof OffscreenCanvas !== "undefined") {
    return blobFromCanvas(
      new OffscreenCanvas(width, height),
      width,
      height,
      rgba,
      quality
    );
  }
  if (typeof document !== "undefined") {
    return blobFromCanvas(
      document.createElement("canvas"),
      width,
      height,
      rgba,
      quality
    );
  }
  throw new Error("jpegExportEncode: no canvas available");
}
async function encodeGrayscaleJpeg(width, height, pixels, lowerLimit, upperLimit, quality = JPEG_EXPORT_QUALITY, transfer = "contrast") {
  const rgba = new Uint8ClampedArray(
    new ArrayBuffer(width * height * 4)
  );
  if (transfer === "cube-root") {
    cubeRootPixelsToRgba(rgba, pixels);
  } else {
    clampPixelsToRgba(rgba, pixels, lowerLimit, upperLimit);
  }
  return encodeRgbaToJpeg(width, height, rgba, quality);
}

const worker = self;
worker.addEventListener("message", async (e) => {
  const {
    jobId,
    width,
    height,
    buffer,
    arrayCtorName,
    lowerLimit,
    upperLimit,
    quality = JPEG_EXPORT_QUALITY,
    transfer = "contrast"
  } = e.data;
  try {
    const Ctor = PIXEL_CTORS[arrayCtorName];
    if (!Ctor) {
      throw new Error(`unsupported pixel array ${arrayCtorName}`);
    }
    const pixels = new Ctor(buffer);
    const jpeg = await encodeGrayscaleJpeg(
      width,
      height,
      pixels,
      lowerLimit,
      upperLimit,
      quality,
      transfer
    );
    worker.postMessage({ jpeg, jobId }, [jpeg]);
  } catch (err) {
    worker.postMessage({
      jobId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});
