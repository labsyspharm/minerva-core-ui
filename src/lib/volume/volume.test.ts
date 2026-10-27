import { describe, expect, it } from "vitest";
import { visibilitiesShowingOnlyGroup } from "@/lib/imaging/channelCompositor";
import type { View3d } from "@/lib/stores/documentSchema";
import { ImageSchema, View3dSchema } from "@/lib/stores/documentSchema";
import { flattenImageChannelsInDocumentOrder } from "@/lib/stores/documentStore";
import { waypointToConfigWaypoint } from "@/lib/stores/storeUtils";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import {
  buildVolumeImport,
  looksLikeImsUrl,
  type VolumeProbe,
} from "./imsVolume";
import {
  documentSplatsFor,
  looksToTrain,
  splatFileName,
  storyCameras,
} from "./splatCache";
import {
  DEFAULT_DENSITY,
  easeInOutCubic,
  interpolateView3d,
  isClipped,
} from "./view3d";
import {
  channelsToLoad,
  limitsToWindow,
  MAX_VOLUME_CHANNELS,
  volumeChannelLayers,
} from "./volumeChannels";

const URL_IMS =
  "https://lsp-public-data.s3.amazonaws.com/yapp-2023-3d-melanoma/LSP22408.ims";

const probe = (channels: number): VolumeProbe => ({
  name: "LSP22408",
  dimensions: [1024, 1024, 100],
  dtype: "float32",
  channels: Array.from({ length: channels }, (_, i) => ({
    index: i,
    name: `Marker ${i}`,
    color: [1, i % 2, 0] as [number, number, number],
    range: [0, 1000] as [number, number],
    displayRange: [100, 600] as [number, number],
  })),
});

const view = (patch: Partial<View3d> = {}): View3d => ({
  camera: [0.3, 0, 2, 0, 0, 0],
  clipMin: [0, 0, 0],
  clipMax: [1, 1, 1],
  renderMode: "dvr",
  density: 1,
  depthCue: 0,
  ...patch,
});

const fail = (): never => {
  throw new Error("missing fixture");
};

/** True when two views would render the same (within float noise). */
function view3dNearlyEqual(a: View3d, b: View3d, eps = 1e-6): boolean {
  const close = (x: readonly number[], y: readonly number[]) =>
    x.every((v, i) => Math.abs(v - (y[i] ?? Number.NaN)) <= eps);
  return (
    a.renderMode === b.renderMode &&
    Math.abs(a.density - b.density) <= eps &&
    Math.abs(a.depthCue - b.depthCue) <= eps &&
    close(a.camera, b.camera) &&
    close(a.clipMin, b.clipMin) &&
    close(a.clipMax, b.clipMax)
  );
}

describe("view3d", () => {
  it("interpolates endpoints exactly", () => {
    const a = view();
    const b = view({
      camera: [1, 2, 0.5, 0.1, -0.2, 0.3],
      clipMax: [0.5, 1, 1],
      renderMode: "mip",
      density: 4,
      depthCue: 0.8,
    });
    expect(view3dNearlyEqual(interpolateView3d(a, b, 0), a)).toBe(true);
    expect(view3dNearlyEqual(interpolateView3d(a, b, 1), b)).toBe(true);
    expect(interpolateView3d(a, b, 0.5).depthCue).toBeCloseTo(0.4);
  });

  it("turns the short way and zooms geometrically", () => {
    const a = view({ camera: [0, 0.1, 1, 0, 0, 0] });
    const b = view({ camera: [0, 2 * Math.PI - 0.1, 4, 0, 0, 0] });
    const mid = interpolateView3d(a, b, 0.5);
    expect(mid.camera[1]).toBeCloseTo(0, 6);
    expect(mid.camera[2]).toBeCloseTo(2, 6);
    expect(mid.renderMode).toBe("dvr");
  });

  it("eases from 0 to 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
});

describe("volume channels", () => {
  it("maps raw limits into the normalisation range", () => {
    expect(limitsToWindow([100, 600], [0, 1000])).toEqual({
      center: 0.35,
      width: 0.5,
    });
    expect(limitsToWindow([1, 2], [5, 5])).toEqual({ center: 0.5, width: 1 });
  });

  it("keeps the streamed set when it covers the wanted channels", () => {
    expect(channelsToLoad([2, 0], [0, 1, 2])).toEqual([0, 1, 2]);
    expect(channelsToLoad([7, 8], [0, 1, 2])).toEqual([7, 8]);
    expect(channelsToLoad([], null)).toEqual([0]);
  });

  it("shows the active group's channels with its colors and limits", () => {
    const { image, channelGroups } = buildVolumeImport(URL_IMS, probe(8));
    const group = channelGroups[1];
    if (!group) throw new Error("expected a second group");
    const sourceChannels = flattenImageChannelsInDocumentOrder([image]);
    // What `showOnlyChannelGroup` stores when a waypoint selects the group.
    const vis = visibilitiesShowingOnlyGroup({
      group,
      channelGroups,
      sourceChannels,
      stackVisibilities: {},
    });
    const layers = volumeChannelLayers({
      imageId: image.id,
      sourceChannels,
      channelGroups,
      activeChannelGroupId: group.id,
      channelVisibilities: vis.channelVisibilities,
      channelGroupRowVisibilities: vis.channelGroupRowVisibilities,
    });
    expect(layers.map((l) => l.sourceIndex)).toEqual([6, 7]);
    expect(layers[0]?.limits).toEqual([100, 600]);
    expect(layers[0]?.color).toEqual([255, 0, 0]);
  });
});

describe("volume import", () => {
  it("recognises .ims URLs", () => {
    expect(looksLikeImsUrl(URL_IMS)).toBe(true);
    expect(looksLikeImsUrl(`${URL_IMS}?x=1`)).toBe(true);
    expect(looksLikeImsUrl("https://x/y.ome.tif")).toBe(false);
  });

  it("builds a valid image and groups of at most six channels", () => {
    const { image, channelGroups } = buildVolumeImport(URL_IMS, probe(18));
    expect(() => ImageSchema.parse(image)).not.toThrow();
    expect(image.basename).toBe("LSP22408.ims");
    expect(channelGroups).toHaveLength(3);
    expect(
      channelGroups.every((g) => g.channels.length <= MAX_VOLUME_CHANNELS),
    ).toBe(true);
    expect(image.channels[3]?.floatRange).toEqual({ min: 0, max: 1000 });
  });

  it("keeps the volume source and waypoint view3d through validation", () => {
    const { image, channelGroups } = buildVolumeImport(URL_IMS, probe(2));
    const v = view({ camera: [0.4, 1.2, 1.5, 0.1, 0, -0.1], density: 2 });
    const doc = validateDocumentData({
      metadata: {},
      shapes: [],
      images: [image],
      channelGroups,
      waypoints: [
        {
          id: crypto.randomUUID(),
          title: "Inside the tumour",
          content: "",
          thumbnail: "",
          viewport: { upperLeft: { x: 0, y: 0 }, lowerRight: { x: 1, y: 1 } },
          shapeIds: [],
          view3d: v,
        },
      ],
    });
    expect(doc.images[0]?.source).toEqual({
      kind: "volume",
      url: URL_IMS,
      format: "ims",
    });
    expect(doc.waypoints[0]?.view3d).toEqual(v);
    const [wp] = doc.waypoints;
    if (!wp) throw new Error("expected a waypoint");
    expect(waypointToConfigWaypoint(wp).View3d).toEqual(v);
  });
});

describe("view3d records", () => {
  it("fills render settings missing from camera-only records", () => {
    const camera = [0.4, 1.2, 1.5, 0, 0, 0];
    expect(View3dSchema.parse({ camera })).toEqual({
      camera,
      clipMin: [0, 0, 0],
      clipMax: [1, 1, 1],
      renderMode: "dvr",
      density: DEFAULT_DENSITY,
      depthCue: 0,
    });
  });
});

describe("splat export", () => {
  it("trains each group × render mode the waypoints use, in story order", () => {
    const { channelGroups: g } = buildVolumeImport(URL_IMS, probe(18));
    const [a, b, c] = g;
    if (!a || !b || !c) throw new Error("expected three groups");
    const v = (renderMode: View3d["renderMode"], density = 0.1) =>
      view({ renderMode, density });
    const looks = looksToTrain(
      g,
      [
        { groupId: c.id, view3d: v("dvr") },
        { groupId: c.id, view3d: v("mip", 3) },
        { groupId: c.id, view3d: v("mip", 0.5) }, // MIP ignores density
        { view3d: v("dvr", 0.4) }, // no group → active group
        { groupId: a.id }, // no 3D view → volume at the default density
        { groupId: c.id, view3d: v("dvr", 0.1000001) },
        // Clipped: shows the live volume, so no splats for this look
        {
          groupId: c.id,
          view3d: view({ renderMode: "iso", clipMin: [0.3, 0, 0] }),
        },
      ],
      b.id,
    );
    expect(
      looks.map(({ group, look }) => [group.id, look.renderMode, look.density]),
    ).toEqual([
      [c.id, "dvr", 0.1],
      [c.id, "mip", 3],
      [b.id, "dvr", 0.4],
      [a.id, "dvr", DEFAULT_DENSITY],
    ]);
    expect(looksToTrain(g, [], null).map((l) => l.group)).toEqual([a]);
    expect(looksToTrain([], [], null)).toEqual([]);
    expect(splatFileName(looks[0]?.look ?? fail())).toBe(
      `${c.id}-dvr-d0_1.ply`,
    );
    expect(splatFileName(looks[1]?.look ?? fail())).toBe(`${c.id}-mip.ply`);
  });

  it("trains on the story's own cameras, waypoints first", () => {
    const { channelGroups: g } = buildVolumeImport(URL_IMS, probe(2));
    const [group] = g;
    if (!group) throw new Error("fixture");
    const at = (ry: number, patch: Partial<View3d> = {}) => ({
      groupId: group.id,
      view3d: view({ camera: [0.2, ry, 2, 0, 0, 0], ...patch }),
    });
    const waypoints = [
      at(0),
      at(1),
      at(2, { renderMode: "mip" }), // another look
      at(3, { clipMax: [0.5, 1, 1] }), // clipped: live volume
    ];
    const look = { groupId: group.id, renderMode: "dvr" as const, density: 1 };
    const all = storyCameras(look, g, waypoints, null, 100);
    // Its two waypoints, then the midpoints of the flights touching them
    // (0→1 and 1→2; 2→3 ends clipped), then nudges and quarter points.
    expect(all.train.slice(0, 2).map((c) => c[1])).toEqual([0, 1]);
    expect(all.train[2]?.[1]).toBeCloseTo(0.5);
    expect(all.train[3]?.[1]).toBeCloseTo(1.5);
    expect(all.train).toHaveLength(2 + 2 + 2 * 6 + 2 * 2);
    expect(all.train.some((c) => c[1] === 3)).toBe(false);
    expect(all.evaluate).toHaveLength(2);
    for (const e of all.evaluate)
      expect(all.train.some((c) => c.every((x, i) => x === e[i]))).toBe(false);
    expect(storyCameras(look, g, waypoints, null, 3).train).toHaveLength(3);
    const mip = { ...look, renderMode: "mip" as const };
    expect(storyCameras(mip, g, waypoints, null, 100).train[0]?.[1]).toBe(2);
  });

  it("tells clipped views apart", () => {
    expect(isClipped(view())).toBe(false);
    expect(isClipped(view({ clipMin: [0, 0.2, 0] }))).toBe(true);
    expect(isClipped(view({ clipMax: [1, 1, 0.99] }))).toBe(true);
  });

  it("finds the document's splats for a look", () => {
    const { image, channelGroups } = buildVolumeImport(URL_IMS, probe(2));
    const group = channelGroups[0];
    if (!group || image.source?.kind !== "volume") throw new Error("fixture");
    const withSplats = {
      ...image,
      source: {
        ...image.source,
        splats: [
          {
            groupId: group.id,
            renderMode: "dvr" as const,
            density: 0.1,
            url: "a.ply",
            count: 1,
          },
          {
            groupId: group.id,
            renderMode: "mip" as const,
            url: "b.ply",
            count: 1,
          },
        ],
      },
    };
    const look = (renderMode: View3d["renderMode"], density: number) => ({
      groupId: group.id,
      renderMode,
      density,
    });
    const urls = (l: ReturnType<typeof look>) =>
      documentSplatsFor(withSplats, l).map((s) => s.url);
    expect(urls(look("dvr", 0.1))).toEqual(["a.ply"]);
    expect(urls(look("dvr", 0.5))).toEqual([]);
    expect(urls(look("mip", 7))).toEqual(["b.ply"]);
    expect(urls(look("iso", 0.1))).toEqual([]);
  });

  it("finds a look's per-channel splat files", () => {
    const { image, channelGroups } = buildVolumeImport(URL_IMS, probe(2));
    const group = channelGroups[0];
    if (!group || image.source?.kind !== "volume") throw new Error("fixture");
    const [c0, c1] = image.channels;
    if (!c0 || !c1) throw new Error("fixture");
    const entry = (channelId: string, url: string) => ({
      groupId: group.id,
      channelId,
      renderMode: "mip" as const,
      url,
      count: 1,
    });
    const withSplats = {
      ...image,
      source: {
        ...image.source,
        splats: [entry(c0.id, "c0.ply"), entry(c1.id, "c1.ply")],
      },
    };
    const look = { groupId: group.id, renderMode: "mip" as const, density: 1 };
    expect(documentSplatsFor(withSplats, look).map((s) => s.url)).toEqual([
      "c0.ply",
      "c1.ply",
    ]);
    expect(splatFileName(look, 3)).toBe(`${group.id}-mip-c3.ply`);
  });

  it("keeps splat files on the volume source through validation", () => {
    const { image, channelGroups } = buildVolumeImport(URL_IMS, probe(2));
    const group = channelGroups[0];
    if (!group || image.source?.kind !== "volume") throw new Error("fixture");
    const splats = [
      {
        groupId: group.id,
        renderMode: "mip" as const,
        url: `splats/${group.id}-mip.ply`,
        count: 512,
        psnr: 33.4,
      },
    ];
    const doc = validateDocumentData({
      metadata: {},
      shapes: [],
      waypoints: [],
      channelGroups,
      images: [{ ...image, source: { ...image.source, splats } }],
    });
    const src = doc.images[0]?.source;
    expect(src?.kind === "volume" ? src.splats : null).toEqual(splats);
  });
});
