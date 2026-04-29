/**
 * Keys for Dexie `handles` (same `minerva-stories` DB as stories). Document `Image.source` stores `handleKey` only in JSON.
 */
export function imageHandleStorageKey(
  storyId: string,
  imageId: string,
): string {
  return `story:${storyId}:image:${imageId}`;
}
