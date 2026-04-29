import { fromBlob, fromUrl } from "geotiff";

type GeoTiffWithImage = {
  getImage: (i: number) => Promise<{
    fileDirectory?: { ImageDescription?: string | undefined };
  }>;
};

/**
 * Read the OME-XML from the OME-TIFF (first directory ImageDescription), without loading pixels.
 * Used when @vivjs/loaders metadata omits or drops ROIs (e.g. zod/namespace issues) but the XML is still in the file.
 */
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
    if (typeof desc !== "string" || !desc.trim()) {
      return null;
    }
    return /OME|openmicroscopy|Pixels/i.test(desc) ? desc : null;
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
