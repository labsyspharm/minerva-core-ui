import { describe, expect, it } from "vitest";
import type { DocumentData } from "@/lib/stores/documentSchema";
import { withHostedSources } from "./hostedStory";

const DOC = "https://lab.example.org/stories/crc/document.json";

describe("withHostedSources", () => {
  const image = (source: DocumentData["images"][number]["source"]) =>
    ({ id: "im", source }) as DocumentData["images"][number];
  const table = (url: string) =>
    ({
      id: "t",
      source: { kind: "url", url },
    }) as DocumentData["featureTables"][number];

  it("points relative pixels and tables at the hosted copies", () => {
    const data = {
      images: [
        image({ kind: "jpeg", url: "." }),
        image({ kind: "url", url: "crc.ome.tif" }),
        image({ kind: "url", url: "https://cdn.example.org/raw.ome.tif" }),
        image({ kind: "jpeg", url: "//cdn.example.org/pyramid/" }),
        image({ kind: "dicomWeb", series: "https://dicom/s", modality: "SM" }),
      ],
      featureTables: [
        table("feature-tables/t.parquet"),
        table("https://cdn.example.org/t.parquet"),
      ],
    } as DocumentData;

    const hosted = withHostedSources(data, DOC);

    expect(hosted.images.map((im) => im.source)).toEqual([
      { kind: "jpeg", url: "https://lab.example.org/stories/crc" },
      {
        kind: "url",
        url: "https://lab.example.org/stories/crc/crc.ome.tif",
      },
      { kind: "url", url: "https://cdn.example.org/raw.ome.tif" },
      { kind: "jpeg", url: "https://cdn.example.org/pyramid" },
      { kind: "dicomWeb", series: "https://dicom/s", modality: "SM" },
    ]);
    expect(hosted.featureTables.map((t) => t.source)).toEqual([
      {
        kind: "url",
        url: "https://lab.example.org/stories/crc/feature-tables/t.parquet",
      },
      { kind: "url", url: "https://cdn.example.org/t.parquet" },
    ]);
  });
});
