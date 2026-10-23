import decodeJpeg from "@jsquash/jpeg/decode";
import { addDecoder, BaseDecoder, getDecoder } from "geotiff";
import { decompress } from "lzw-tiff-decoder";

interface FileDirectory {
  TileWidth?: number;
  TileLength?: number;
  ImageWidth: number;
  ImageLength: number;
  BitsPerSample?: ArrayLike<number> | number;
  SamplesPerPixel?: number;
  /** 1 = interleaved samples in each tile; 2 = one sample per tile. */
  PlanarConfiguration?: number;
  /** 6 = YCbCr. */
  PhotometricInterpretation?: number;
  /** Shared DQT/DHT segments (SOI … EOI) for abbreviated JPEG tiles. */
  JPEGTables?: ArrayLike<number>;
}

/** Samples stored in one tile: planar tiles hold one, interleaved hold all. */
function samplesPerTile(fileDirectory: FileDirectory): number {
  const bits = fileDirectory.BitsPerSample;
  const samples =
    fileDirectory.PlanarConfiguration === 2
      ? 1
      : (fileDirectory.SamplesPerPixel ??
        (typeof bits === "number" ? 1 : (bits?.length ?? 1)));
  return Math.max(1, samples);
}

class LZWDecoder extends BaseDecoder {
  maxUncompressedSize: number;

  constructor(fileDirectory: FileDirectory) {
    super();
    const width = fileDirectory.TileWidth || fileDirectory.ImageWidth;
    const height = fileDirectory.TileLength || fileDirectory.ImageLength;
    const bits = fileDirectory.BitsPerSample;
    const bits0 = typeof bits === "number" ? bits : (bits?.[0] ?? 8);
    // Planar tiles store one sample. Interleaved RGB is width*height*samples;
    // sizing for one sample truncates the buffer and the predictor throws.
    this.maxUncompressedSize = Math.ceil(
      width * height * (bits0 / 8) * samplesPerTile(fileDirectory),
    );
  }

  async decodeBlock(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    const decoded = await decompress(bytes, this.maxUncompressedSize);
    return decoded.buffer;
  }
}

// MozJPEG builds its result with `new ImageData`. Not every worker global has it.
if (typeof globalThis.ImageData === "undefined") {
  (globalThis as { ImageData?: unknown }).ImageData = class {
    constructor(
      public data: Uint8ClampedArray,
      public width: number,
      public height: number,
    ) {}
  };
}

type DecoderClass = new (fileDirectory: FileDirectory) => BaseDecoder;

/**
 * geotiff's own JPEG decoder, for tiles MozJPEG cannot return as RGBA (CMYK).
 * Set by `registerJpegDecoder` before MozJPEG can be picked.
 */
let geotiffJpegDecoder!: Promise<DecoderClass>;

/**
 * TIFF JPEG tiles through MozJPEG (WASM) instead of geotiff's JS decoder.
 * Output matches geotiff: raw 8-bit samples, interleaved.
 */
class MozJpegDecoder extends BaseDecoder {
  fileDirectory: FileDirectory;
  /** `JPEGTables` without its EOI, or null when tiles are self-contained. */
  tablesPrefix: Uint8Array | null;
  samples: number;
  /**
   * geotiff hands back YCbCr and the loader converts it to RGB later. MozJPEG
   * has already converted, so YCbCr tiles go back to YCbCr.
   */
  ycbcr: boolean;

  constructor(fileDirectory: FileDirectory) {
    super();
    this.fileDirectory = fileDirectory;
    const tables = fileDirectory.JPEGTables;
    const n = tables?.length ?? 0;
    this.tablesPrefix =
      tables && n > 4 && tables[n - 2] === 0xff && tables[n - 1] === 0xd9
        ? Uint8Array.from(tables).subarray(0, n - 2)
        : null;
    // Decoded pixels are RGBA, so at most 4 samples come back.
    this.samples = Math.min(4, samplesPerTile(fileDirectory));
    this.ycbcr =
      fileDirectory.PhotometricInterpretation === 6 && this.samples === 3;
  }

  /** Abbreviated tile: tables (minus EOI) + tile (minus SOI) is one JPEG. */
  withTables(buffer: ArrayBuffer): ArrayBuffer {
    const tile = new Uint8Array(buffer);
    const prefix = this.tablesPrefix;
    if (!prefix || tile[0] !== 0xff || tile[1] !== 0xd8) return buffer;
    const out = new Uint8Array(prefix.length + tile.length - 2);
    out.set(prefix);
    out.set(tile.subarray(2), prefix.length);
    return out.buffer;
  }

  async decodeBlock(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    let decoded: ImageData;
    try {
      decoded = await decodeJpeg(this.withTables(buffer));
    } catch {
      // CMYK / YCCK, or anything else MozJPEG cannot hand back as RGBA.
      const Fallback = await geotiffJpegDecoder;
      return new Fallback(this.fileDirectory).decode(
        this.fileDirectory,
        buffer,
      );
    }
    const { data, width, height } = decoded;
    // Rows keep the tile stride; a short edge tile is zero-padded. Strips
    // have no tile size and keep the JPEG's own.
    const outW = this.fileDirectory.TileWidth ?? width;
    const outH = this.fileDirectory.TileLength ?? height;
    const rows = Math.min(height, outH);
    const cols = Math.min(width, outW);
    const { samples, ycbcr } = this;
    // Clamped array rounds and clamps the YCbCr math to 0–255.
    const out = new (ycbcr ? Uint8ClampedArray : Uint8Array)(
      outW * outH * samples,
    );
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const s = (y * width + x) * 4;
        const o = (y * outW + x) * samples;
        if (ycbcr) {
          // JFIF RGB → YCbCr.
          const r = data[s];
          const g = data[s + 1];
          const b = data[s + 2];
          out[o] = 0.299 * r + 0.587 * g + 0.114 * b;
          out[o + 1] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          out[o + 2] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        } else {
          for (let c = 0; c < samples; c++) out[o + c] = data[s + c];
        }
      }
    }
    return out.buffer;
  }
}

let pakoDeflateDecoder!: Promise<
  new (
    fileDirectory: FileDirectory,
  ) => { decodeBlock(buffer: ArrayBuffer): ArrayBuffer }
>;

class NativeDeflateDecoder extends BaseDecoder {
  fileDirectory: FileDirectory;

  constructor(fileDirectory: FileDirectory) {
    super();
    this.fileDirectory = fileDirectory;
  }

  async decodeBlock(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      const inflated = new Blob([buffer])
        .stream()
        .pipeThrough(new DecompressionStream("deflate"));
      return await new Response(inflated).arrayBuffer();
    } catch {
      const Fallback = await pakoDeflateDecoder;
      return new Fallback(this.fileDirectory).decodeBlock(buffer);
    }
  }
}

/** Viv's loader registers an LZW decoder that ignores SamplesPerPixel. Install ours after that import. */
function registerLzwDecoder(): void {
  addDecoder(5, () => Promise.resolve(LZWDecoder));
}

/** Replace geotiff's JPEG (compression 7) decoder with MozJPEG. */
function registerJpegDecoder(): void {
  // Read geotiff's registration (made on import) before replacing it.
  geotiffJpegDecoder = getDecoder({ Compression: 7 }).then(
    (decoder) => decoder.constructor as DecoderClass,
  );
  addDecoder(7, () => Promise.resolve(MozJpegDecoder));
}

/** Replace geotiff's deflate (compression 8 and 32946) decoder with the platform's. */
function registerDeflateDecoder(): void {
  if (typeof DecompressionStream === "undefined") return;
  // Read geotiff's registration (made on import) before replacing it.
  pakoDeflateDecoder = getDecoder({ Compression: 8 }).then(
    (decoder) => decoder.constructor,
  );
  addDecoder([8, 32946], () => Promise.resolve(NativeDeflateDecoder));
}

export { registerDeflateDecoder, registerJpegDecoder, registerLzwDecoder };
