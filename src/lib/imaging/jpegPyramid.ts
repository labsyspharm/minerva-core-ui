import hash from "stable-hash";

/** Default tile size written by {@link ImageExporter} / read by the JPEG loader. */
export const JPEG_PYRAMID_TILE_SIZE = 1024;

/** Contrast is baked into exported JPEGs; Viv should not re-window. */
export const JPEG_BAKED_CONTRAST_LIMIT: [number, number] = [0, 65535];

/**
 * Folder name under the story root for one exported channel+contrast combo.
 * Must match {@link ImageExporter} `toSaveDirectory`.
 */
export async function jpegPyramidFolderName(
  channelId: string,
  lowerLimit: number,
  upperLimit: number,
): Promise<string> {
  const encoded = hash({ channelId, lowerLimit, upperLimit });
  const bytes = new TextEncoder().encode(encoded);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return digest.toHex();
}

/** Map OME channel index → pyramid folder for the given group rows. */
export async function folderByChannelIndexFromGroup(opts: {
  channels: ReadonlyArray<{
    channelId: string;
    lowerLimit: number;
    upperLimit: number;
  }>;
  channelIndexById: Record<string, number>;
}): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  await Promise.all(
    opts.channels.map(async (row) => {
      const index = opts.channelIndexById[row.channelId];
      if (index === undefined) return;
      out[index] = await jpegPyramidFolderName(
        row.channelId,
        row.lowerLimit,
        row.upperLimit,
      );
    }),
  );
  return out;
}

/** Binary-downsample level indices for an image of the given size. */
export function jpegPyramidLevels(
  width: number,
  height: number,
  tileSize = JPEG_PYRAMID_TILE_SIZE,
): number[] {
  let w = width;
  let h = height;
  let n = 1;
  while ((w > tileSize || h > tileSize) && n < 32) {
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
    n += 1;
  }
  return Array.from({ length: n }, (_, i) => i);
}
