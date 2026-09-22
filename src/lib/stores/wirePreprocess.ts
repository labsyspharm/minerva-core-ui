/**
 * Wire-format preprocess helpers used before Zod parse.
 * Kept separate from `documentSchema` and `storeUtils` so neither imports the other
 * for these functions (avoids a runtime cycle).
 */

/** Legacy story.json / exhibit keys on a single waypoint object (`shapes` → `shapeIds`, etc.). */
export function normalizeWaypointRecord(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const w = { ...raw };
  if (
    !("shapeIds" in w) &&
    "shapes" in w &&
    Array.isArray((w as { shapes?: unknown }).shapes)
  ) {
    w.shapeIds = (w as { shapes: string[] }).shapes;
  }
  if (
    !("groupId" in w) &&
    "group" in w &&
    typeof (w as { group?: unknown }).group === "string"
  ) {
    w.groupId = (w as { group: string }).group;
  }
  if (
    !("groupId" in w) &&
    "Group" in w &&
    typeof (w as { Group?: unknown }).Group === "string"
  ) {
    w.groupId = (w as { Group: string }).Group;
  }
  if (!("thumbnail" in w) || w.thumbnail == null) {
    w.thumbnail = "";
  }
  return w;
}

function normalizeRawShape(shape: unknown): unknown {
  if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
    return shape;
  }
  const s = shape as Record<string, unknown>;
  let next: Record<string, unknown> = { ...s };
  if (typeof next.uuid === "string" && next.id === undefined) {
    next = { ...next, id: next.uuid };
  }
  if (next.type !== "arrow") return next;
  if (typeof next.text === "string" && next.label === undefined) {
    next = { ...next, label: next.text };
  }

  const hasPoint =
    next.point !== null &&
    typeof next.point === "object" &&
    !Array.isArray(next.point);
  const angle = next.angle;
  const hasAngle =
    angle !== undefined &&
    angle !== null &&
    !(typeof angle === "string" && (angle as string).trim() === "");

  if (hasPoint && hasAngle) {
    return next;
  }

  const from = next.from as { x?: number; y?: number } | undefined;
  const to = next.to as { x?: number; y?: number } | undefined;
  if (
    from &&
    to &&
    typeof from.x === "number" &&
    typeof from.y === "number" &&
    typeof to.x === "number" &&
    typeof to.y === "number"
  ) {
    return {
      ...next,
      point: to,
      angle: Math.atan2(from.y - to.y, from.x - to.x),
    };
  }
  return next;
}

/** Preprocess wire JSON (legacy keys, arrow `from`/`to`, etc.) before `DocumentDataSchema` / export parse. */
export function preprocessDocumentDataRaw(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const d = raw as Record<string, unknown>;
  let next: Record<string, unknown> = { ...d };
  if ("groups" in next && !("channelGroups" in next)) {
    next.channelGroups = next.groups;
    delete next.groups;
  }
  const shapes = next.shapes;
  const waypoints = next.waypoints;
  if (Array.isArray(shapes)) {
    next = {
      ...next,
      shapes: shapes.map(normalizeRawShape),
    };
  }
  if (Array.isArray(waypoints)) {
    next = {
      ...next,
      waypoints: waypoints.map((wp) => {
        if (wp === null || typeof wp !== "object" || Array.isArray(wp)) {
          return wp;
        }
        return normalizeWaypointRecord(wp as Record<string, unknown>);
      }),
    };
  }
  return next;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * Expand minimal `story.json` root with synthetic full-document fields, then
 * {@link preprocessDocumentDataRaw} (consumers: `JsonExportSchema` in `documentSchema.ts`).
 */
export function preprocessJsonExportRoot(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const d = raw as Record<string, unknown>;
  return preprocessDocumentDataRaw({
    ...d,
    metadata: {},
    channelGroups: [],
    images: [],
  });
}
