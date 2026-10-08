import { type DecodePool, Pool } from "@hms-dbmi/viv";
import DecoderWorker from "./workers/decoder.worker?worker";

export type { DecodePool };

type FileDirectory = Record<string, unknown>;

const decoderTags = new WeakMap<object, FileDirectory>();

/**
 * Viv posts the whole file directory with every tile. Offsets and byte counts
 * hold one entry per tile (212k on a 64k-px slide), so cloning them cost
 * ~20 ms of main thread per decode. Decoders never read them (`BaseDecoder`
 * only checks that `StripOffsets` exists), nor the OME-XML.
 */
function withoutBlockTables(fileDirectory: FileDirectory): FileDirectory {
  let tags = decoderTags.get(fileDirectory);
  if (!tags) {
    tags = {
      ...fileDirectory,
      TileOffsets: fileDirectory.TileOffsets && [],
      TileByteCounts: fileDirectory.TileByteCounts && [],
      StripOffsets: fileDirectory.StripOffsets && [],
      StripByteCounts: fileDirectory.StripByteCounts && [],
      ImageDescription: undefined,
    };
    decoderTags.set(fileDirectory, tags);
  }
  return tags;
}

class OmeDecodePool extends Pool {
  decode(fileDirectory: unknown, buffer: ArrayBuffer): Promise<ArrayBuffer> {
    return super.decode(
      withoutBlockTables(fileDirectory as FileDirectory),
      buffer,
    );
  }
}

/** Viv Pool, with a Vite `?worker` factory so the CDN IIFE can inline the decoder. */
export function createOmeDecodePool(): DecodePool {
  return new OmeDecodePool(undefined, () => new DecoderWorker() as Worker);
}
