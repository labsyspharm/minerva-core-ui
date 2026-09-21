import { fromBlob, fromUrl, GeoTIFFImage as GeoTIFFImageClass } from "geotiff";
import { classify, type MaskDetectResult } from "@/lib/imaging/maskDetect";

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
  const doc = new DOMParser().parseFromString(
    imageDescription,
    "application/xml",
  );
  return doc.querySelector("Image")?.querySelector("Pixels") != null;
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
    return desc;
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

function threeChannelOmeFromXml(omeXml: string | null | undefined): boolean {
  if (omeXml == null || omeXml.trim() === "") return false;
  const doc = new DOMParser().parseFromString(omeXml, "application/xml");
  const pixels = doc.querySelector("Image")?.querySelector("Pixels");
  if (!pixels) return false;
  const channelEls = [...pixels.querySelectorAll(":scope > Channel")];
  if (channelEls.length === 0) return false;
  const samples = channelEls.map((ch) => {
    const raw = ch.getAttribute("SamplesPerPixel");
    let n = 1;
    if (raw != null && raw !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) n = parsed;
    }
    return n;
  });
  if (samples.length === 1 && samples[0] === 3) return true;
  return samples.length === 3 && samples.every((s) => s === 1);
}

/**
 * QuPath GuiTools.estimateImageType dark/light heuristic.
 * 25/220 of 8-bit max, scaled to 2^bitsPerSample-1 (never the buffer max).
 * More near-white than near-black → brightfield.
 */
function isBrightfieldRgb(data: ArrayLike<number>, bitsPerSample = 8): boolean {
  const sampleMax =
    data instanceof Uint8Array || data instanceof Uint8ClampedArray
      ? 255
      : 2 ** Math.max(1, Math.floor(bitsPerSample) || 8) - 1;
  const dark = (25 / 255) * sampleMax;
  const light = (220 / 255) * sampleMax;
  const nPixels = Math.floor(data.length / 3);
  const stride = Math.max(1, Math.ceil(nPixels / 10_000));
  let nDark = 0;
  let nLight = 0;
  for (let i = 0; i + 2 < data.length; i += 3 * stride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < dark && g < dark && b < dark) nDark += 1;
    else if (r > light && g > light && b > light) nLight += 1;
  }
  return nLight > nDark && nDark + nLight > 0;
}

function scalePlaneToUint8Rgb(
  plane: ArrayLike<number>,
  bitsPerSample: number,
): Uint8Array {
  const bits = Math.max(1, Math.floor(bitsPerSample) || 8);
  const sampleMax = 2 ** bits - 1;
  const n = plane.length;
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = Number(plane[i]);
    const u8 =
      sampleMax > 0 && Number.isFinite(v)
        ? Math.max(0, Math.min(255, Math.round((v / sampleMax) * 255)))
        : 0;
    const o = i * 3;
    out[o] = u8;
    out[o + 1] = u8;
    out[o + 2] = u8;
  }
  return out;
}

/**
 * One coarsest tile, centered — (0,0) is often empty padding.
 * Avoids `readRGB({ width, height })`, which still decodes the full plane.
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
  const x0 = Math.max(0, Math.floor(w / 2 / tileW) * tileW);
  const y0 = Math.max(0, Math.floor(h / 2 / tileH) * tileH);
  const window: [number, number, number, number] = [
    x0,
    y0,
    Math.min(w, x0 + tileW),
    Math.min(h, y0 + tileH),
  ];
  const spp = image.fileDirectory?.SamplesPerPixel ?? 1;
  const bitsRaw = image.fileDirectory?.BitsPerSample?.[0];
  const bits = typeof bitsRaw === "number" ? bitsRaw : 8;
  if (spp >= 3) {
    try {
      const rgb = await image.readRasters({
        samples: [0, 1, 2],
        interleave: true,
        window,
        signal,
      });
      return isBrightfieldRgb(rgb, bits);
    } catch {
      return false;
    }
  }
  const plane = await image.readRasters({
    samples: [0],
    interleave: true,
    window,
    signal,
  });
  return isBrightfieldRgb(scalePlaneToUint8Rgb(plane, bits));
}

/** Packed RGB (1×SPP=3) or three planar channels. */
export async function detectOmeTiffPlanarRgbAmbiguity(
  source: File | string,
  signal?: AbortSignal,
): Promise<boolean> {
  const xml = await getOmeTiffImageDescriptionOmeXml(source, {}, signal);
  if (signal?.aborted) return false;
  return threeChannelOmeFromXml(xml);
}
