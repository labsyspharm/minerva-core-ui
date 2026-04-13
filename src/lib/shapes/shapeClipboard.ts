import type { Shape } from "./shapeModel";

/** Current clipboard wire format. */
export const CLIPBOARD_KIND = "minerva-shapes" as const;
export const CLIPBOARD_VERSION = 2 as const;

/** Legacy v1 kind (still parsed for paste). */
const LEGACY_CLIPBOARD_KIND = "minerva-annotations" as const;

export type ShapeClipboardEnvelope = {
  v: number;
  kind: typeof CLIPBOARD_KIND | typeof LEGACY_CLIPBOARD_KIND;
  shapes?: Shape[];
  /** @deprecated v1 only; same items as `shapes` */
  annotations?: Shape[];
};

function newPasteId(): string {
  return crypto.randomUUID();
}

/** Deep-clone shapes and assign new ids + isImported for waypoint persist path. */
export function cloneShapesForPaste(shapes: Shape[]): Shape[] {
  return shapes.map((sh) => {
    const copy = JSON.parse(JSON.stringify(sh)) as Shape;
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

export function shapesToClipboardPayload(shapes: Shape[]): string {
  const envelope: ShapeClipboardEnvelope = {
    v: CLIPBOARD_VERSION,
    kind: CLIPBOARD_KIND,
    shapes,
  };
  return JSON.stringify(envelope);
}

/** Older clipboards used `rectangle` / `ellipse` types; normalize to `polygon`. */
function normalizePastedShapes(raw: Shape[]): Shape[] {
  return raw.map((sh) => {
    const t = (sh as { type?: string }).type;
    if (t === "rectangle" || t === "ellipse") {
      const s = sh as unknown as {
        type: string;
        polygon: [number, number][];
        metadata?: Record<string, unknown>;
        [key: string]: unknown;
      };
      return {
        ...s,
        type: "polygon",
      } as Shape;
    }
    return sh;
  });
}

export function parseClipboardPayload(text: string): Shape[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<ShapeClipboardEnvelope>;
    if (
      typeof parsed.v !== "number" ||
      (parsed.kind !== CLIPBOARD_KIND && parsed.kind !== LEGACY_CLIPBOARD_KIND)
    ) {
      return null;
    }
    const list = Array.isArray(parsed.shapes)
      ? parsed.shapes
      : Array.isArray(parsed.shapes)
        ? parsed.shapes
        : null;
    if (!list) return null;
    return normalizePastedShapes(list as Shape[]);
  } catch {
    return null;
  }
}

export async function writeShapesToSystemClipboard(
  shapes: Shape[],
): Promise<void> {
  const payload = shapesToClipboardPayload(shapes);
  await navigator.clipboard.writeText(payload);
}

export async function readShapesFromSystemClipboard(): Promise<Shape[] | null> {
  const text = await navigator.clipboard.readText();
  return parseClipboardPayload(text);
}
