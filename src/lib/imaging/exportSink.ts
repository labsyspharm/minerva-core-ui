import type { RandomAccessSink } from "tiffwriter";

const WRITE_CHUNK_BYTES = 8 * 1024 * 1024;

/** Coalesce consecutive writes. A write that does not follow flushes first. */
export function bufferedSink(sink: RandomAccessSink): RandomAccessSink {
  const buffer = new Uint8Array(WRITE_CHUNK_BYTES);
  let start = 0n;
  let length = 0;

  const flush = async () => {
    if (length === 0) return;
    // writeAt may keep this view until it resolves.
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
