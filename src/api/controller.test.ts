import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/stores/appStore";
import type { DocumentData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { createMinervaController } from "./controller";

const IMAGE = "c3d4e5f6-a7b8-4901-a234-56789abcdef0";
const CH = [
  "d4e5f6a7-b8c9-4012-a345-6789abcdef01",
  "d4e5f6a7-b8c9-4012-a345-6789abcdef02",
  "d4e5f6a7-b8c9-4012-a345-6789abcdef03",
];
const GROUP_A = "b2c3d4e5-f6a7-4890-a123-456789abcde1";
const GROUP_B = "b2c3d4e5-f6a7-4890-a123-456789abcde2";
const ROW = [
  "e5f6a7b8-c9d0-4123-a456-789abcdef011",
  "e5f6a7b8-c9d0-4123-a456-789abcdef012",
  "e5f6a7b8-c9d0-4123-a456-789abcdef013",
];
const WP = [
  "8320f08c-9456-49a3-a104-8ab3d5daab21",
  "8320f08c-9456-49a3-a104-8ab3d5daab22",
];

const viewport = { upperLeft: { x: 0, y: 0 }, lowerRight: { x: 1, y: 1 } };
const color = { r: 255, g: 0, b: 0 };

const DOC: DocumentData = {
  metadata: { title: "Test story" },
  images: [
    {
      id: IMAGE,
      sizeX: 1000,
      sizeY: 500,
      sizeC: 3,
      omeXmlHash: "",
      basename: "test.ome.tif",
      contentRole: "intensity",
      source: { kind: "url", url: "https://example.org/test.ome.tif" },
      channels: CH.map((id, index) => ({
        id,
        index,
        name: ["DNA", "CD45", "PanCK"][index],
        kind: "channel" as const,
        samples: 1,
      })),
    },
  ],
  channelGroups: [
    {
      id: GROUP_A,
      name: "Structure",
      channels: [
        { id: ROW[0], channelId: CH[0], color, lowerLimit: 0, upperLimit: 1 },
        { id: ROW[1], channelId: CH[2], color, lowerLimit: 0, upperLimit: 1 },
      ],
    },
    {
      id: GROUP_B,
      name: "Immune",
      channels: [
        { id: ROW[2], channelId: CH[1], color, lowerLimit: 0, upperLimit: 1 },
      ],
    },
  ],
  waypoints: [
    {
      id: WP[0],
      title: "Overview",
      content: "",
      thumbnail: "",
      viewport,
      shapeIds: [],
    },
    {
      id: WP[1],
      title: "Immune cells",
      groupId: GROUP_B,
      content: "",
      thumbnail: "",
      viewport,
      shapeIds: [],
    },
  ],
  shapes: [],
  featureTables: [],
} as DocumentData;

function setup() {
  const c = createMinervaController();
  c.setStatus("ready");
  return c;
}

beforeEach(() => {
  useDocumentStore.getState().hydrateFromDocument(DOC, crypto.randomUUID());
  useAppStore.getState().resetStoryViewerSession();
  useAppStore.setState({
    activeChannelGroupId: GROUP_A,
    channelGroupRowVisibilities: {},
    channelVisibilities: {},
  });
});

describe("MinervaHandle state", () => {
  it("summarizes document, waypoints and channel groups", () => {
    const { handle } = setup();
    const s = handle.getState();
    expect(s.status).toBe("ready");
    expect(s.document.title).toBe("Test story");
    expect(s.image).toEqual({ width: 1000, height: 500 });
    expect(s.waypoints.map((w) => w.title)).toEqual([
      "Overview",
      "Immune cells",
    ]);
    expect(s.channelGroups[0]).toMatchObject({
      name: "Structure",
      active: true,
    });
    expect(s.channelGroups[0].channels.map((c) => c.name)).toEqual([
      "DNA",
      "PanCK",
    ]);
    expect(s.channelGroups[0].channels[0].color).toBe("#ff0000");
  });

  it("returns a stable snapshot until relevant state changes", () => {
    const { handle } = setup();
    const a = handle.getState();
    useAppStore.getState().setHoveredShape("x");
    expect(handle.getState()).toBe(a);
    useAppStore.getState().setActiveStory(1);
    expect(handle.getState()).not.toBe(a);
  });

  it("notifies subscribers once per burst of store updates", async () => {
    const { handle } = setup();
    const seen: number[] = [];
    handle.subscribe((s) => seen.push(s.activeWaypoint?.index ?? -1));
    await handle.goToWaypoint(1);
    await Promise.resolve();
    expect(seen).toEqual([1]);
  });
});

describe("MinervaHandle commands", () => {
  it("goes to a waypoint by index, id, or title and applies its group", async () => {
    const { handle } = setup();
    let s = await handle.goToWaypoint("Immune cells");
    expect(s.activeWaypoint).toEqual({ id: WP[1], index: 1 });
    expect(s.activeChannelGroupId).toBe(GROUP_B);
    s = await handle.goToWaypoint(WP[0]);
    expect(s.activeWaypoint?.index).toBe(0);
    s = await handle.nextWaypoint();
    expect(s.activeWaypoint?.index).toBe(1);
    s = await handle.nextWaypoint();
    expect(s.activeWaypoint?.index).toBe(1);
    s = await handle.previousWaypoint();
    expect(s.activeWaypoint?.index).toBe(0);
  });

  it("re-requests the camera when the waypoint is already active", async () => {
    const { handle } = setup();
    await handle.goToWaypoint(0);
    useAppStore.getState().clearTargetWaypointCamera();
    await handle.goToWaypoint(0);
    expect(useAppStore.getState().targetWaypointCamera?.id).toBe(WP[0]);
  });

  it("switches channel group by name, showing only that group", async () => {
    const { handle } = setup();
    await handle.setChannelVisibility("CD45", false, "Immune");
    const s = await handle.setChannelGroup("immune");
    expect(s.activeChannelGroupId).toBe(GROUP_B);
    const visible = (g: (typeof s.channelGroups)[number]) =>
      g.channels.map((c) => c.visible);
    // Like the legend's group picker: the picked group's rows come back on.
    expect(visible(s.channelGroups[1])).toEqual([true]);
    expect(visible(s.channelGroups[0])).toEqual([false, false]);
  });

  it("goes to a waypoint showing only its channel group", async () => {
    const { handle } = setup();
    const s = await handle.goToWaypoint("Immune cells");
    expect(s.channelGroups[1].channels[0].visible).toBe(true);
    expect(s.channelGroups[0].channels.map((c) => c.visible)).toEqual([
      false,
      false,
    ]);
  });

  it("toggles a channel in the active group by name", async () => {
    const { handle } = setup();
    let s = await handle.setChannelVisibility("PanCK", false);
    expect(s.channelGroups[0].channels[1].visible).toBe(false);
    s = await handle.setChannelVisibility("PanCK", true);
    expect(s.channelGroups[0].channels[1].visible).toBe(true);
  });

  it("flips RGB planes together, only within the row's group", async () => {
    const rgbRows = (prefix: string) =>
      CH.map((channelId, i) => ({
        id: `${prefix}${i}`,
        channelId,
        color,
        lowerLimit: 0,
        upperLimit: 1,
      }));
    const rowsA = rgbRows("e5f6a7b8-c9d0-4123-a456-789abcdef02");
    const rowsB = rgbRows("e5f6a7b8-c9d0-4123-a456-789abcdef03");
    useDocumentStore.getState().hydrateFromDocument(
      {
        ...DOC,
        images: [
          {
            ...DOC.images[0],
            channels: DOC.images[0].channels.map((c, i) => ({
              ...c,
              name: ["R", "G", "B"][i],
            })),
          },
        ],
        channelGroups: [
          { id: GROUP_A, name: "H&E", channels: rowsA },
          { id: GROUP_B, name: "H&E copy", channels: rowsB },
        ],
      },
      crypto.randomUUID(),
    );
    // Both groups showing, so an unscoped flip would hide the copy too.
    useAppStore.setState({
      channelGroupRowVisibilities: Object.fromEntries(
        [...rowsA, ...rowsB].map((r) => [r.id, true]),
      ),
    });
    const { handle } = setup();
    const s = await handle.setChannelVisibility("G", false);
    expect(s.channelGroups[0].channels.map((c) => c.visible)).toEqual([
      false,
      false,
      false,
    ]);
    expect(s.channelGroups[1].channels.map((c) => c.visible)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("hides one ungrouped channel without disturbing the default set", async () => {
    const ids = Array.from(
      { length: 7 },
      (_, i) => `d4e5f6a7-b8c9-4012-a345-6789abcdef1${i}`,
    );
    useDocumentStore.getState().hydrateFromDocument(
      {
        ...DOC,
        channelGroups: [],
        images: [
          {
            ...DOC.images[0],
            sizeC: ids.length,
            channels: ids.map((id, index) => ({
              id,
              index,
              name: `C${index}`,
              kind: "channel" as const,
              samples: 1,
            })),
          },
        ],
        waypoints: DOC.waypoints.map(({ groupId: _g, ...wp }) => wp),
      },
      crypto.randomUUID(),
    );
    const { handle } = setup();
    const shown = (s: ReturnType<typeof handle.getState>) =>
      s.ungroupedChannels.filter((c) => c.visible).map((c) => c.name);
    // Renderer default: first five intensity channels.
    expect(shown(handle.getState())).toEqual(["C0", "C1", "C2", "C3", "C4"]);
    const s = await handle.setChannelVisibility("C2", false);
    expect(shown(s)).toEqual(["C0", "C1", "C3", "C4"]);
  });

  it("requests a camera in image pixels", async () => {
    const { handle } = setup();
    await handle.setView({ bounds: { x0: 10, y0: 20, x1: 110, y1: 220 } });
    expect(useAppStore.getState().targetWaypointCamera?.Bounds).toEqual({
      x0: 10,
      y0: 20,
      x1: 110,
      y1: 220,
    });
    await handle.setView({ target: [500, 250], zoom: -2 });
    expect(useAppStore.getState().targetWaypointCamera?.ViewState).toEqual({
      target: [500, 250, 0],
      zoom: -2,
    });
    await handle.resetView();
    expect(useAppStore.getState().targetWaypointCamera?.Bounds).toEqual({
      x0: 0,
      y0: 0,
      x1: 1000,
      y1: 500,
    });
  });

  it("reports failures as results from execute and rejects from helpers", async () => {
    const { handle } = setup();
    const missing = await handle.execute("goToWaypoint", { waypoint: 9 });
    expect(missing).toMatchObject({ ok: false, code: "not_found" });
    const bad = await handle.execute("setView", {});
    expect(bad).toMatchObject({ ok: false, code: "invalid_input" });
    const unknown = await handle.execute("explode", {});
    expect(unknown).toMatchObject({ ok: false, code: "unknown_command" });
    const noHost = await handle.execute("loadDocument", { url: "x.json" });
    expect(noHost).toMatchObject({ ok: false, code: "unsupported" });
    await expect(handle.setChannelGroup("nope")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("refuses document commands until ready", async () => {
    const c = createMinervaController();
    c.setStatus("loading");
    const r = await c.handle.execute("nextWaypoint");
    expect(r).toMatchObject({ ok: false, code: "not_ready" });
  });

  it("describes every command with an object JSON Schema (MCP tools/list shape)", () => {
    const { handle } = setup();
    const tools = handle.listCommands();
    expect(tools.map((t) => t.name)).toContain("goToWaypoint");
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
    const goTo = tools.find((t) => t.name === "goToWaypoint");
    expect(goTo?.inputSchema.required).toEqual(["waypoint"]);
  });
});
