import { describe, expect, it } from "vitest";
import { normalizeFeatureTableSource } from "@/lib/stores/wirePreprocess";
import { storedTableFormat } from "./persistFormat";

describe("storedTableFormat", () => {
  it("selects the Parquet loader for PAR1 bytes", () => {
    const bytes = new Uint8Array([0x50, 0x41, 0x52, 0x31, 0x15, 0x04]);
    expect(storedTableFormat(bytes)).toEqual({ kind: "parquet" });
  });

  it("selects header-true CSV with the persisted columns otherwise", () => {
    const bytes = new TextEncoder().encode("class_id,class_name\n1,Tumor\n");
    expect(storedTableFormat(bytes)).toEqual({
      kind: "csv",
      columns: { id: "class_id", name: "class_name" },
      header: true,
    });
  });
});

describe("normalizeFeatureTableSource", () => {
  it("maps a legacy handleKey source to a local source", () => {
    expect(normalizeFeatureTableSource({ handleKey: "abc" })).toEqual({
      kind: "local",
      handleKey: "abc",
    });
  });
});
