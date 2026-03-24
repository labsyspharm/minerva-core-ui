import type { Annotation } from "@/lib/stores";

export const CLIPBOARD_KIND = "minerva-annotations" as const;
export const CLIPBOARD_VERSION = 1 as const;

export type AnnotationClipboardEnvelope = {
  v: number;
  kind: typeof CLIPBOARD_KIND;
  annotations: Annotation[];
};

function newPasteId(type: string, index: number): string {
  return `${type}-paste-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Deep-clone annotations and assign new ids + isImported for waypoint persist path. */
export function cloneAnnotationsForPaste(
  annotations: Annotation[],
): Annotation[] {
  const t = Date.now();
  return annotations.map((ann, index) => {
    const copy = JSON.parse(JSON.stringify(ann)) as Annotation;
    copy.id = newPasteId(copy.type, index + t);
    const meta =
      copy.metadata && typeof copy.metadata === "object"
        ? { ...copy.metadata }
        : {};
    delete (meta as { createdAt?: unknown }).createdAt;
    (meta as { isImported?: boolean }).isImported = true;
    copy.metadata = meta;
    return copy;
  });
}

export function annotationsToClipboardPayload(
  annotations: Annotation[],
): string {
  const envelope: AnnotationClipboardEnvelope = {
    v: CLIPBOARD_VERSION,
    kind: CLIPBOARD_KIND,
    annotations,
  };
  return JSON.stringify(envelope);
}

export function parseClipboardPayload(text: string): Annotation[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<AnnotationClipboardEnvelope>;
    if (
      parsed?.kind !== CLIPBOARD_KIND ||
      typeof parsed.v !== "number" ||
      !Array.isArray(parsed.annotations)
    ) {
      return null;
    }
    return parsed.annotations as Annotation[];
  } catch {
    return null;
  }
}

export async function writeAnnotationsToSystemClipboard(
  annotations: Annotation[],
): Promise<void> {
  const payload = annotationsToClipboardPayload(annotations);
  await navigator.clipboard.writeText(payload);
}

export async function readAnnotationsFromSystemClipboard(): Promise<
  Annotation[] | null
> {
  const text = await navigator.clipboard.readText();
  return parseClipboardPayload(text);
}
