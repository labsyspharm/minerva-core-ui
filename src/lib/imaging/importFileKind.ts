/** What a dropped or browsed file is, judged by its extension. */
export type ImportFileKind = "image" | "annotations" | "featureTable" | "story";

const KINDS: Record<
  ImportFileKind,
  { label: string; extensions: string[]; mimeTypes: string[] }
> = {
  image: {
    label: "OME-TIFF images",
    extensions: [".tif", ".tiff"],
    mimeTypes: ["image/tiff"],
  },
  annotations: {
    label: "OME-XML annotations",
    extensions: [".xml"],
    mimeTypes: ["text/xml", "application/xml"],
  },
  featureTable: {
    label: "CSV feature tables",
    extensions: [".csv"],
    mimeTypes: ["text/csv"],
  },
  story: {
    label: "Minerva story JSON",
    extensions: [".json"],
    mimeTypes: ["application/json"],
  },
};

/** Unknown extensions count as images so OME-TIFF detection decides. */
export function importFileKind(name: string): ImportFileKind {
  const lower = name.toLowerCase();
  const kinds = Object.keys(KINDS) as ImportFileKind[];
  return (
    kinds.find((k) => KINDS[k].extensions.some((e) => lower.endsWith(e))) ??
    "image"
  );
}

/** True while the drag carries files from outside the page. */
export function dragHasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  return types != null && Array.from(types).includes("Files");
}

/** One picker filter for all `kinds`, so every accepted file shows at once. */
export function importFilePickerOptions(kinds: readonly ImportFileKind[]): {
  description: string;
  extensions: string[];
  mimeTypes: string[];
} {
  return {
    description: kinds.map((k) => KINDS[k].label).join(", "),
    extensions: kinds.flatMap((k) => KINDS[k].extensions),
    mimeTypes: kinds.flatMap((k) => KINDS[k].mimeTypes),
  };
}
