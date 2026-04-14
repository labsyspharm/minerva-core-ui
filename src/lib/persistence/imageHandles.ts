/**
 * IndexedDB keys for {@link FileSystemFileHandle}s (structured clone).
 * Document `Image.source` stores `handleKey` only, not the handle object.
 */
export function imageHandleStorageKey(
  storyId: string,
  imageId: string,
): string {
  return `story:${storyId}:image:${imageId}`;
}
