import { describe, expect, it } from "vitest";
import { shouldFetchClassIndex } from "./lutLayout";

describe("shouldFetchClassIndex", () => {
  it("is false when the table is not ingested", () => {
    expect(shouldFetchClassIndex(false, 10)).toBe(false);
  });

  it("is false when the index exceeds the texture size", () => {
    expect(shouldFetchClassIndex(true, 2048 * 2048 + 1)).toBe(false);
  });

  it("is true for an ingested table that fits", () => {
    expect(shouldFetchClassIndex(true, 10)).toBe(true);
  });
});
