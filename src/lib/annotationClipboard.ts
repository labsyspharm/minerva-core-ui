import type { Annotation } from "@/lib/stores";

export const CLIPBOARD_KIND = "minerva-annotations" as const;
export const CLIPBOARD_VERSION = 1 as const;

export type AnnotationClipboardEnvelope = {
  v: number;
  kind: typeof CLIPBOARD_KIND;
  annotations: Annotation[];
};

function newPasteId(): string {
  return crypto.randomUUID();
}

/** Deep-clone annotations and assign new ids + isImported for waypoint persist path. */
export function cloneAnnotationsForPaste(
  annotations: Annotation[],
): Annotation[] {
  return annotations.map((ann) => {
    const copy = JSON.parse(JSON.stringify(ann)) as Annotation;
    copy.id = newPasteId();
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

/** Older clipboards used `rectangle` / `ellipse` types; normalize to `polygon`. */
function normalizePastedAnnotations(raw: Annotation[]): Annotation[] {
  return raw.map((ann) => {
    const t = (ann as { type?: string }).type;
    if (t === "rectangle" || t === "ellipse") {
      const a = ann as unknown as {
        type: string;
        polygon: [number, number][];
        metadata?: Record<string, unknown>;
        [key: string]: unknown;
      };
      return {
        ...a,
        type: "polygon",
      } as Annotation;
    }
    return ann;
  });
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
    return normalizePastedAnnotations(parsed.annotations as Annotation[]);
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
