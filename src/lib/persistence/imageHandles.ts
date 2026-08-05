import { deleteFileHandle, putFileHandle } from "@/lib/persistence/fileHandles";
import type { Image } from "@/lib/stores/documentSchema";
import { setImageSource } from "@/lib/stores/storeUtils";

/**
 * Keys for Dexie `handles` (same `minerva-stories` DB as stories). Document
 * `Image.source` stores `handleKey` only in JSON. Without an active story,
 * use a session-scoped key so local imports still carry source metadata.
 */
export function imageHandleStorageKey(
  storyId: string | null | undefined,
  imageId: string,
): string {
  return storyId ? `story:${storyId}:image:${imageId}` : `image:${imageId}`;
}

/**
 * Bind a local file handle to `imageId` (new key). Optionally delete the
 * previous handle key after a replace. Works with or without an active story.
 */
export async function persistLocalImageHandle(args: {
  storyId?: string | null;
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
