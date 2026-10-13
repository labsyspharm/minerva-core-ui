/** Write `data` to `relativePath` under `directory`, creating folders on the way. */
export async function writeDirectoryFile(
  directory: FileSystemDirectoryHandle,
  relativePath: string,
  data: FileSystemWriteChunkType,
): Promise<void> {
  const parts = relativePath.split("/");
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Invalid file path: ${relativePath}`);
  let dir = directory;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const fh = await dir.getFileHandle(fileName, { create: true });
  const write = await fh.createWritable();
  await write.write(data);
  await write.close();
}
