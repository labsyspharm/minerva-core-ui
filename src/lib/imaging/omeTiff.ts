import { fromBlob, fromUrl, GeoTIFFImage as GeoTIFFImageClass } from "geotiff";
import { isBrightfieldRgb } from "@/lib/imaging/brightfieldDetect";
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
  readRGB: (options: {
    width?: number;
    height?: number;
    interleave?: boolean;
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

export type PlanarRgbAmbiguity =
  | {
      ambiguous: true;
      /** Suggested chip: true = Brightfield, false = Fluorescence. */
      defaultRgbDisplay: boolean;
    }
  | { ambiguous: false };

/** Packed RGB (one × SPP=3) or three planar SPP=1 channels. */
function isThreeChannelOme(
  channels: readonly { name: string; samples: number }[],
): boolean {
  if (channels.length === 1 && channels[0].samples === 3) return true;
  const planar = channels.filter((c) => c.samples === 1);
  return planar.length === 3 && planar.length === channels.length;
}

function threeChannelOmeFromXml(omeXml: string | null | undefined): boolean {
  if (omeXml == null || omeXml.trim() === "") return false;
  const doc = new DOMParser().parseFromString(omeXml, "application/xml");
  const pixels = doc.querySelector("Image")?.querySelector("Pixels");
  if (!pixels) return false;
  const channelEls = [...pixels.querySelectorAll(":scope > Channel")];
  if (channelEls.length === 0) return false;
  const channels = channelEls.map((ch) => {
    const raw = ch.getAttribute("SamplesPerPixel");
    let samples = 1;
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) samples = n;
    }
    return {
      name: ch.getAttribute("Name") ?? ch.getAttribute("ID") ?? "",
      samples,
    };
  });
  return isThreeChannelOme(channels);
}

/** Thumbnail max edge for QuPath-style dark/light. */
const BRIGHTFIELD_THUMB_MAX = 256;

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
 * QuPath dark/light on the coarsest pyramid level (SubIFD when present).
 * geotiff `readRGB({ width, height })` still decodes full-res first — slow.
 */
async function detectOmeTiffBrightfield(
  source: Blob | string,
  signal?: AbortSignal,
): Promise<boolean> {
  const tiff = await openOmeTiff(source, signal);
  const image = await getCoarsestTiffImage(tiff);
  const w = image.getWidth();
  const h = image.getHeight();
  const scale = Math.min(1, BRIGHTFIELD_THUMB_MAX / Math.max(w, h, 1));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const spp = image.fileDirectory?.SamplesPerPixel ?? 1;
  const bitsRaw = image.fileDirectory?.BitsPerSample?.[0];
  const bits = typeof bitsRaw === "number" ? bitsRaw : 8;
  if (spp >= 3) {
    try {
      const rgb = await image.readRGB({
        width: tw,
        height: th,
        interleave: true,
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
    window: [0, 0, w, h],
    width: tw,
    height: th,
    signal,
  });
  return isBrightfieldRgb(scalePlaneToUint8Rgb(plane, bits));
}

/**
 * For 3-channel OME: skip mask heuristics and suggest Brightfield vs Fluorescence
 * via dark/light. Otherwise `{ ambiguous: false }` (caller may run mask).
 */
export async function detectOmeTiffPlanarRgbAmbiguity(
  source: File | string,
  signal?: AbortSignal,
): Promise<PlanarRgbAmbiguity> {
  const xml = await getOmeTiffImageDescriptionOmeXml(source, {}, signal);
  if (signal?.aborted) return { ambiguous: false };
  if (!threeChannelOmeFromXml(xml)) return { ambiguous: false };
  const defaultRgbDisplay = await detectOmeTiffBrightfield(source, signal);
  if (signal?.aborted) return { ambiguous: false };
  return { ambiguous: true, defaultRgbDisplay };
}
