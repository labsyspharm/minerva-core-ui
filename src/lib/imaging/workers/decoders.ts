import { addDecoder, BaseDecoder } from "geotiff";
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
    const samples =
      fileDirectory.PlanarConfiguration === 2
        ? 1
        : (fileDirectory.SamplesPerPixel ??
          (typeof bits === "number" ? 1 : (bits?.length ?? 1)));
    this.maxUncompressedSize = Math.ceil(
      width * height * (bits0 / 8) * Math.max(1, samples),
    );
  }

  async decodeBlock(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    const decoded = await decompress(bytes, this.maxUncompressedSize);
    return decoded.buffer;
  }
}

/** Viv's loader registers an LZW decoder that ignores SamplesPerPixel. Install ours after that import. */
function registerLzwDecoder(): void {
  addDecoder(5, () => Promise.resolve(LZWDecoder));
}

export { registerLzwDecoder };
