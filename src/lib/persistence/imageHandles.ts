import { deleteFileHandle, putFileHandle } from "@/lib/persistence/fileHandles";
import type { Image } from "@/lib/stores/documentSchema";
import { setImageSource } from "@/lib/stores/storeUtils";

/**
 * Keys for Dexie `handles` (same `minerva-stories` DB as stories). Document `Image.source` stores `handleKey` only in JSON.
 */
export function imageHandleStorageKey(
  storyId: string,
  imageId: string,
): string {
  return `story:${storyId}:image:${imageId}`;
}

/**
 * Bind a local file handle to `imageId` (new key). Optionally delete the
 * previous handle key after a replace.
 */
export async function persistLocalImageHandle(args: {
  storyId: string;
  imageId: string;
  handle: Handle.File;
  images: Image[];
  previousHandleKey?: string;
}): Promise<Image[]> {
  const { storyId, imageId, handle, images, previousHandleKey } = args;
  const key = imageHandleStorageKey(storyId, imageId);
  await putFileHandle(key, handle);
  const next = setImageSource(images, imageId, {
    kind: "local",
    handleKey: key,
  });
  if (previousHandleKey && previousHandleKey !== key) {
    await deleteFileHandle(previousHandleKey);
  }
  return next;
}
