/**
 * Minerva command registry: every programmatic state change goes through a
 * named command with a description and a zod input schema.
 *
 * The shape (`name` / `description` / `input` → JSON Schema) is deliberately
 * the same as an MCP tool, so a future MCP or agent endpoint can expose these
 * commands without re-describing them. Commands only touch the shared stores
 * (or an explicit host capability), never React components.
 *
 * Uses `zod/v4` (shipped inside the installed zod 3.25) for `z.toJSONSchema`;
 * the document schemas elsewhere stay on the v3 API.
 */

import { z } from "zod/v4";
import type { ConfigWaypoint } from "@/lib/authoring/config";
import { visibilitiesForLegendRow } from "@/lib/imaging/channelCompositor";
import { useAppStore } from "@/lib/stores/appStore";
import type { ChannelGroup, Waypoint } from "@/lib/stores/documentStore";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { waypointToConfigWaypoint } from "@/lib/stores/storeUtils";
import type { MinervaState } from "./state";

// zod marks itself side-effect free, so bundlers drop its default locale;
// set it explicitly so `invalid_input` errors say what was expected.
z.config(z.locales.en());

export type MinervaErrorCode =
  | "unknown_command"
  | "invalid_input"
  | "not_ready"
  | "not_found"
  | "unsupported"
  | "failed";

export class MinervaCommandError extends Error {
  readonly code: MinervaErrorCode;
  constructor(code: MinervaErrorCode, message: string) {
    super(message);
    this.name = "MinervaCommandError";
    this.code = code;
  }
}

/** Capabilities the mounting view provides (absent → command unsupported). */
export type MinervaHost = {
  /** Same shape as `StoryDocumentInput` (kept inline so public types stay small). */
  loadDocument?: (
    input: string | { document: unknown; baseUrl?: string },
  ) => Promise<void>;
};

export type MinervaCommandContext = {
  host: MinervaHost;
  getState: () => MinervaState;
};

export type MinervaCommand<
  S extends z.ZodType = z.ZodType,
  N extends string = string,
> = {
  name: N;
  description: string;
  input: S;
  /** Fails with `not_ready` until a document is loaded. */
  requiresDocument?: boolean;
  run: (input: z.infer<S>, ctx: MinervaCommandContext) => unknown;
};

function defineCommand<S extends z.ZodType, const N extends string>(
  command: MinervaCommand<S, N>,
): MinervaCommand<S, N> {
  return command;
}

function fail(code: MinervaErrorCode, message: string): never {
  throw new MinervaCommandError(code, message);
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/* ------------------------------------------------------------------ */
/* Resolvers                                                           */
/* ------------------------------------------------------------------ */

function resolveWaypointIndex(ref: number | string): number {
  const { waypoints } = useDocumentStore.getState();
  if (typeof ref === "number") {
    if (ref < 0 || ref >= waypoints.length) {
      fail(
        "not_found",
        `Waypoint index ${ref} is out of range (0–${waypoints.length - 1}).`,
      );
    }
    return ref;
  }
  const byId = waypoints.findIndex((wp) => wp.id === ref);
  if (byId >= 0) return byId;
  const byTitle = waypoints.findIndex((wp) => sameName(wp.title, ref));
  if (byTitle >= 0) return byTitle;
  return fail(
    "not_found",
    `No waypoint with id or title "${ref}". Available: ${waypoints
      .map((wp) => `"${wp.title}"`)
      .join(", ")}.`,
  );
}

function resolveChannelGroup(ref: string): ChannelGroup {
  const { channelGroups } = useDocumentStore.getState();
  const group =
    channelGroups.find((g) => g.id === ref) ??
    channelGroups.find((g) => sameName(g.name, ref));
  if (group) return group;
  return fail(
    "not_found",
    `No channel group with id or name "${ref}". Available: ${channelGroups
      .map((g) => `"${g.name}"`)
      .join(", ")}.`,
  );
}

function groupForWaypoint(wp: Waypoint): ChannelGroup | undefined {
  const { channelGroups } = useDocumentStore.getState();
  return (
    (wp.groupId && channelGroups.find((g) => g.id === wp.groupId)) ||
    channelGroups[0]
  );
}

/**
 * Activate a waypoint the same way the playback UI does: index + its channel
 * group now; `Presentation` flies the camera when the index changes. When the
 * index is already active, re-request the camera so "go to" still recenters.
 */
function activateWaypoint(index: number): void {
  const app = useAppStore.getState();
  const wp = useDocumentStore.getState().waypoints[index];
  if (!wp) return;
  const group = groupForWaypoint(wp);
  if (group) app.setActiveChannelGroup(group.id);
  if (app.activeStoryIndex === index) {
    app.setTargetWaypointCamera(
      waypointToConfigWaypoint(wp, app.waypointAuthoring.get(wp.id)),
    );
    return;
  }
  app.setActiveStory(index);
}

/** Request a camera move; ImageViewer resolves it against its live size. */
function requestCamera(
  camera: Pick<ConfigWaypoint, "ViewState" | "Bounds">,
): void {
  useAppStore.getState().setTargetWaypointCamera({
    id: "minerva-api-view",
    Name: "",
    Content: "",
    State: { Expanded: false },
    ...camera,
  });
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

const waypointRef = z
  .union([z.number().int().min(0), z.string().min(1)])
  .describe("Zero-based waypoint index, waypoint id, or waypoint title.");

const boundsSchema = z
  .object({
    x0: z.number(),
    y0: z.number(),
    x1: z.number(),
    y1: z.number(),
  })
  .describe("Region in image pixels; x0,y0 is the top-left corner.");

const getState = defineCommand({
  name: "getState",
  description:
    "Return the current viewer state: document, waypoints, active waypoint, channel groups with channel visibility, and the camera view in image pixels.",
  input: z.object({}),
  run: (_input, ctx) => ctx.getState(),
});

const loadDocument = defineCommand({
  name: "loadDocument",
  description:
    "Load a Minerva story document, replacing the current one. Pass `url` (to a document.json) or `document` (its contents).",
  input: z
    .object({
      url: z.string().min(1).optional().describe("URL of a document.json."),
      document: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("A Minerva document.json object."),
      baseUrl: z
        .string()
        .optional()
        .describe("Base URL for relative image paths when passing `document`."),
    })
    .refine((v) => (v.url === undefined) !== (v.document === undefined), {
      message: "Pass exactly one of `url` or `document`.",
    }),
  run: async (input, ctx) => {
    if (!ctx.host.loadDocument) {
      fail("unsupported", "This Minerva view cannot load documents.");
    }
    await ctx.host.loadDocument(
      input.url ?? { document: input.document, baseUrl: input.baseUrl },
    );
  },
});

const goToWaypoint = defineCommand({
  name: "goToWaypoint",
  description:
    "Navigate to a waypoint: shows its text, switches to its channel group, and flies the camera to its view.",
  input: z.object({ waypoint: waypointRef }),
  requiresDocument: true,
  run: ({ waypoint }) => {
    activateWaypoint(resolveWaypointIndex(waypoint));
  },
});

const nextWaypoint = defineCommand({
  name: "nextWaypoint",
  description: "Navigate to the next waypoint (stays on the last one).",
  input: z.object({}),
  requiresDocument: true,
  run: () => {
    const n = useDocumentStore.getState().waypoints.length;
    if (n === 0) fail("not_found", "The document has no waypoints.");
    const i = useAppStore.getState().activeStoryIndex ?? -1;
    activateWaypoint(Math.min(n - 1, i + 1));
  },
});

const previousWaypoint = defineCommand({
  name: "previousWaypoint",
  description: "Navigate to the previous waypoint (stays on the first one).",
  input: z.object({}),
  requiresDocument: true,
  run: () => {
    const n = useDocumentStore.getState().waypoints.length;
    if (n === 0) fail("not_found", "The document has no waypoints.");
    const i = useAppStore.getState().activeStoryIndex ?? 0;
    activateWaypoint(Math.max(0, i - 1));
  },
});

const setChannelGroup = defineCommand({
  name: "setChannelGroup",
  description:
    "Switch the displayed channel group without changing the waypoint or camera.",
  input: z.object({
    group: z.string().min(1).describe("Channel group id or name."),
  }),
  requiresDocument: true,
  run: ({ group }) => {
    useAppStore.getState().setActiveChannelGroup(resolveChannelGroup(group).id);
  },
});

const setChannelVisibility = defineCommand({
  name: "setChannelVisibility",
  description:
    "Show or hide one channel, like its eye in the channel legend. Matches a row of the active channel group (or `group`); for documents without groups, an image channel.",
  input: z.object({
    channel: z
      .string()
      .min(1)
      .describe("Channel name, source channel id, or group row id."),
    visible: z.boolean(),
    group: z
      .string()
      .min(1)
      .optional()
      .describe("Channel group id or name. Defaults to the active group."),
  }),
  requiresDocument: true,
  run: ({ channel, visible, group }) => {
    const doc = useDocumentStore.getState();
    const app = useAppStore.getState();
    const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
    const nameOf = (id: string) =>
      sourceChannels.find((c) => c.id === id)?.name ?? id;
    const matches = (sourceId: string) =>
      sourceId === channel || sameName(nameOf(sourceId), channel);

    let sourceId: string;
    let rowId: string | undefined;
    if (doc.channelGroups.length > 0) {
      const target = group
        ? resolveChannelGroup(group)
        : (doc.channelGroups.find((g) => g.id === app.activeChannelGroupId) ??
          doc.channelGroups[0]);
      const row = target.channels.find(
        (gc) => gc.id === channel || matches(gc.channelId),
      );
      if (!row) {
        fail(
          "not_found",
          `No channel "${channel}" in group "${target.name}". Available: ${target.channels
            .map((gc) => `"${nameOf(gc.channelId)}"`)
            .join(", ")}.`,
        );
      }
      sourceId = row.channelId;
      rowId = row.id;
    } else {
      const sc = sourceChannels.find((c) => matches(c.id));
      if (!sc) {
        fail(
          "not_found",
          `No channel "${channel}". Available: ${sourceChannels
            .map((c) => `"${c.name}"`)
            .join(", ")}.`,
        );
      }
      sourceId = sc.id;
    }

    const next = visibilitiesForLegendRow({
      sourceChannels,
      channelGroups: doc.channelGroups,
      stackVisibilities: app.channelVisibilities,
      groupRowVisibilities: app.channelGroupRowVisibilities,
      sourceId,
      rowId,
      visible,
    });
    if (next.channelGroupRowVisibilities) {
      app.setChannelGroupRowVisibilities(next.channelGroupRowVisibilities);
    }
    if (next.channelVisibilities) {
      app.setChannelVisibilities(next.channelVisibilities);
    }
  },
});

const setView = defineCommand({
  name: "setView",
  description:
    "Move the camera. Pass `bounds` to frame a region, or `target` and/or `zoom` (omitted values keep the current view). All coordinates are image pixels.",
  input: z
    .object({
      target: z
        .tuple([z.number(), z.number()])
        .optional()
        .describe("Viewport center [x, y] in image pixels."),
      zoom: z
        .number()
        .optional()
        .describe(
          "log2 screen pixels per image pixel: 0 is 1:1, -1 is half size.",
        ),
      bounds: boundsSchema.optional(),
    })
    .refine(
      (v) =>
        v.bounds !== undefined
          ? v.target === undefined && v.zoom === undefined
          : v.target !== undefined || v.zoom !== undefined,
      { message: "Pass `bounds`, or `target` and/or `zoom`." },
    ),
  requiresDocument: true,
  run: ({ target, zoom, bounds }, ctx) => {
    if (bounds) {
      requestCamera({ Bounds: bounds });
      return;
    }
    const current = ctx.getState().view;
    const nextTarget = target ?? current?.target;
    const nextZoom = zoom ?? current?.zoom;
    if (!nextTarget || nextZoom === undefined) {
      fail(
        "not_ready",
        "The viewer has no camera yet; pass both `target` and `zoom`.",
      );
    }
    requestCamera({
      ViewState: { target: [nextTarget[0], nextTarget[1], 0], zoom: nextZoom },
    });
  },
});

const resetView = defineCommand({
  name: "resetView",
  description: "Fit the whole image in the viewport.",
  input: z.object({}),
  requiresDocument: true,
  run: (_input, ctx) => {
    const image = ctx.getState().image;
    if (!image) fail("not_ready", "No image is loaded.");
    requestCamera({
      Bounds: { x0: 0, y0: 0, x1: image.width, y1: image.height },
    });
  },
});

export const minervaCommands = [
  getState,
  loadDocument,
  goToWaypoint,
  nextWaypoint,
  previousWaypoint,
  setChannelGroup,
  setChannelVisibility,
  setView,
  resetView,
] as const satisfies readonly MinervaCommand[];

export type MinervaCommandName = (typeof minervaCommands)[number]["name"];

/** Typed input for each command, e.g. `MinervaCommandInput<"setView">`. */
export type MinervaCommandInput<N extends MinervaCommandName> = z.input<
  Extract<(typeof minervaCommands)[number], { name: N }>["input"]
>;

/** MCP-style tool listing: name, description, JSON Schema for the input. */
export type MinervaCommandDescriptor = {
  name: MinervaCommandName;
  description: string;
  inputSchema: Record<string, unknown>;
};

export function describeMinervaCommands(): MinervaCommandDescriptor[] {
  return minervaCommands.map((c) => ({
    name: c.name,
    description: c.description,
    inputSchema: z.toJSONSchema(c.input, { io: "input" }) as Record<
      string,
      unknown
    >,
  }));
}

export type MinervaCommandResult =
  | { ok: true; state: MinervaState; data?: unknown }
  | {
      ok: false;
      code: MinervaErrorCode;
      error: string;
      state: MinervaState;
    };

/** Validate and run one command. Never throws; failures come back as results. */
export async function runMinervaCommand(
  name: string,
  rawInput: unknown,
  ctx: MinervaCommandContext,
): Promise<MinervaCommandResult> {
  const failure = (code: MinervaErrorCode, error: string) =>
    ({ ok: false, code, error, state: ctx.getState() }) as const;

  const command = (minervaCommands as readonly MinervaCommand[]).find(
    (c) => c.name === name,
  );
  if (!command) {
    return failure(
      "unknown_command",
      `Unknown command "${name}". Known: ${minervaCommands.map((c) => c.name).join(", ")}.`,
    );
  }
  const parsed = command.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return failure("invalid_input", z.prettifyError(parsed.error));
  }
  if (command.requiresDocument && ctx.getState().status !== "ready") {
    return failure("not_ready", "No document is loaded yet.");
  }
  try {
    const data = await command.run(parsed.data, ctx);
    const state = ctx.getState();
    return data === undefined || data === state
      ? { ok: true, state }
      : { ok: true, state, data };
  } catch (e) {
    if (e instanceof MinervaCommandError) return failure(e.code, e.message);
    return failure("failed", e instanceof Error ? e.message : String(e));
  }
}
