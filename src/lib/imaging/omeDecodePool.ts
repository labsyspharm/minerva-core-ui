import { type DecodePool, Pool } from "@hms-dbmi/viv";
import { exportSpan } from "./exportProfile";
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

export class OmeDecodePool extends Pool {
  decode(fileDirectory: unknown, buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const done = exportSpan("decode");
    return super
      .decode(withoutBlockTables(fileDirectory as FileDirectory), buffer)
      .finally(() => done());
  }

  /** Decode, then widen the uint8 samples to uint16 through `lut` in the worker. */
  decodeWidened(
    fileDirectory: unknown,
    buffer: ArrayBuffer,
    lut: Uint16Array,
  ): Promise<ArrayBuffer> {
    const done = exportSpan("decode");
    // `decoder.worker.ts` widens through the table in this extra tag.
    return super
      .decode(
        {
          ...withoutBlockTables(fileDirectory as FileDirectory),
          MinervaWidenLut: lut,
        },
        buffer,
      )
      .finally(() => done());
  }
}

let sharedPool: DecodePool | null = null;

/**
 * The one decode pool, created on first use. Each pool starts a worker per
 * core and never stops them. The Vite `?worker` factory lets the CDN bundle
 * inline the decoder.
 */
export function sharedOmeDecodePool(): DecodePool {
  sharedPool ??= new OmeDecodePool(
    undefined,
    () => new DecoderWorker() as Worker,
  );
  return sharedPool;
}
