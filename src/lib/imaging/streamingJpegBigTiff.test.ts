import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fromArrayBuffer } from "geotiff";
import { describe, expect, it } from "vitest";
import {
  align8,
  createMemorySink,
  padGrayscaleRgbaToTile,
  StreamingJpegBigTiffWriter,
  tileCountForSize,
} from "./streamingJpegBigTiff";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

function solidRgba(
  width: number,
  height: number,
  value: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    rgba[o] = value;
    rgba[o + 1] = value;
    rgba[o + 2] = value;
    rgba[o + 3] = 255;
  }
  return rgba;
}

/** SOF0/SOF1/SOF2 component count. */
function jpegSofComponentCount(buf: Uint8Array): number {
  for (let i = 0; i < buf.length - 9; i++) {
    if (
      buf[i] === 0xff &&
      (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc1 || buf[i + 1] === 0xc2)
    ) {
      return buf[i + 9];
    }
  }
  return -1;
}

describe("streamingJpegBigTiff", () => {
  it("align8 and tile counts", () => {
    expect(align8(0)).toBe(0);
    expect(align8(1)).toBe(8);
    expect(align8(8)).toBe(8);
    expect(tileCountForSize(100, 50, 64, 64)).toBe(2 * 1);
  });

  it("padGrayscaleRgbaToTile pads edge tiles", () => {
    const src = solidRgba(3, 2, 40);
    const padded = padGrayscaleRgbaToTile(src, 3, 2, 4, 4);
    expect(padded.length).toBe(4 * 4 * 4);
    expect(padded[0]).toBe(40);
    expect(padded[3 * 4]).toBe(0);
  });

  it("fixtures are one-component grayscale JPEG", () => {
    expect(jpegSofComponentCount(loadFixture("gray32.jpg"))).toBe(1);
    expect(jpegSofComponentCount(loadFixture("gray16.jpg"))).toBe(1);
  });

  it("writes a tiled JPEG BigTIFF that geotiff.js can open", async () => {
    const tile = 32;
    const width = 64;
    const height = 32;
    const jpegFull = loadFixture("gray32.jpg");

    const sink = createMemorySink();
    const writer = new StreamingJpegBigTiffWriter(sink, {
      channels: [
        {
          levels: [
            { width, height, tileWidth: tile, tileLength: tile },
            {
              width: width / 2,
              height: height / 2,
              tileWidth: tile,
              tileLength: tile,
            },
          ],
        },
      ],
      imageDescription: "minerva-test",
    });
    await writer.begin();

    await writer.writeTile(0, 0, 0, jpegFull);
    await writer.writeTile(0, 0, 1, jpegFull);
    await writer.writeTile(0, 1, 0, jpegFull);
    await writer.finish();

    const buffer = sink.toArrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(writer.tileDataStart);

    const tiff = await fromArrayBuffer(buffer);
    expect(await tiff.getImageCount()).toBeGreaterThanOrEqual(1);

    const image = await tiff.getImage(0);
    expect(image.getWidth()).toBe(width);
    expect(image.getHeight()).toBe(height);
    expect(image.getTileWidth()).toBe(tile);
    expect(image.getTileHeight()).toBe(tile);

    const fileDir = image.getFileDirectory() as {
      Compression?: number;
      SamplesPerPixel?: number;
      SubIFDs?: number[] | number;
    };
    expect(fileDir.Compression).toBe(7);
    expect(fileDir.SamplesPerPixel).toBe(1);

    const rasters = await image.readRasters({ interleave: true });
    expect((rasters as unknown as { length: number }).length).toBe(
      width * height,
    );

    if (fileDir.SubIFDs != null) {
      const sub = Array.isArray(fileDir.SubIFDs)
        ? fileDir.SubIFDs
        : [fileDir.SubIFDs];
      expect(sub.length).toBe(1);
    }
  });

  it("supports two main IFDs (two channels)", async () => {
    const tile = 16;
    const jpeg = loadFixture("gray16.jpg");
    const sink = createMemorySink();
    const writer = new StreamingJpegBigTiffWriter(sink, {
      channels: [
        {
          levels: [
            { width: tile, height: tile, tileWidth: tile, tileLength: tile },
          ],
        },
        {
          levels: [
            { width: tile, height: tile, tileWidth: tile, tileLength: tile },
          ],
        },
      ],
    });
    await writer.begin();
    await writer.writeTile(0, 0, 0, jpeg);
    await writer.writeTile(1, 0, 0, jpeg);
    await writer.finish();

    const buf = sink.toArrayBuffer();
    const head = new Uint8Array(buf, 0, 16);
    // II + BigTIFF magic 43
    expect([...head.slice(0, 4)]).toEqual([0x49, 0x49, 43, 0]);

    const tiff = await fromArrayBuffer(buf);
    expect(await tiff.getImageCount()).toBe(2);
  });

  it("allows out-of-order tile completion", async () => {
    const tile = 32;
    const jpeg = loadFixture("gray32.jpg");
    const sink = createMemorySink();
    const writer = new StreamingJpegBigTiffWriter(sink, {
      channels: [
        {
          levels: [
            { width: 64, height: 32, tileWidth: tile, tileLength: tile },
          ],
        },
      ],
    });
    await writer.begin();
    await writer.writeTile(0, 0, 1, jpeg);
    await writer.writeTile(0, 0, 0, jpeg);
    await writer.finish();

    const image = await (await fromArrayBuffer(sink.toArrayBuffer())).getImage(
      0,
    );
    const rasters = await image.readRasters({ interleave: true });
    expect((rasters as unknown as { length: number }).length).toBe(64 * 32);
  });
});
