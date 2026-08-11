/**
 * Streaming TIFF writer for JPEG-compressed tiles (Compression=7).
 *
 * Layout: TIFF header (64-bit offsets) → reserved IFD/overflow metadata → appended JPEG tiles
 * (completion order). TileOffsets / TileByteCounts are patched in {@link finish}.
 *
 * IFD/tag layout ideas adapted from @fideus-labs/fiff (MIT), with fixed
 * 8-byte alignment throughout and a seekable sink instead of a full ArrayBuffer.
 */

import { JPEG_PYRAMID_TILE_SIZE } from "./jpegPyramid";

/** TIFF Compression tag value for JPEG (Tech Note 2). */
const TIFF_COMPRESSION_JPEG = 7;
/** PhotometricInterpretation BlackIsZero (grayscale). */
const TIFF_PHOTOMETRIC_BLACK_IS_ZERO = 1;

const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_LONG8 = 16;
/** BigTIFF IFD offset type — required for SubIFDs (Bio-Formats / QuPath). */
const TIFF_TYPE_IFD8 = 18;

const TAG_NEW_SUBFILE_TYPE = 254;
const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_PHOTOMETRIC = 262;
/** ImageDescription — OME-XML for Viv `loadOmeTiff`. */
const TAG_IMAGE_DESCRIPTION = 270;
const TAG_SAMPLES_PER_PIXEL = 277;
const TAG_PLANAR_CONFIGURATION = 284;
const TAG_TILE_WIDTH = 322;
const TAG_TILE_LENGTH = 323;
const TAG_TILE_OFFSETS = 324;
const TAG_TILE_BYTE_COUNTS = 325;
const TAG_SUB_IFDS = 330;
const TAG_SAMPLE_FORMAT = 339;

const TIFF_HEADER_SIZE = 16;
const TIFF_IFD_ENTRY_SIZE = 20;
const INLINE_THRESHOLD = 8;

function align8(n: number): number {
  return (n + 7) & ~7;
}

export function tilesAcross(width: number, tileWidth: number): number {
  return Math.ceil(width / tileWidth);
}

export function tilesDown(height: number, tileLength: number): number {
  return Math.ceil(height / tileLength);
}

export function tileCountForSize(
  width: number,
  height: number,
  tileWidth: number,
  tileLength: number,
): number {
  return tilesAcross(width, tileWidth) * tilesDown(height, tileLength);
}

/** One pyramid level (full-res or reduced). */
export type JpegTiffLevelPlan = {
  width: number;
  height: number;
  tileWidth?: number;
  tileLength?: number;
};

/** One intensity channel: level 0 is full resolution. */
export type JpegTiffChannelPlan = {
  levels: JpegTiffLevelPlan[];
};

export type StreamingJpegTiffPlan = {
  channels: JpegTiffChannelPlan[];
  /**
   * OME-XML written as TIFF ImageDescription on the first IFD.
   * Required for Viv `loadOmeTiff` (it calls `ImageDescription.replace`).
   */
  omeXml?: string;
};

/** Seekable byte sink (memory or FileSystemWritableFileStream). */
export type RandomAccessSink = {
  write(position: number, data: Uint8Array): Promise<void>;
  truncate?(size: number): Promise<void>;
  close(): Promise<void>;
};

/**
 * Adapter for Chromium File System Access writable streams.
 * Sequential writes at the current cursor append without seeking; random
 * positions (IFD patches) still seek.
 */
export function createFileWritableSink(
  stream: FileSystemWritableFileStream,
): RandomAccessSink {
  let cursor = 0;
  return {
    async write(position, data) {
      if (position === cursor) {
        await stream.write({
          type: "write",
          data: data as BufferSource,
        });
      } else {
        await stream.write({
          type: "write",
          position,
          data: data as BufferSource,
        });
      }
      cursor = position + data.byteLength;
    },
    async truncate(size) {
      await stream.truncate(size);
      cursor = size;
    },
    async close() {
      await stream.close();
    },
  };
}

/** Cap encoded-but-not-yet-written JPEG bytes so encode cannot race ahead unboundedly. */
const DEFAULT_JPEG_TIFF_PENDING_BUDGET = 48 * 1024 * 1024;

type ResolvedTag = {
  tag: number;
  type: number;
  count: number;
  valueBytes: Uint8Array;
};

type IfdSlot = {
  channelIndex: number;
  levelIndex: number;
  width: number;
  height: number;
  tileWidth: number;
  tileLength: number;
  tileCount: number;
  newSubfileType: number;
  /** Absolute IFD entry-block offset. */
  ifdOffset: number;
  nextIfdOffset: number;
  /** Absolute offsets of LONG8 arrays in overflow. */
  tileOffsetsFileOffset: number;
  tileByteCountsFileOffset: number;
  subIfdsFileOffset: number | null;
  tileOffsets: number[];
  tileByteCounts: number[];
  tilesWritten: number;
  /** Child SubIFD slots (pyramid levels > 0). */
  subIfds: IfdSlot[];
};

function setBigUint64LE(view: DataView, offset: number, value: number): void {
  const lo = value >>> 0;
  const hi = Math.floor(value / 0x1_0000_0000) >>> 0;
  view.setUint32(offset, lo, true);
  view.setUint32(offset + 4, hi, true);
}

function shortTag(tag: number, value: number): ResolvedTag {
  const valueBytes = new Uint8Array(2);
  new DataView(valueBytes.buffer).setUint16(0, value, true);
  return { tag, type: TIFF_TYPE_SHORT, count: 1, valueBytes };
}

function longTag(tag: number, value: number): ResolvedTag {
  const valueBytes = new Uint8Array(4);
  new DataView(valueBytes.buffer).setUint32(0, value, true);
  return { tag, type: TIFF_TYPE_LONG, count: 1, valueBytes };
}

function long8ArrayTag(tag: number, count: number): ResolvedTag {
  return {
    tag,
    type: TIFF_TYPE_LONG8,
    count,
    valueBytes: new Uint8Array(count * 8),
  };
}

/** SubIFD pointer array (BigTIFF IFD8 offsets). */
function ifd8ArrayTag(tag: number, count: number): ResolvedTag {
  return {
    tag,
    type: TIFF_TYPE_IFD8,
    count,
    valueBytes: new Uint8Array(count * 8),
  };
}

/** TIFF ASCII values are NUL-terminated; `count` includes the terminator. */
function asciiTag(tag: number, text: string): ResolvedTag {
  const encoded = new TextEncoder().encode(text);
  const valueBytes = new Uint8Array(encoded.length + 1);
  valueBytes.set(encoded);
  return {
    tag,
    type: TIFF_TYPE_ASCII,
    count: valueBytes.length,
    valueBytes,
  };
}

function ifdEntryBlockSize(numTags: number): number {
  return 8 + numTags * TIFF_IFD_ENTRY_SIZE + 8;
}

/**
 * BigTIFF stores values inline when `count * typeSize <= 8`. Forcing a pointer
 * in that case is invalid: readers treat the pointer bytes as the value
 * (e.g. TileOffsets[0] = overflow address → SOI not found).
 */
function tagIsOutOfLine(t: ResolvedTag): boolean {
  return t.valueBytes.length > INLINE_THRESHOLD;
}

function buildUserTags(
  slot: IfdSlot,
  subIfdCount: number,
  imageDescription?: string,
): ResolvedTag[] {
  const tags: ResolvedTag[] = [
    shortTag(TAG_NEW_SUBFILE_TYPE, slot.newSubfileType),
    longTag(TAG_IMAGE_WIDTH, slot.width),
    longTag(TAG_IMAGE_LENGTH, slot.height),
    shortTag(TAG_BITS_PER_SAMPLE, 8),
    shortTag(TAG_COMPRESSION, TIFF_COMPRESSION_JPEG),
    shortTag(TAG_PHOTOMETRIC, TIFF_PHOTOMETRIC_BLACK_IS_ZERO),
    shortTag(TAG_SAMPLES_PER_PIXEL, 1),
    shortTag(TAG_PLANAR_CONFIGURATION, 1),
    longTag(TAG_TILE_WIDTH, slot.tileWidth),
    longTag(TAG_TILE_LENGTH, slot.tileLength),
    long8ArrayTag(TAG_TILE_OFFSETS, slot.tileCount),
    long8ArrayTag(TAG_TILE_BYTE_COUNTS, slot.tileCount),
    shortTag(TAG_SAMPLE_FORMAT, 1),
  ];
  if (imageDescription) {
    tags.push(asciiTag(TAG_IMAGE_DESCRIPTION, imageDescription));
  }
  if (subIfdCount > 0) {
    tags.push(ifd8ArrayTag(TAG_SUB_IFDS, subIfdCount));
  }
  tags.sort((a, b) => a.tag - b.tag);
  return tags;
}

export type StreamingJpegTiffWriterOpts = {
  /** Invoked once when a queued write fails. */
  onWriteError?: (error: Error) => void;
};

export class StreamingJpegTiffWriter {
  private readonly mainSlots: IfdSlot[] = [];
  /** Flat list for tile addressing: channel → level → slot */
  private readonly slotsByChannelLevel: IfdSlot[][] = [];
  private dataCursor = 0;
  private metadataEnd = 0;
  private begun = false;
  private finished = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private pendingBytes = 0;
  private readonly pendingBudget: number;
  private readonly onWriteError?: (error: Error) => void;
  private writeError: Error | null = null;
  private writeErrorReported = false;
  private readonly pendingWaiters: Array<() => void> = [];

  constructor(
    private readonly sink: RandomAccessSink,
    private readonly plan: StreamingJpegTiffPlan,
    opts?: StreamingJpegTiffWriterOpts,
  ) {
    this.pendingBudget = DEFAULT_JPEG_TIFF_PENDING_BUDGET;
    this.onWriteError = opts?.onWriteError;
    if (!plan.channels.length) {
      throw new Error("StreamingJpegTiffWriter: no channels");
    }
    for (const ch of plan.channels) {
      if (!ch.levels?.length) {
        throw new Error("StreamingJpegTiffWriter: channel has no levels");
      }
    }
  }

  getIfdSlot(channelIndex: number, levelIndex: number): IfdSlot {
    const slot = this.slotsByChannelLevel[channelIndex]?.[levelIndex];
    if (!slot) {
      throw new Error(
        `StreamingJpegTiffWriter: missing IFD c=${channelIndex} l=${levelIndex}`,
      );
    }
    return slot;
  }

  /** Write header + placeholder IFDs / offset tables. */
  async begin(): Promise<void> {
    if (this.begun) throw new Error("StreamingJpegTiffWriter: already begun");
    this.planLayout();
    const meta = this.serializeMetadataPlaceholders();
    await this.sink.write(0, meta);
    this.begun = true;
  }

  private reportWriteError(error: Error): void {
    if (!this.writeError) this.writeError = error;
    while (this.pendingWaiters.length > 0) {
      this.pendingWaiters.shift()?.();
    }
    if (this.writeErrorReported) return;
    this.writeErrorReported = true;
    this.onWriteError?.(this.writeError);
  }

  private releasePending(bytes: number): void {
    this.pendingBytes = Math.max(0, this.pendingBytes - bytes);
    while (
      this.pendingWaiters.length > 0 &&
      this.pendingBytes < this.pendingBudget
    ) {
      const wake = this.pendingWaiters.shift();
      wake?.();
    }
  }

  private async waitForBudget(bytes: number): Promise<void> {
    while (
      this.pendingBytes + bytes > this.pendingBudget &&
      this.pendingBytes > 0
    ) {
      if (this.writeError) throw this.writeError;
      await new Promise<void>((resolve) => {
        this.pendingWaiters.push(resolve);
      });
    }
    if (this.writeError) throw this.writeError;
  }

  /**
   * Queue one JPEG tile for append. Resolves after backpressure allows enqueue
   * (not after the disk write). Physical order may be completion order;
   * `tileIndex` is row-major logical index.
   */
  async enqueueTile(
    channelIndex: number,
    levelIndex: number,
    tileIndex: number,
    jpeg: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    if (!this.begun || this.finished) {
      throw new Error(
        "StreamingJpegTiffWriter: call begin() before enqueueTile",
      );
    }
    if (this.writeError) throw this.writeError;

    const slot = this.getIfdSlot(channelIndex, levelIndex);
    if (tileIndex < 0 || tileIndex >= slot.tileCount) {
      throw new Error(
        `StreamingJpegTiffWriter: tileIndex ${tileIndex} out of range 0..${slot.tileCount - 1}`,
      );
    }
    if (slot.tileOffsets[tileIndex] !== 0) {
      throw new Error(
        `StreamingJpegTiffWriter: tile c=${channelIndex} l=${levelIndex} i=${tileIndex} already written`,
      );
    }
    const src = jpeg instanceof Uint8Array ? jpeg : new Uint8Array(jpeg);
    if (src.byteLength === 0) {
      throw new Error("StreamingJpegTiffWriter: empty JPEG tile");
    }
    // Own the buffer so callers can reuse memory after enqueue returns.
    const bytes = new Uint8Array(src);

    await this.waitForBudget(bytes.byteLength);
    if (this.writeError) throw this.writeError;

    // Reserve slot synchronously so concurrent encoders cannot double-write.
    slot.tileOffsets[tileIndex] = -1;
    this.pendingBytes += bytes.byteLength;

    const run = async () => {
      if (this.writeError) {
        this.releasePending(bytes.byteLength);
        return;
      }
      try {
        const offset = this.dataCursor;
        await this.sink.write(offset, bytes);
        const aligned = align8(offset + bytes.byteLength);
        const pad = aligned - (offset + bytes.byteLength);
        if (pad > 0) {
          await this.sink.write(offset + bytes.byteLength, new Uint8Array(pad));
        }
        slot.tileOffsets[tileIndex] = offset;
        slot.tileByteCounts[tileIndex] = bytes.byteLength;
        slot.tilesWritten += 1;
        this.dataCursor = aligned;
      } catch (e) {
        const err =
          e instanceof Error ? e : new Error(String(e ?? "tile write failed"));
        this.reportWriteError(err);
        throw err;
      } finally {
        this.releasePending(bytes.byteLength);
      }
    };

    this.writeQueue = this.writeQueue.then(run, (prevErr) => {
      const err =
        prevErr instanceof Error
          ? prevErr
          : new Error(String(prevErr ?? "tile write failed"));
      this.reportWriteError(err);
      this.releasePending(bytes.byteLength);
      return Promise.reject(err);
    });
  }

  /** Patch TileOffsets / TileByteCounts and close the sink. */
  async finish(): Promise<void> {
    if (!this.begun || this.finished) {
      throw new Error("StreamingJpegTiffWriter: invalid finish()");
    }
    try {
      await this.writeQueue;
    } catch {
      /* writeError recorded below */
    }
    if (this.writeError) throw this.writeError;

    for (const channel of this.slotsByChannelLevel) {
      for (const slot of channel) {
        if (slot.tilesWritten !== slot.tileCount) {
          throw new Error(
            `StreamingJpegTiffWriter: channel ${slot.channelIndex} level ${slot.levelIndex}: wrote ${slot.tilesWritten}/${slot.tileCount} tiles`,
          );
        }
        await this.patchLong8Array(
          slot.tileOffsetsFileOffset,
          slot.tileOffsets,
        );
        await this.patchLong8Array(
          slot.tileByteCountsFileOffset,
          slot.tileByteCounts,
        );
      }
    }

    if (this.sink.truncate) {
      await this.sink.truncate(this.dataCursor);
    }
    await this.sink.close();
    this.finished = true;
  }

  private planLayout(): void {
    let cursor = TIFF_HEADER_SIZE;
    this.mainSlots.length = 0;
    this.slotsByChannelLevel.length = 0;
    const omeXml = this.plan.omeXml?.trim() || undefined;

    for (let c = 0; c < this.plan.channels.length; c++) {
      const levels = this.plan.channels[c].levels;
      const channelSlots: IfdSlot[] = [];

      const makeSlot = (levelIndex: number): IfdSlot => {
        const level = levels[levelIndex];
        const tileWidth = level.tileWidth ?? JPEG_PYRAMID_TILE_SIZE;
        const tileLength = level.tileLength ?? JPEG_PYRAMID_TILE_SIZE;
        const count = tileCountForSize(
          level.width,
          level.height,
          tileWidth,
          tileLength,
        );
        return {
          channelIndex: c,
          levelIndex,
          width: level.width,
          height: level.height,
          tileWidth,
          tileLength,
          tileCount: count,
          newSubfileType: levelIndex === 0 ? 0 : 1,
          ifdOffset: 0,
          nextIfdOffset: 0,
          tileOffsetsFileOffset: 0,
          tileByteCountsFileOffset: 0,
          subIfdsFileOffset: null,
          tileOffsets: new Array(count).fill(0),
          tileByteCounts: new Array(count).fill(0),
          tilesWritten: 0,
          subIfds: [],
        };
      };

      const full = makeSlot(0);
      for (let l = 1; l < levels.length; l++) {
        full.subIfds.push(makeSlot(l));
      }

      const placeSlot = (slot: IfdSlot) => {
        const description =
          slot.channelIndex === 0 && slot.levelIndex === 0 ? omeXml : undefined;
        const tags = buildUserTags(slot, slot.subIfds.length, description);
        const entrySize = ifdEntryBlockSize(tags.length);
        slot.ifdOffset = cursor;
        let entryPos = cursor + 8;
        cursor += entrySize;

        // Record patch sites (inline value field or overflow) while walking tags.
        let overflowCursor = cursor;
        for (const t of tags) {
          const valueField = entryPos + 12;
          if (tagIsOutOfLine(t)) {
            overflowCursor = align8(overflowCursor);
            if (t.tag === TAG_TILE_OFFSETS) {
              slot.tileOffsetsFileOffset = overflowCursor;
            } else if (t.tag === TAG_TILE_BYTE_COUNTS) {
              slot.tileByteCountsFileOffset = overflowCursor;
            } else if (t.tag === TAG_SUB_IFDS) {
              slot.subIfdsFileOffset = overflowCursor;
            }
            overflowCursor += t.valueBytes.length;
          } else if (t.tag === TAG_TILE_OFFSETS) {
            slot.tileOffsetsFileOffset = valueField;
          } else if (t.tag === TAG_TILE_BYTE_COUNTS) {
            slot.tileByteCountsFileOffset = valueField;
          } else if (t.tag === TAG_SUB_IFDS) {
            slot.subIfdsFileOffset = valueField;
          }
          entryPos += TIFF_IFD_ENTRY_SIZE;
        }
        cursor = align8(overflowCursor);

        for (const sub of slot.subIfds) {
          placeSlot(sub);
        }
      };

      placeSlot(full);
      this.mainSlots.push(full);
      channelSlots.push(full, ...full.subIfds);
      this.slotsByChannelLevel.push(channelSlots);
    }

    for (let i = 0; i < this.mainSlots.length - 1; i++) {
      this.mainSlots[i].nextIfdOffset = this.mainSlots[i + 1].ifdOffset;
    }

    this.metadataEnd = align8(cursor);
    this.dataCursor = this.metadataEnd;
  }

  private serializeMetadataPlaceholders(): Uint8Array {
    const buf = new Uint8Array(this.metadataEnd);
    const view = new DataView(buf.buffer);
    const omeXml = this.plan.omeXml?.trim() || undefined;

    // TIFF header (little-endian)
    view.setUint16(0, 0x4949, true);
    view.setUint16(2, 43, true);
    view.setUint16(4, 8, true);
    view.setUint16(6, 0, true);
    setBigUint64LE(view, 8, this.mainSlots[0]?.ifdOffset ?? 0);

    const writeSlot = (slot: IfdSlot) => {
      const description =
        slot.channelIndex === 0 && slot.levelIndex === 0 ? omeXml : undefined;
      const tags = buildUserTags(slot, slot.subIfds.length, description);
      let pos = slot.ifdOffset;
      setBigUint64LE(view, pos, tags.length);
      pos += 8;

      let overflowCursor = slot.ifdOffset + ifdEntryBlockSize(tags.length);

      for (const t of tags) {
        view.setUint16(pos, t.tag, true);
        view.setUint16(pos + 2, t.type, true);
        setBigUint64LE(view, pos + 4, t.count);
        const valueField = pos + 12;

        const fillSubIfdPointers = (at: number) => {
          const subView = new DataView(buf.buffer, at, slot.subIfds.length * 8);
          for (let i = 0; i < slot.subIfds.length; i++) {
            setBigUint64LE(subView, i * 8, slot.subIfds[i].ifdOffset);
          }
        };

        if (!tagIsOutOfLine(t)) {
          buf.set(t.valueBytes, valueField);
          if (t.tag === TAG_SUB_IFDS) {
            fillSubIfdPointers(valueField);
          }
        } else {
          overflowCursor = align8(overflowCursor);
          setBigUint64LE(view, valueField, overflowCursor);
          buf.set(t.valueBytes, overflowCursor);
          if (t.tag === TAG_SUB_IFDS) {
            fillSubIfdPointers(overflowCursor);
          }
          overflowCursor += t.valueBytes.length;
        }
        pos += TIFF_IFD_ENTRY_SIZE;
      }

      setBigUint64LE(view, pos, slot.nextIfdOffset);

      for (const sub of slot.subIfds) {
        writeSlot(sub);
      }
    };

    for (const main of this.mainSlots) {
      writeSlot(main);
    }

    return buf;
  }

  private async patchLong8Array(
    fileOffset: number,
    values: number[],
  ): Promise<void> {
    const bytes = new Uint8Array(values.length * 8);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < values.length; i++) {
      setBigUint64LE(view, i * 8, values[i]);
    }
    await this.sink.write(fileOffset, bytes);
  }
}
