/**
 * `<tiff>.offsets.json`: a TIFF's top-level IFD offsets, in chain order. The
 * Viv fork fetches it beside a remote TIFF (`fetchOffsetsJson` in
 * @vivjs/loaders) and otherwise walks the IFD chain with range reads, one
 * round trip per channel before the first tile.
 */

import { fromBlob } from "geotiff";

/** Sidecar name Viv requests for `tiffFileName`. */
export function tiffOffsetsJsonName(tiffFileName: string): string {
  return `${tiffFileName}.offsets.json`;
}

/** Top-level IFD offsets of `file`, following each IFD's next pointer. */
export async function readTiffIfdOffsets(file: Blob): Promise<number[]> {
  const tiff = await fromBlob(file);
  const offsets: number[] = [];
  for (let offset = tiff.firstIFDOffset; offset !== 0; ) {
    offsets.push(offset);
    offset = (await tiff.parseFileDirectoryAt(offset)).nextIFDByteOffset;
  }
  return offsets;
}

/** Write `<fileName>.offsets.json` beside the finished TIFF `fileName`. */
export async function writeTiffOffsetsJson(
  directory: FileSystemDirectoryHandle,
  fileName: string,
): Promise<void> {
  const tiff = await (await directory.getFileHandle(fileName)).getFile();
  const offsets = await readTiffIfdOffsets(tiff);
  const fh = await directory.getFileHandle(tiffOffsetsJsonName(fileName), {
    create: true,
  });
  const write = await fh.createWritable();
  await write.write(JSON.stringify(offsets));
  await write.close();
}
