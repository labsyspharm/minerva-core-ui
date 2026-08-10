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

const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_LONG8 = 16;

const TAG_NEW_SUBFILE_TYPE = 254;
const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_PHOTOMETRIC = 262;
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
};

/** Seekable byte sink (memory or FileSystemWritableFileStream). */
export type RandomAccessSink = {
  write(position: number, data: Uint8Array): Promise<void>;
  truncate?(size: number): Promise<void>;
  close(): Promise<void>;
};

/** Adapter for Chromium File System Access writable streams. */
export function createFileWritableSink(
  stream: FileSystemWritableFileStream,
): RandomAccessSink {
  return {
    async write(position, data) {
      await stream.write({
        type: "write",
        position,
        data: data as BufferSource,
      });
    },
    async truncate(size) {
      await stream.truncate(size);
    },
    async close() {
      await stream.close();
    },
  };
}

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

function ifdEntryBlockSize(numTags: number): number {
  return 8 + numTags * TIFF_IFD_ENTRY_SIZE + 8;
}

/** Offset tables are patched after tiles land — never store them inline. */
function tagMustOverflow(tag: number): boolean {
  return (
    tag === TAG_TILE_OFFSETS ||
    tag === TAG_TILE_BYTE_COUNTS ||
    tag === TAG_SUB_IFDS
  );
}

function tagIsOutOfLine(t: ResolvedTag): boolean {
  return t.valueBytes.length > INLINE_THRESHOLD || tagMustOverflow(t.tag);
}

function buildUserTags(slot: IfdSlot, subIfdCount: number): ResolvedTag[] {
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
  if (subIfdCount > 0) {
    tags.push(long8ArrayTag(TAG_SUB_IFDS, subIfdCount));
  }
  tags.sort((a, b) => a.tag - b.tag);
  return tags;
}

export class StreamingJpegTiffWriter {
  private readonly mainSlots: IfdSlot[] = [];
  /** Flat list for tile addressing: channel → level → slot */
  private readonly slotsByChannelLevel: IfdSlot[][] = [];
  private dataCursor = 0;
  private metadataEnd = 0;
  private begun = false;
  private finished = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly sink: RandomAccessSink,
    private readonly plan: StreamingJpegTiffPlan,
  ) {
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

  /**
   * Append one JPEG tile (self-contained baseline grayscale).
   * Physical order may be completion order; `tileIndex` is row-major logical index.
   */
  async writeTile(
    channelIndex: number,
    levelIndex: number,
    tileIndex: number,
    jpeg: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    if (!this.begun || this.finished) {
      throw new Error("StreamingJpegTiffWriter: call begin() before writeTile");
    }
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
    const bytes = jpeg instanceof Uint8Array ? jpeg : new Uint8Array(jpeg);
    if (bytes.byteLength === 0) {
      throw new Error("StreamingJpegTiffWriter: empty JPEG tile");
    }

    const run = async () => {
      const offset = this.dataCursor;
      await this.sink.write(offset, bytes);
      slot.tileOffsets[tileIndex] = offset;
      slot.tileByteCounts[tileIndex] = bytes.byteLength;
      slot.tilesWritten += 1;
      this.dataCursor = align8(offset + bytes.byteLength);
    };
    this.writeQueue = this.writeQueue.then(run, run);
    await this.writeQueue;
  }

  /** Patch TileOffsets / TileByteCounts and close the sink. */
  async finish(): Promise<void> {
    if (!this.begun || this.finished) {
      throw new Error("StreamingJpegTiffWriter: invalid finish()");
    }
    await this.writeQueue;

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
        const tags = buildUserTags(slot, slot.subIfds.length);
        const entrySize = ifdEntryBlockSize(tags.length);
        slot.ifdOffset = cursor;
        cursor += entrySize;

        // Overflow: assign file offsets for out-of-line arrays while walking tags.
        let overflowCursor = cursor;
        for (const t of tags) {
          if (!tagIsOutOfLine(t)) continue;
          overflowCursor = align8(overflowCursor);
          if (t.tag === TAG_TILE_OFFSETS) {
            slot.tileOffsetsFileOffset = overflowCursor;
          } else if (t.tag === TAG_TILE_BYTE_COUNTS) {
            slot.tileByteCountsFileOffset = overflowCursor;
          } else if (t.tag === TAG_SUB_IFDS) {
            slot.subIfdsFileOffset = overflowCursor;
          }
          overflowCursor += t.valueBytes.length;
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

    // TIFF header (little-endian)
    view.setUint16(0, 0x4949, true);
    view.setUint16(2, 43, true);
    view.setUint16(4, 8, true);
    view.setUint16(6, 0, true);
    setBigUint64LE(view, 8, this.mainSlots[0]?.ifdOffset ?? 0);

    const writeSlot = (slot: IfdSlot) => {
      const tags = buildUserTags(slot, slot.subIfds.length);
      let pos = slot.ifdOffset;
      setBigUint64LE(view, pos, tags.length);
      pos += 8;

      let overflowCursor = slot.ifdOffset + ifdEntryBlockSize(tags.length);

      for (const t of tags) {
        view.setUint16(pos, t.tag, true);
        view.setUint16(pos + 2, t.type, true);
        setBigUint64LE(view, pos + 4, t.count);
        const valueField = pos + 12;

        if (!tagIsOutOfLine(t)) {
          buf.set(t.valueBytes, valueField);
        } else {
          overflowCursor = align8(overflowCursor);
          setBigUint64LE(view, valueField, overflowCursor);
          buf.set(t.valueBytes, overflowCursor);
          if (t.tag === TAG_SUB_IFDS && slot.subIfdsFileOffset !== null) {
            // Fill SubIFD pointer array with child IFD offsets.
            const subView = new DataView(
              buf.buffer,
              overflowCursor,
              slot.subIfds.length * 8,
            );
            for (let i = 0; i < slot.subIfds.length; i++) {
              setBigUint64LE(subView, i * 8, slot.subIfds[i].ifdOffset);
            }
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
