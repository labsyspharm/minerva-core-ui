import type { DocumentData } from "@/lib/stores/documentSchema";

/**
 * Point every relative pixel and feature-table path at the published copy
 * beside `documentUrl`, so the story keeps reading the hosted files.
 * Absolute URLs stay; `//host` takes the document's scheme.
 */
export function withHostedSources(
  data: DocumentData,
  documentUrl: string,
): DocumentData {
  const hosted = (url: string) => new URL(url.trim() || ".", documentUrl).href;
  return {
    ...data,
    images: data.images.map((im) => {
      const source = im.source;
      if (source?.kind === "jpeg") {
        // The pyramid root is a folder; loaders join tile paths onto it.
        const url = hosted(source.url).replace(/\/$/, "");
        return { ...im, source: { kind: "jpeg" as const, url } };
      }
      if (source?.kind === "url") {
        const url = hosted(source.url);
        return { ...im, source: { kind: "url" as const, url } };
      }
      return im;
    }),
    featureTables: data.featureTables.map((table) =>
      table.source.kind === "url"
        ? {
            ...table,
            source: { kind: "url" as const, url: hosted(table.source.url) },
          }
        : table,
    ),
  };
}
