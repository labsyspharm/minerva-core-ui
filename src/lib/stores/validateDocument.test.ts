import { describe, expect, it } from "vitest";
import { validateDocumentData } from "./validateDocument";
import {
  isUuid,
  normalizeWaypointRecord,
  preprocessDocumentDataRaw,
} from "./wirePreprocess";

const WP_ID = "8320f08c-9456-49a3-a104-8ab3d5daab2a";
const SHAPE_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const GROUP_ID = "b2c3d4e5-f6a7-4890-b123-456789abcdef";
const IMAGE_ID = "c3d4e5f6-a7b8-4901-c234-56789abcdef0";
const CHANNEL_ID = "d4e5f6a7-b8c9-4012-d345-6789abcdef01";

describe("wirePreprocess", () => {
  it("isUuid accepts v4-style ids", () => {
    expect(isUuid(WP_ID)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("normalizeWaypointRecord maps legacy shapes/group keys", () => {
    const out = normalizeWaypointRecord({
      id: WP_ID,
      shapes: [SHAPE_ID],
      group: GROUP_ID,
      title: "Intro",
      content: "",
      viewport: {
        upperLeft: { x: 0, y: 0 },
        lowerRight: { x: 1, y: 1 },
      },
    });
    expect(out.shapeIds).toEqual([SHAPE_ID]);
    expect(out.groupId).toBe(GROUP_ID);
    expect(out.thumbnail).toBe("");
  });

  it("preprocessDocumentDataRaw renames groups → channelGroups", () => {
    const out = preprocessDocumentDataRaw({
      metadata: {},
      waypoints: [],
      shapes: [],
      groups: [{ id: GROUP_ID, name: "G", channels: [] }],
      images: [],
    }) as Record<string, unknown>;
    expect(out.channelGroups).toEqual([
      { id: GROUP_ID, name: "G", channels: [] },
    ]);
    expect(out.groups).toBeUndefined();
  });

  it("preprocessDocumentDataRaw migrates arrow from/to to point+angle", () => {
    const out = preprocessDocumentDataRaw({
      metadata: {},
      waypoints: [],
      shapes: [
        {
          id: SHAPE_ID,
          type: "arrow",
          from: { x: 0, y: 0 },
          to: { x: 10, y: 0 },
          text: "label",
        },
      ],
      channelGroups: [],
      images: [],
    }) as { shapes: Array<Record<string, unknown>> };
    const arrow = out.shapes[0];
    expect(arrow.point).toEqual({ x: 10, y: 0 });
    expect(arrow.angle).toBe(Math.PI);
    expect(arrow.label).toBe("label");
  });
});

describe("validateDocumentData", () => {
  it("parses a minimal modern document", () => {
    const doc = validateDocumentData({
      metadata: { title: "Test" },
      waypoints: [
        {
          id: WP_ID,
          title: "Intro",
          content: "Hello",
          thumbnail: "",
          viewport: {
            upperLeft: { x: 0, y: 0 },
            lowerRight: { x: 100, y: 100 },
          },
          shapeIds: [],
        },
      ],
      shapes: [],
      channelGroups: [],
      images: [
        {
          id: IMAGE_ID,
          sizeX: 100,
          sizeY: 100,
          sizeC: 1,
          omeXmlHash: "",
          basename: "img.ome.tif",
          channels: [
            {
              id: CHANNEL_ID,
              name: "DNA",
              kind: "channel",
              samples: 1,
              index: 0,
              sourceDataTypeId: "Uint16",
            },
          ],
        },
      ],
    });
    expect(doc.waypoints).toHaveLength(1);
    expect(doc.waypoints[0].title).toBe("Intro");
    expect(doc.images[0].channels[0].name).toBe("DNA");
  });

  it("accepts story.json export root (version + waypoints + shapes)", () => {
    const doc = validateDocumentData({
      version: "2",
      waypoints: [
        {
          id: WP_ID,
          title: "W",
          content: "",
          thumbnail: "",
          viewport: {
            upperLeft: { x: 0, y: 0 },
            lowerRight: { x: 1, y: 1 },
          },
          shapeIds: [],
        },
      ],
      shapes: [],
    });
    expect(doc.channelGroups).toEqual([]);
    expect(doc.images).toEqual([]);
    expect(doc.waypoints[0].id).toBe(WP_ID);
  });

  it("maps legacy waypoint shapes key via preprocess", () => {
    const doc = validateDocumentData({
      metadata: {},
      waypoints: [
        {
          id: WP_ID,
          title: "W",
          content: "",
          shapes: [SHAPE_ID],
          viewport: {
            upperLeft: { x: 0, y: 0 },
            lowerRight: { x: 1, y: 1 },
          },
        },
      ],
      shapes: [
        {
          id: SHAPE_ID,
          type: "point",
          point: { x: 1, y: 2 },
        },
      ],
      channelGroups: [],
      images: [],
    });
    expect(doc.waypoints[0].shapeIds).toEqual([SHAPE_ID]);
    expect(doc.waypoints[0].thumbnail).toBe("");
  });
});
