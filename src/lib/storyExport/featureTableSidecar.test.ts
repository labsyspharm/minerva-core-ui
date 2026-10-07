import { describe, expect, it } from "vitest";
import type { FeatureTable, Image } from "@/lib/stores/documentSchema";
import { planFeatureTableSidecars } from "./storyBundle";

const LOADED_ID = "0b6f8c1e-3a4d-4f2b-9c7e-1d2e3f4a5b6c";
const SKIPPED_ID = "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const LOADED_MASK = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const SKIPPED_MASK = "b2c3d4e5-f6a7-4890-b123-456789abcdef";

function table(id: string, sourceChannelId: string): FeatureTable {
  return {
    id,
    sourceChannelId,
    source: { kind: "local", handleKey: `featureTable:${id}` },
    maxClassId: 10,
    nameColors: [],
    digest: "abc",
  };
}

const images = [
  {
    channels: [
      { id: LOADED_MASK, name: "Cells" },
      { id: SKIPPED_MASK, name: "Nuclei" },
    ],
  },
] as unknown as Image[];

describe("planFeatureTableSidecars", () => {
  const plan = planFeatureTableSidecars(
    {
      images,
      featureTables: [
        table(LOADED_ID, LOADED_MASK),
        table(SKIPPED_ID, SKIPPED_MASK),
      ],
    },
    (id) => id === LOADED_ID,
  );

  it("points a loaded table at its Parquet sidecar", () => {
    expect(plan.featureTables).toHaveLength(1);
    expect(plan.featureTables[0].source).toEqual({
      kind: "url",
      url: `feature-tables/${LOADED_ID}.parquet`,
    });
  });

  it("omits a table that is not loaded and names its mask", () => {
    expect(plan.featureTables.some((t) => t.id === SKIPPED_ID)).toBe(false);
    expect(plan.skipped).toEqual(["Nuclei"]);
  });
});
