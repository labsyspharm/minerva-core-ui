import type { DocumentData } from "./documentSchema";
import { validateDocumentData } from "./validateDocument";

/** Serializes document store data through the same pipeline as {@link validateDocumentData} (UUID normalization, etc.). */
export function downloadStoryJsonExport(
  data: DocumentData,
  filename = "document.json",
): void {
  const clone = JSON.parse(JSON.stringify(data)) as unknown;
  const doc = validateDocumentData(clone);
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
