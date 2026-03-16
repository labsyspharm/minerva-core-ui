/**
 * Fetches the visible viewport region from the Viv loader and produces a
 * 1024×1024 SAM2-ready tensor.  Instead of cropping a fixed 1024 px box
 * around the click, we now render the *entire* visible viewport into a
 * square canvas with aspect-preserving padding so that SAM always "sees"
 * everything the user sees.
 */

import type { LoaderPlane } from "@/lib/config";
import type { ViewRect } from "@/lib/samViewport";
import { canvasToFloat32Array } from "./imageUtils";

export type Sam2Settings = {
  selections: Array<{ z: number; t: number; c: number }>;
  colors: [number, number, number][];
  contrastLimits: [number, number][];
  channelsVisible: boolean[];
};

function clampValue(x: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.min(
    255,
    Math.max(0, Math.round((255 * (x - min)) / (max - min))),
  );
}

/**
 * Choose the pyramid level whose resolution keeps the viewRect render size
 * close to SAM_SIZE on the longer side.  This avoids fetching thousands of
 * full-resolution tiles when zoomed out.
 */
function pickPyramidLevel(
  levels: LoaderPlane[],
  viewRect: ViewRect,
  samSize: number,
): number {
  const viewW = viewRect.maxX - viewRect.minX;
  const viewH = viewRect.maxY - viewRect.minY;
  const longerSide = Math.max(viewW, viewH);
  if (longerSide <= 0) return 0;

  // We want: longerSide / 2^level ≈ samSize
  const idealLevel = Math.max(0, Math.floor(Math.log2(longerSide / samSize)));
  return Math.min(idealLevel, levels.length - 1);
}

/**
 * Create a fetcher that, given a ViewRect (visible image-space region),
 * reads the appropriate pyramid level, composites channels, and returns a
 * 1024×1024 float32 tensor ready for the SAM2 encoder.
 */
export function createSam2ImageFetcher(
  loader: { data: LoaderPlane[] } | null,
  settings: Sam2Settings | null,
  imageWidth: number,
  imageHeight: number,
):
  | ((
      viewRect: ViewRect,
    ) => Promise<{
      float32Array: Float32Array;
      shape: [number, number, number, number];
    }>)
  | null {
  if (!loader?.data?.length || !settings) return null;

  const SAM_SIZE = 1024;

  return async (viewRect: ViewRect) => {
    const viewW = Math.max(1, viewRect.maxX - viewRect.minX);
    const viewH = Math.max(1, viewRect.maxY - viewRect.minY);

    const level = pickPyramidLevel(loader.data, viewRect, SAM_SIZE);
    const plane = loader.data[level];
    const { tileSize } = plane;

    const labels: string[] = Array.from(plane.labels ?? []);
    const shape: number[] = plane.shape ?? [];
    const xIdx =
      labels.indexOf("x") >= 0 ? labels.indexOf("x") : shape.length - 1;
    const yIdx =
      labels.indexOf("y") >= 0 ? labels.indexOf("y") : shape.length - 2;
    const levelW = shape[xIdx] ?? imageWidth;
    const levelH = shape[yIdx] ?? imageHeight;

    // Scale factor from full-resolution image space → this pyramid level.
    const scaleX = levelW / imageWidth;
    const scaleY = levelH / imageHeight;

    // Map viewRect into this level's coordinate system.
    const lvlMinX = Math.max(0, Math.floor(viewRect.minX * scaleX));
    const lvlMinY = Math.max(0, Math.floor(viewRect.minY * scaleY));
    const lvlMaxX = Math.min(levelW, Math.ceil(viewRect.maxX * scaleX));
    const lvlMaxY = Math.min(levelH, Math.ceil(viewRect.maxY * scaleY));

    const cropW = Math.max(1, lvlMaxX - lvlMinX);
    const cropH = Math.max(1, lvlMaxY - lvlMinY);

    const tileXMin = Math.floor(lvlMinX / tileSize);
    const tileYMin = Math.floor(lvlMinY / tileSize);
    const tileXMax = Math.floor((lvlMaxX - 1) / tileSize);
    const tileYMax = Math.floor((lvlMaxY - 1) / tileSize);

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
              const cropX = imgX - lvlMinX;
              const cropY = imgY - lvlMinY;
              if (cropX < 0 || cropX >= cropW || cropY < 0 || cropY >= cropH)
                continue;
              hasData = true;
              const tileIdx = py * tw + px;
              const raw = isUint16
                ? (data as Uint16Array)[tileIdx]
                : (data as Uint8Array)[tileIdx];
              const v = clampValue(raw, low, high);
              const outIdx = (cropY * cropW + cropX) * 4;
              outData[outIdx] = Math.min(255, outData[outIdx] + (v * r) / 255);
              outData[outIdx + 1] = Math.min(
                255,
                outData[outIdx + 1] + (v * g) / 255,
              );
              outData[outIdx + 2] = Math.min(
                255,
                outData[outIdx + 2] + (v * b) / 255,
              );
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

    // Scale/pad into a 1024×1024 square, preserving aspect ratio.
    const longerSide = Math.max(cropW, cropH);
    const drawScale = SAM_SIZE / longerSide;
    const drawW = Math.round(cropW * drawScale);
    const drawH = Math.round(cropH * drawScale);
    const offsetX = Math.round((SAM_SIZE - drawW) / 2);
    const offsetY = Math.round((SAM_SIZE - drawH) / 2);

    const samCanvas = document.createElement("canvas");
    samCanvas.width = SAM_SIZE;
    samCanvas.height = SAM_SIZE;
    const samCtx = samCanvas.getContext("2d");
    if (!samCtx) throw new Error("Could not get 2d context");
    samCtx.clearRect(0, 0, SAM_SIZE, SAM_SIZE);
    samCtx.drawImage(
      canvas,
      0,
      0,
      cropW,
      cropH,
      offsetX,
      offsetY,
      drawW,
      drawH,
    );

    const { float32Array, shape: s } = canvasToFloat32Array(samCanvas);
    return { float32Array, shape: s };
  };
}
