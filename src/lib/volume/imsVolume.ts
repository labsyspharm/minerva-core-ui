import type { ImsChannelInfo } from "kiln-render";
import { urlFileName } from "@/lib/imaging/sourceUrl";
import type {
  ChannelGroup,
  Image,
  ImageChannel,
  ImageSourceVolume,
} from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { MAX_VOLUME_CHANNELS } from "./volumeChannels";

/** kiln-render is ~2 MB; only stories with a volume load it. */
export const loadKiln = () => import("kiln-render");

/** `.ims` path (query / hash ignored). */
export function looksLikeImsUrl(url: string): boolean {
  try {
    return /\.ims$/i.test(new URL(url, "https://x.invalid").pathname);
  } catch {
    return /\.ims(?:[?#]|$)/i.test(url);
  }
}

export type VolumeProbe = {
  name: string;
  /** Finest-level voxels [x, y, z] */
  dimensions: [number, number, number];
  /** File voxel type, e.g. "float32", "uint16" */
  dtype: string;
  channels: ImsChannelInfo[];
};

/** Read Imaris metadata (header + attributes only; no voxel data). */
export async function probeImsVolume(url: string): Promise<VolumeProbe> {
  const { ImarisDataProvider } = await loadKiln();
  const provider = new ImarisDataProvider(url, { workers: 1 });
  try {
    const meta = await provider.initialize();
    return {
      name: meta.name,
      dimensions: meta.dimensions,
      dtype: meta.sourceDataType ?? "uint16",
      channels: provider.allChannels,
    };
  } finally {
    provider.dispose();
  }
}

const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);

/**
 * Document records for a volume import: the image (channels carry the file's
 * names, colours and display ranges) and channel groups of up to six
 * channels each — the most the volume renderer composites at once.
 */
export function buildVolumeImport(
  url: string,
  probe: VolumeProbe,
): { image: Image; channelGroups: ChannelGroup[] } {
  const imageId = crypto.randomUUID();
  const rows: ChannelGroup["channels"] = [];
  const channels: ImageChannel[] = probe.channels.map((c) => {
    const [lo, hi] = c.displayRange ?? c.range;
    const color = {
      r: to255(c.color[0]),
      g: to255(c.color[1]),
      b: to255(c.color[2]),
    };
    const id = crypto.randomUUID();
    rows.push({
      id: crypto.randomUUID(),
      channelId: id,
      color,
      lowerLimit: lo,
      upperLimit: hi,
    });
    return {
      id,
      index: c.index,
      name: c.name || `Channel ${c.index + 1}`,
      kind: "channel",
      sourceDataTypeId: probe.dtype,
      floatRange: { min: c.range[0], max: c.range[1] },
      gmmContrastLimits: { lower: lo, upper: hi },
      color,
      lowerLimit: lo,
      upperLimit: hi,
    };
  });
  const [sizeX, sizeY] = probe.dimensions;
  const leaf = decodeURIComponent(urlFileName(url));
  const image: Image = {
    id: imageId,
    sizeX,
    sizeY,
    sizeC: channels.length,
    omeXmlHash: `ims:${url}`,
    basename: leaf || probe.name || "volume.ims",
    contentRole: "intensity",
    rotationDegrees: 0,
    flipHorizontal: false,
    flipVertical: false,
    translateX: 0,
    translateY: 0,
    displayScale: 1,
    opacity: 1,
    channels,
    source: { kind: "volume", url, format: "ims" },
  };
  const channelGroups: ChannelGroup[] = [];
  for (let i = 0; i < rows.length; i += MAX_VOLUME_CHANNELS) {
    const members = rows.slice(i, i + MAX_VOLUME_CHANNELS);
    channelGroups.push({
      id: crypto.randomUUID(),
      name:
        channels.length <= MAX_VOLUME_CHANNELS
          ? "All channels"
          : `Channels ${i + 1}–${i + members.length}`,
      channels: members,
    });
  }
  return { image, channelGroups };
}

export function isVolumeImage(
  im: Image | undefined,
): im is Image & { source: ImageSourceVolume } {
  return im?.source?.kind === "volume";
}

/** The story's 3D volume image, if any. */
export function useVolumeImage() {
  return useDocumentStore((s) => s.images.find(isVolumeImage));
}
