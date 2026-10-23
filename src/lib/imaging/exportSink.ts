import type { RandomAccessSink } from "tiffwriter";

/** Bytes gathered into one file write. */
const WRITE_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Gather consecutive writes into one write per {@link WRITE_CHUNK_BYTES}. The
 * TIFF writer appends each tile, then its alignment pad: two writes a tile,
 * and each write to a picked file is a round trip. On slow storage that is
 * the limit (40–190 ms a write capped one export near 8 tiles/s). A write
 * anywhere else in the file flushes first, so the file sees every write in
 * order.
 */
export function bufferedSink(sink: RandomAccessSink): RandomAccessSink {
  const buffer = new Uint8Array(WRITE_CHUNK_BYTES);
  let start = 0n;
  let length = 0;

  const flush = async () => {
    if (length === 0) return;
    // The stream has taken the bytes once the write resolves, so the buffer
    // can be refilled after it.
    await sink.writeAt(start, buffer.subarray(0, length));
    length = 0;
  };

  return {
    async writeAt(offset, data) {
      const follows = length > 0 && offset === start + BigInt(length);
      if (follows && length + data.byteLength <= buffer.byteLength) {
        buffer.set(data, length);
        length += data.byteLength;
        return;
      }
      await flush();
      if (data.byteLength >= buffer.byteLength) {
        await sink.writeAt(offset, data);
        return;
      }
      buffer.set(data);
      start = offset;
      length = data.byteLength;
    },
    async truncate(size) {
      await flush();
      await sink.truncate?.(size);
    },
    async close() {
      await flush();
      await sink.close?.();
    },
    async abort(reason) {
      length = 0;
      await sink.abort?.(reason);
    },
  };
}
