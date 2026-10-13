/**
 * `<tiff>.offsets.json`: a TIFF's top-level IFD offsets, in chain order. The
 * Viv fork fetches it beside a remote TIFF (`fetchOffsetsJson` in
 * @vivjs/loaders) and otherwise walks the IFD chain with range reads, one
 * round trip per channel before the first tile.
 */

import { fromBlob } from "geotiff";
import { writeDirectoryFile } from "@/lib/persistence/directoryFiles";

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

/**
 * Write `<fileName>.offsets.json` beside the finished TIFF `fileName`. The
 * sidecar only spares Viv the IFD walk, so a failure warns and the TIFF stands.
 */
export async function writeTiffOffsetsJson(
  directory: FileSystemDirectoryHandle,
  fileName: string,
): Promise<void> {
  try {
    const tiff = await (await directory.getFileHandle(fileName)).getFile();
    const offsets = await readTiffIfdOffsets(tiff);
    await writeDirectoryFile(
      directory,
      tiffOffsetsJsonName(fileName),
      JSON.stringify(offsets),
    );
  } catch (e) {
    console.warn(`[minerva] no offsets sidecar for ${fileName}`, e);
  }
}
