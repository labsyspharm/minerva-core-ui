import { describe, expect, it } from "vitest";
import type { Loader } from "@/lib/imaging/viv";
import {
  parsePhysicalScale,
  viewStateToPixels,
  viewStateToWorld,
  worldFrameFromLoader,
} from "@/lib/imaging/worldFrame";

function omeLoader(
  sizeX: number,
  sizeY: number,
  physical: {
    PhysicalSizeX?: number;
    PhysicalSizeY?: number;
    PhysicalSizeXUnit?: string;
    PhysicalSizeYUnit?: string;
  } = {},
): Loader {
  return {
    data: [
      {
        labels: ["y", "x"],
        shape: [sizeY, sizeX],
      },
    ],
    metadata: {
      ID: "Image:0",
      AquisitionDate: "",
      Description: "",
      Pixels: {
        Channels: [],
        ID: "Pixels:0",
        DimensionOrder: "XYCZT",
        Type: "Uint16",
        SizeT: 1,
        SizeC: 1,
        SizeZ: 1,
        SizeX: sizeX,
        SizeY: sizeY,
        PhysicalSizeX: physical.PhysicalSizeX as number,
        PhysicalSizeY: physical.PhysicalSizeY as number,
        PhysicalSizeXUnit: physical.PhysicalSizeXUnit as string,
        PhysicalSizeYUnit: physical.PhysicalSizeYUnit as string,
        PhysicalSizeZUnit: "µm",
        BigEndian: false,
        TiffData: [],
      },
    },
  } as unknown as Loader;
}

describe("parsePhysicalScale", () => {
  it("converts 1.3 µm to umPerPixelX 1.3", () => {
    expect(
      parsePhysicalScale({
        PhysicalSizeX: 1.3,
        PhysicalSizeXUnit: "µm",
      }).umPerPixelX,
    ).toBe(1.3);
  });

  it("uses 1 when PhysicalSize is missing", () => {
    expect(parsePhysicalScale({}).umPerPixelX).toBe(1);
    expect(parsePhysicalScale(null).umPerPixelX).toBe(1);
  });

  it("converts 1300 nm to 1.3 µm", () => {
    expect(
      parsePhysicalScale({
        PhysicalSizeX: 1300,
        PhysicalSizeXUnit: "nm",
      }).umPerPixelX,
    ).toBe(1.3);
  });
});

describe("worldFrameFromLoader", () => {
  it("gives the HE pair the same FOV in world space", () => {
    const hi = worldFrameFromLoader(
      omeLoader(7379, 10293, {
        PhysicalSizeX: 1.3,
        PhysicalSizeY: 1.3,
        PhysicalSizeXUnit: "µm",
        PhysicalSizeYUnit: "µm",
      }),
    );
    const lo = worldFrameFromLoader(
      omeLoader(3690, 5147, {
        PhysicalSizeX: 2.6,
        PhysicalSizeY: 2.6,
        PhysicalSizeXUnit: "µm",
        PhysicalSizeYUnit: "µm",
      }),
    );
    expect(hi.worldWidth).toBeCloseTo(9592.7, 5);
    expect(hi.worldHeight).toBeCloseTo(13380.9, 5);
    expect(lo.worldWidth).toBeCloseTo(9594, 5);
    expect(lo.worldHeight).toBeCloseTo(13382.2, 5);
  });
});

describe("viewState codec", () => {
  const scale = { umPerPixelX: 2, umPerPixelY: 2 };
  const pixels = { zoom: 0, target: [100, 200, 0] as [number, number, number] };

  it("maps pixel viewState to world by scale and log2 zoom", () => {
    expect(viewStateToWorld(pixels, scale)).toEqual({
      zoom: -1,
      target: [200, 400, 0],
    });
  });

  it("round-trips pixel viewState through world", () => {
    expect(viewStateToPixels(viewStateToWorld(pixels, scale), scale)).toEqual(
      pixels,
    );
  });
});
