import { fromBlob, fromUrl } from "geotiff";
import { isBrightfieldRgb } from "@/lib/imaging/brightfieldDetect";
import { planarRgbSlotFromName } from "@/lib/imaging/channelKind";
import { classify, type MaskDetectResult } from "@/lib/imaging/maskDetect";

type GeoTiffImage = {
  fileDirectory?: {
    ImageDescription?: string | undefined;
    BitsPerSample?: number[];
    SampleFormat?: number[];
    SamplesPerPixel?: number;
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
};

async function openOmeTiff(source: Blob | string, signal?: AbortSignal) {
  return (
    typeof source === "string"
      ? await fromUrl(source, {}, signal)
      : await fromBlob(source, signal)
  ) as GeoTiffWithImage;
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
      /** Suggested import chip: true = Color image, false = Separate channels. */
      defaultRgbDisplay: boolean;
    }
  | { ambiguous: false };

/**
 * Unnamed 3-channel planar OME (SamplesPerPixel 1/omitted) needs an import
 * choice. Packed RGB and named HE_r/g/b are not ambiguous.
 * Suggestion (`defaultRgbDisplay`) comes from pixel dark/light in
 * {@link detectOmeTiffPlanarRgbAmbiguity}.
 */
function classifyPlanarRgbAmbiguity(args: {
  channels: readonly { name: string; samples: number }[];
}): { ambiguous: true } | { ambiguous: false } {
  const { channels } = args;
  if (channels.length === 0) return { ambiguous: false };
  const planar = channels.filter((c) => c.samples === 1);
  if (planar.length !== 3 || planar.length !== channels.length) {
    return { ambiguous: false };
  }
  if (planar.every((c) => planarRgbSlotFromName(c.name) != null)) {
    return { ambiguous: false };
  }
  return { ambiguous: true };
}

function classifyPlanarRgbAmbiguityFromOmeXml(
  omeXml: string | null | undefined,
): { ambiguous: true } | { ambiguous: false } {
  if (omeXml == null || omeXml.trim() === "") return { ambiguous: false };
  const doc = new DOMParser().parseFromString(omeXml, "application/xml");
  const pixels = doc.querySelector("Image")?.querySelector("Pixels");
  if (!pixels) return { ambiguous: false };

  const channelEls = [...pixels.querySelectorAll(":scope > Channel")];
  if (channelEls.length === 0) return { ambiguous: false };

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

  return classifyPlanarRgbAmbiguity({ channels });
}

/** Thumbnail max edge for QuPath-style dark/light (8-bit RGB). */
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
 * QuPath dark/light on a downsampled thumbnail.
 * Packed RGB uses `readRGB` (handles YCbCr); planar falls back to channel 0
 * as gray RGB after dtype→8-bit scaling.
 */
async function detectOmeTiffBrightfield(
  source: Blob | string,
  signal?: AbortSignal,
): Promise<boolean> {
  const image = await (await openOmeTiff(source, signal)).getImage(0);
  const w = image.getWidth();
  const h = image.getHeight();
  const scale = Math.min(1, BRIGHTFIELD_THUMB_MAX / Math.max(w, h, 1));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const spp = image.fileDirectory?.SamplesPerPixel ?? 1;
  if (spp >= 3) {
    try {
      const rgb = await image.readRGB({
        width: tw,
        height: th,
        interleave: true,
        signal,
      });
      return isBrightfieldRgb(rgb);
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
  const bits = image.fileDirectory?.BitsPerSample?.[0] ?? 8;
  return isBrightfieldRgb(scalePlaneToUint8Rgb(plane, bits));
}

/** Peek OME-XML; if ambiguous, suggest Color vs Separate via brightfield pixels. */
export async function detectOmeTiffPlanarRgbAmbiguity(
  source: File | string,
  signal?: AbortSignal,
): Promise<PlanarRgbAmbiguity> {
  const xml = await getOmeTiffImageDescriptionOmeXml(source, {}, signal);
  if (signal?.aborted) return { ambiguous: false };
  const classified = classifyPlanarRgbAmbiguityFromOmeXml(xml);
  if (!classified.ambiguous) return { ambiguous: false };
  const defaultRgbDisplay = await detectOmeTiffBrightfield(source, signal);
  if (signal?.aborted) return { ambiguous: false };
  return { ambiguous: true, defaultRgbDisplay };
}
