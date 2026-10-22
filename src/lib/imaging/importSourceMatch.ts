import { normalizeDicomWebSeriesUrl } from "@/lib/imaging/dicom.js";
import { getPersistedFileHandle } from "@/lib/persistence/fileHandles";
import type { Image } from "@/lib/stores/documentSchema";

/** Pending import identity — URL or local handle only (format-agnostic). */
export type PendingImportSource =
  | { kind: "local"; handle: Handle.File }
  | { kind: "url"; url: string; dicomWeb: boolean };

export function normalizeImportUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.href;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

type FileFingerprint = {
  name: string;
  size: number;
  lastModified: number;
};

function fileFingerprint(file: File): FileFingerprint {
  return { name: file.name, size: file.size, lastModified: file.lastModified };
}

function fingerprintsEqual(a: FileFingerprint, b: FileFingerprint): boolean {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  );
}

async function handlesSameEntry(
  a: Handle.File,
  b: Handle.File,
): Promise<boolean | null> {
  if (
    typeof a.isSameEntry !== "function" ||
    typeof b.isSameEntry !== "function"
  ) {
    return null;
  }
  try {
    return await a.isSameEntry(b);
  } catch {
    return null;
  }
}

function findUrlDuplicate(images: readonly Image[], url: string): Image | null {
  const key = normalizeImportUrl(url);
  return (
    images.find(
      (im) =>
        im.source?.kind === "url" && normalizeImportUrl(im.source.url) === key,
    ) ?? null
  );
}

function findDicomWebDuplicate(
  images: readonly Image[],
  url: string,
): Image | null {
  const series = normalizeDicomWebSeriesUrl(url);
  return (
    images.find(
      (im) =>
        im.source?.kind === "dicomWeb" &&
        normalizeDicomWebSeriesUrl(im.source.series) === series,
    ) ?? null
  );
}

async function findLocalDuplicate(
  images: readonly Image[],
  handle: Handle.File,
): Promise<Image | null> {
  const file = await handle.getFile();
  const fp = fileFingerprint(file);

  for (const im of images) {
    if (im.source?.kind !== "local") continue;
    let stored: Handle.File | undefined;
    try {
      stored = await getPersistedFileHandle(im.source.handleKey);
    } catch {
      // Skip inaccessible persistence and continue checking other candidates.
    }
    if (!stored) continue;
    const sameEntry = await handlesSameEntry(handle, stored);
    if (sameEntry === true) return im;
    if (sameEntry === false) continue;
    try {
      const storedFile = await stored.getFile();
      if (fingerprintsEqual(fp, fileFingerprint(storedFile))) return im;
    } catch {
      // Revoked/stale handles are not duplicate candidates without a fingerprint.
    }
  }
  return null;
}

export type FindDuplicateImportOptions = {
  /** Ignore this document image (e.g. the row being replaced). */
  excludeImageId?: string;
};

/** Return an existing document image that matches the pending import source. */
export async function findDuplicateImportTarget(
  images: readonly Image[],
  pending: PendingImportSource,
  options?: FindDuplicateImportOptions,
): Promise<Image | null> {
  const candidates =
    options?.excludeImageId != null
      ? images.filter((im) => im.id !== options.excludeImageId)
      : images;
  if (pending.kind === "url") {
    return pending.dicomWeb
      ? findDicomWebDuplicate(candidates, pending.url)
      : findUrlDuplicate(candidates, pending.url);
  }
  return findLocalDuplicate(candidates, pending.handle);
}

export function duplicateImportError(existing: Image): string {
  const label = existing.basename.trim() || "an existing image";
  return `This source is already imported as "${label}".`;
}
