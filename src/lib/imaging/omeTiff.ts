import { fromBlob, fromUrl, GeoTIFFImage as GeoTIFFImageClass } from "geotiff";
import { classify, type MaskDetectResult } from "@/lib/imaging/maskDetect";
import {
  omeChannelElements,
  omePixelsElement,
  parseOmeXml,
  sanitizeOmeXml,
} from "@/lib/imaging/omeXml";
import { registerLzwDecoder } from "@/lib/imaging/workers/decoders";

type GeoTiffImage = {
  fileDirectory?: {
    ImageDescription?: string | undefined;
    BitsPerSample?: number[] | ArrayLike<number>;
    SampleFormat?: number[];
    SamplesPerPixel?: number;
    SubIFDs?: number[] | ArrayLike<number>;
  };
  getHeight: () => number;
  getWidth: () => number;
  getTileHeight: () => number;
  getTileWidth: () => number;
  readRasters: (options: {
    samples: number[];
    interleave: true;
    window: [number, number, number, number];
    width?: number;
    height?: number;
    signal?: AbortSignal;
  }) => Promise<ArrayLike<number>>;
  /** Applies the photometric transform (YCbCr, palette, CMYK) that readRasters skips. */
  readRGB: (options: {
    interleave: true;
    window: [number, number, number, number];
    signal?: AbortSignal;
  }) => Promise<ArrayLike<number>>;
};

type GeoTiffWithImage = {
  getImage: (i: number) => Promise<GeoTiffImage>;
  dataView?: DataView;
  littleEndian?: boolean;
  cache?: unknown;
  source?: unknown;
  parseFileDirectoryAt?: (offset: number) => Promise<{
    fileDirectory: GeoTiffImage["fileDirectory"];
    geoKeyDirectory: unknown;
  }>;
};

async function openOmeTiff(source: Blob | string, signal?: AbortSignal) {
  // After Viv's module init, which installs an LZW decoder sized for one sample.
  registerLzwDecoder();
  return (
    typeof source === "string"
      ? await fromUrl(source, {}, signal)
      : await fromBlob(source, signal)
  ) as GeoTiffWithImage;
}

/** Coarsest pyramid plane (IFD0 + SubIFDs). Avoids decoding full-res for thumbs. */
async function getCoarsestTiffImage(
  tiff: GeoTiffWithImage,
): Promise<GeoTiffImage> {
  const base = await tiff.getImage(0);
  const raw = base.fileDirectory?.SubIFDs;
  const offsets = raw == null ? [] : Array.from(raw as ArrayLike<number>);
  const baseInternals = base as GeoTiffImage & {
    dataView?: DataView;
    littleEndian?: boolean;
    cache?: unknown;
    source?: unknown;
  };
  if (
    offsets.length === 0 ||
    typeof tiff.parseFileDirectoryAt !== "function" ||
    (baseInternals.source ?? tiff.source) == null
  ) {
    return base;
  }
  let best = base;
  let bestArea = base.getWidth() * base.getHeight();
  for (const offset of offsets) {
    const parsed = await tiff.parseFileDirectoryAt(offset);
    const image = new GeoTIFFImageClass(
      parsed.fileDirectory as never,
      parsed.geoKeyDirectory as never,
      (baseInternals.dataView ?? tiff.dataView) as never,
      (baseInternals.littleEndian ?? tiff.littleEndian ?? true) as never,
      (baseInternals.cache ?? tiff.cache) as never,
      (baseInternals.source ?? tiff.source) as never,
    ) as unknown as GeoTiffImage;
    const area = image.getWidth() * image.getHeight();
    if (area > 0 && area < bestArea) {
      bestArea = area;
      best = image;
    }
  }
  return best;
}

/** Run format-agnostic mask detection through a TIFF window reader. */
export async function detectOmeTiffMask(
  source: Blob | string,
  signal?: AbortSignal,
): Promise<MaskDetectResult> {
  const image = await (await openOmeTiff(source, signal)).getImage(0);
  const fd = image.fileDirectory;
  const samples = fd?.SamplesPerPixel ?? 1;
  const bits = fd?.BitsPerSample?.[0];
  const sampleFormat = fd?.SampleFormat?.[0] ?? 1;
  return classify({
    width: image.getWidth(),
    height: image.getHeight(),
    channels: samples,
    integer: sampleFormat !== 3,
    uint8: bits === 8 && sampleFormat === 1,
    tileWidth: image.getTileWidth(),
    tileHeight: image.getTileHeight(),
    signal,
    getWindow: (x, y, width, height, channel = 0) =>
      image.readRasters({
        samples: [channel],
        interleave: true,
        window: [x, y, x + width, y + height],
        signal,
      }),
  });
}

/** True when ImageDescription contains an OME `<Pixels>` block. */
function hasOmePixels(imageDescription: unknown): boolean {
  if (typeof imageDescription !== "string" || imageDescription.trim() === "") {
    return false;
  }
  const doc = parseOmeXml(imageDescription);
  return doc != null && omePixelsElement(doc) != null;
}

/** Read OME-XML from OME-TIFF ImageDescription without loading pixels. */
export async function getOmeTiffImageDescriptionOmeXml(
  source: File | string,
  urlOptions: Parameters<typeof fromUrl>[1] = {},
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const tiff: GeoTiffWithImage = (
      typeof source === "string"
        ? await fromUrl(source, urlOptions, signal)
        : await fromBlob(source, signal)
    ) as GeoTiffWithImage;
    const first = await tiff.getImage(0);
    const desc = first.fileDirectory?.ImageDescription;
    if (typeof desc !== "string" || !hasOmePixels(desc)) {
      return null;
    }
    // Sanitize so ROI / other consumers don't re-hit FF NUL-padding parse errors.
    return sanitizeOmeXml(desc);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(
        "[ome-roi] could not read ImageDescription from OME-TIFF",
        e,
      );
    }
    return null;
  }
}

/**
 * Confirm a URL is an OME-TIFF via geotiff header + IFD0 ImageDescription.
 * Range-reads only — does not load the full pyramid.
 */
export async function isOmeTiff(
  url: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const tiff = await fromUrl(url, {}, signal);
    const first = await tiff.getImage(0);
    return hasOmePixels(first.fileDirectory?.ImageDescription);
  } catch {
    return false;
  }
}

/** Packed interleaved RGB, three separate planes, or neither. */
type OmeRgbLayout = "packed" | "planar" | null;

function omeRgbLayoutFromXml(omeXml: string | null | undefined): OmeRgbLayout {
  if (omeXml == null || omeXml.trim() === "") return null;
  const doc = parseOmeXml(omeXml);
  const pixels = doc ? omePixelsElement(doc) : null;
  if (!pixels) return null;
  const channelEls = omeChannelElements(pixels);
  const samples = channelEls.map((ch) => {
    const raw = ch.getAttribute("SamplesPerPixel");
    let n = 1;
    if (raw != null && raw !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) n = parsed;
    }
    return n;
  });
  if (samples.length === 1 && samples[0] === 3) return "packed";
  if (samples.length === 3 && samples.every((s) => s === 1)) return "planar";
  return null;
}

/**
 * Full-scale value of the buffer we actually got back, not of the file's tags.
 * `readRGB` normalizes every photometric except plain RGB to 8-bit, and float
 * TIFFs carry 0–1 samples rather than 2^bits-1.
 */
function sampleMaxForBuffer(
  data: ArrayLike<number>,
  bitsPerSample: number,
): number {
  if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
    return 255;
  }
  if (data instanceof Float32Array || data instanceof Float64Array) {
    return 1;
  }
  return 2 ** Math.max(1, Math.floor(bitsPerSample) || 8) - 1;
}

export type BrightfieldTally = { nDark: number; nLight: number };

/** Tile-aligned sample starts at 15% / 50% / 85%. Center-only misses slide background. */
export function brightfieldSampleOffsets(size: number, tile: number): number[] {
  const tileSpan = Math.max(1, tile);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const frac of [0.15, 0.5, 0.85]) {
    const aligned = Math.floor((size * frac) / tileSpan) * tileSpan;
    const start = Math.max(0, Math.min(Math.max(0, size - 1), aligned));
    const snapped = Math.floor(start / tileSpan) * tileSpan;
    if (seen.has(snapped)) continue;
    seen.add(snapped);
    out.push(snapped);
  }
  return out;
}

function brightfieldWindows(
  w: number,
  h: number,
  tileW: number,
  tileH: number,
): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (const y0 of brightfieldSampleOffsets(h, tileH)) {
    for (const x0 of brightfieldSampleOffsets(w, tileW)) {
      out.push([x0, y0, Math.min(w, x0 + tileW), Math.min(h, y0 + tileH)]);
    }
  }
  return out;
}

/**
 * QuPath GuiTools.estimateImageType dark/light heuristic: more near-white than
 * near-black → brightfield. Thresholds are 25/220 of 8-bit, rescaled to the
 * buffer's full scale. `channels` is 1 for the grayscale fallback.
 */
export function tallyBrightfieldSamples(
  data: ArrayLike<number>,
  opts: { sampleMax: number; channels: number },
  tally: BrightfieldTally,
): void {
  const { sampleMax } = opts;
  const channels = Math.max(1, opts.channels);
  const dark = (25 / 255) * sampleMax;
  const light = (220 / 255) * sampleMax;
  const nPixels = Math.floor(data.length / channels);
  const stride = Math.max(1, Math.ceil(nPixels / 10_000));
  for (let i = 0; i + channels - 1 < data.length; i += channels * stride) {
    const r = data[i];
    const g = channels >= 3 ? data[i + 1] : r;
    const b = channels >= 3 ? data[i + 2] : r;
    if (r < dark && g < dark && b < dark) tally.nDark += 1;
    else if (r > light && g > light && b > light) tally.nLight += 1;
  }
}

export function brightfieldTallyMatches(tally: BrightfieldTally): boolean {
  return tally.nLight > tally.nDark && tally.nDark + tally.nLight > 0;
}

/** Full scale for a decoded tile. Uint16 falls through to 65535. */
export function brightfieldSampleMax(
  data: ArrayLike<number>,
  dtype?: string,
): number {
  if (dtype === "Uint8" || dtype === "Int8") return 255;
  if (dtype === "Float32" || dtype === "Float64") return 1;
  return sampleMaxForBuffer(
    data,
    dtype === "Uint32" || dtype === "Int32" ? 32 : 16,
  );
}

/**
 * Coarsest-level tiles on a 3×3 grid (inset from the rim so padding is not the
 * only sample). A center tile is often tissue, which hides white glass.
 * Windowed, so unlike a full-plane `readRGB` it does not decode the slide.
 */
export async function detectOmeTiffBrightfield(
  source: Blob | string,
  signal?: AbortSignal,
): Promise<boolean> {
  const tiff = await openOmeTiff(source, signal);
  const image = await getCoarsestTiffImage(tiff);
  if (signal?.aborted) return false;
  const w = image.getWidth();
  const h = image.getHeight();
  const tileW = Math.max(1, image.getTileWidth?.() || 256);
  const tileH = Math.max(1, image.getTileHeight?.() || 256);
  const windows = brightfieldWindows(w, h, tileW, tileH);
  const spp = image.fileDirectory?.SamplesPerPixel ?? 1;
  const bitsRaw = image.fileDirectory?.BitsPerSample?.[0];
  const bits = typeof bitsRaw === "number" ? bitsRaw : 8;
  // readRasters hands back raw samples: JPEG H&E is YCbCr (Cb/Cr sit near 128,
  // so nothing ever reads as light), WhiteIsZero is inverted, Palette is
  // indices. readRGB applies the photometric transform and always returns
  // interleaved RGB. It throws when the tag is missing or unsupported.
  const tally: BrightfieldTally = { nDark: 0, nLight: 0 };
  try {
    for (const window of windows) {
      if (signal?.aborted) return false;
      const rgb = await image.readRGB({ interleave: true, window, signal });
      tallyBrightfieldSamples(
        rgb,
        { sampleMax: sampleMaxForBuffer(rgb, bits), channels: 3 },
        tally,
      );
    }
    return brightfieldTallyMatches(tally);
  } catch (error) {
    if (signal?.aborted) return false;
    console.warn(
      "[minerva] rgb detect: readRGB failed, falling back to raw samples",
      error,
    );
  }
  const samples = spp >= 3 ? [0, 1, 2] : [0];
  const rawTally: BrightfieldTally = { nDark: 0, nLight: 0 };
  for (const window of windows) {
    if (signal?.aborted) return false;
    const raw = await image.readRasters({
      samples,
      interleave: true,
      window,
      signal,
    });
    tallyBrightfieldSamples(
      raw,
      { sampleMax: sampleMaxForBuffer(raw, bits), channels: samples.length },
      rawTally,
    );
  }
  return brightfieldTallyMatches(rawTally);
}

/**
 * Packed RGB is one interleaved channel (SamplesPerPixel=3): H&E.
 * Planar is three SPP=1 channels, which may be H&E or fluorescence.
 */
export async function detectOmeTiffRgbLayout(
  source: File | string,
  signal?: AbortSignal,
): Promise<OmeRgbLayout> {
  const xml = await getOmeTiffImageDescriptionOmeXml(source, {}, signal);
  if (signal?.aborted) return null;
  return omeRgbLayoutFromXml(xml);
}
