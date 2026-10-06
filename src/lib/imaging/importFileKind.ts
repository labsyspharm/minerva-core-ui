/** What a dropped or browsed file is, judged by its extension. */
export type ImportFileKind = "image" | "annotations" | "featureTable" | "story";

const KINDS: Record<ImportFileKind, { label: string; extensions: string[] }> = {
  image: { label: "OME-TIFF images", extensions: [".tif", ".tiff"] },
  annotations: { label: "OME-XML annotations", extensions: [".xml"] },
  featureTable: { label: "CSV feature tables", extensions: [".csv"] },
  story: { label: "Minerva story JSON", extensions: [".json"] },
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

/** One picker filter for all `kinds`, so every accepted file shows at once. */
export function importFilePickerOptions(kinds: readonly ImportFileKind[]): {
  description: string;
  extensions: string[];
} {
  return {
    description: kinds.map((k) => KINDS[k].label).join(", "),
    extensions: kinds.flatMap((k) => KINDS[k].extensions),
  };
}
