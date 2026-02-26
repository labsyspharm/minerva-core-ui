/**
 * Fetches a 1024×1024 crop from the Viv loader for SAM2 encoding.
 */

import type { LoaderPlane } from "@/lib/config";
import { resizeCanvas, canvasToFloat32Array } from "./imageUtils";

export type Sam2Settings = {
  selections: Array<{ z: number; t: number; c: number }>;
  colors: [number, number, number][];
  contrastLimits: [number, number][];
  channelsVisible: boolean[];
};

function clampValue(x: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.min(255, Math.max(0, Math.round((255 * (x - min)) / (max - min))));
}

/**
 * Create getCropForSam2 function for a given loader and settings.
 */
export function createSam2ImageFetcher(
  loader: { data: LoaderPlane[] } | null,
  settings: Sam2Settings | null,
  imageWidth: number,
  imageHeight: number,
): ((cx: number, cy: number) => Promise<{ float32Array: Float32Array; shape: [number, number, number, number] }>) | null {
  if (!loader?.data?.length || !settings) return null;
  const plane = loader.data[0];
  const { tileSize } = plane;
  const labels = plane.labels || [];
  const shape = plane.shape || [];
  const xIdx = labels.indexOf("x") >= 0 ? labels.indexOf("x") : shape.length - 1;
  const yIdx = labels.indexOf("y") >= 0 ? labels.indexOf("y") : shape.length - 2;
  const levelW = shape[xIdx] ?? imageWidth;
  const levelH = shape[yIdx] ?? imageHeight;

  return async (cx: number, cy: number) => {
    const cropSize = 1024;
    const half = cropSize / 2;
    let xMin = Math.max(0, Math.floor(cx - half));
    let yMin = Math.max(0, Math.floor(cy - half));
    let cropW = cropSize;
    let cropH = cropSize;
    if (xMin + cropW > levelW) {
      cropW = levelW - xMin;
      xMin = Math.max(0, levelW - cropW);
    }
    if (yMin + cropH > levelH) {
      cropH = levelH - yMin;
      yMin = Math.max(0, levelH - cropH);
    }
    if (cropW <= 0 || cropH <= 0) {
      throw new Error("Crop out of bounds");
    }

    const tileXMin = Math.floor(xMin / tileSize);
    const tileYMin = Math.floor(yMin / tileSize);
    const tileXMax = Math.floor((xMin + cropW - 1) / tileSize);
    const tileYMax = Math.floor((yMin + cropH - 1) / tileSize);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context");
    const imageData = ctx.createImageData(cropW, cropH);
    const outData = imageData.data;
    outData.fill(0);

    const signal = AbortSignal.timeout(30_000);
    let hasData = false;

    for (let ch = 0; ch < settings.selections.length; ch++) {
      if (!settings.channelsVisible[ch]) continue;
      const sel = settings.selections[ch];
      const [low, high] = settings.contrastLimits[ch] ?? [0, 65535];
      const [r, g, b] = settings.colors[ch] ?? [255, 255, 255];

      for (let ty = tileYMin; ty <= tileYMax; ty++) {
        for (let tx = tileXMin; tx <= tileXMax; tx++) {
          const tile = await plane.getTile({
            selection: { z: sel.z, t: sel.t, c: sel.c },
            x: tx,
            y: ty,
            signal,
          });
          const { data, width: tw, height: th } = tile;
          const tilePixelX = tx * tileSize;
          const tilePixelY = ty * tileSize;
          const isUint16 = data instanceof Uint16Array;

          for (let py = 0; py < th; py++) {
            for (let px = 0; px < tw; px++) {
              const imgX = tilePixelX + px;
              const imgY = tilePixelY + py;
              const cropX = imgX - xMin;
              const cropY = imgY - yMin;
              if (cropX < 0 || cropX >= cropW || cropY < 0 || cropY >= cropH) continue;
              hasData = true;
              const tileIdx = py * tw + px;
              const raw = isUint16 ? (data as Uint16Array)[tileIdx] : (data as Uint8Array)[tileIdx];
              const v = clampValue(raw, low, high);
              const outIdx = (cropY * cropW + cropX) * 4;
              outData[outIdx] = Math.min(255, outData[outIdx] + (v * r) / 255);
              outData[outIdx + 1] = Math.min(255, outData[outIdx + 1] + (v * g) / 255);
              outData[outIdx + 2] = Math.min(255, outData[outIdx + 2] + (v * b) / 255);
              outData[outIdx + 3] = 255;
            }
          }
        }
      }
    }

    if (!hasData) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cropW, cropH);
    } else {
      ctx.putImageData(imageData, 0, 0);
    }

    const resized = resizeCanvas(canvas, { w: 1024, h: 1024 });
    const { float32Array, shape: s } = canvasToFloat32Array(resized);
    return { float32Array, shape: s };
  };
}
