import {
  type DocumentData,
  DocumentDataSchema,
  isUuid,
  preprocessDocumentDataRaw,
} from "./documentSchema";

const VERSIONS = new Set(["1", "2"]);

/** story.json root: version + waypoints + shapes only. */
export function isJsonExportRoot(raw: unknown): raw is {
  version: string;
  waypoints: unknown[];
  shapes: unknown[];
} {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.version === "string" &&
    VERSIONS.has(o.version) &&
    Array.isArray(o.waypoints) &&
    Array.isArray(o.shapes)
  );
}

type LegacyGroupChannel = {
  id: string;
  LowerRange: number;
  UpperRange: number;
  Color: { R: number; G: number; B: number };
  sourceChannelId: string;
  groupId: string;
  State?: { Expanded: boolean };
};

type LegacyGroup = {
  id: string;
  Name: string;
  GroupChannels: LegacyGroupChannel[];
  State?: { Expanded: boolean };
};

type LegacySourceChannel = {
  id: string;
  Name: string;
  SourceIndex: number;
  Samples: number;
  sourceImageId: string;
  sourceDataTypeId: string;
  sourceDistribution?: {
    id: string;
    YValues: number[];
    XScale: string;
    YScale: string;
    LowerRange: number;
    UpperRange: number;
  };
};

type LegacyExhibitImage = {
  sizeX: number;
  sizeY: number;
  sizeC: number;
  basename?: string;
  omeXmlHash?: string;
  uuid?: string;
  id?: string;
  omero?: {
    omeroServerName: string;
    imageIdentifier: number | string;
  };
};

function normalizeOmero(
  omero: LegacyExhibitImage["omero"],
): DocumentData["images"][0]["omero"] | undefined {
  if (!omero) return undefined;
  const id = omero.imageIdentifier;
  return {
    omeroServerName: omero.omeroServerName,
    imageIdentifier: typeof id === "string" ? Number.parseInt(id, 10) || 0 : id,
  };
}

function normalizeLegacySnapshot(raw: Record<string, unknown>): unknown {
  const imageWidth = typeof raw.imageWidth === "number" ? raw.imageWidth : 0;
  const imageHeight = typeof raw.imageHeight === "number" ? raw.imageHeight : 0;

  const hasNewChannels =
    "channels" in raw &&
    Array.isArray((raw as { channels?: unknown }).channels);
  if (
    Array.isArray(raw.waypoints) &&
    Array.isArray(raw.shapes) &&
    Array.isArray(raw.groups) &&
    Array.isArray(raw.sourceChannels) &&
    !hasNewChannels
  ) {
    const groups = (raw.groups as LegacyGroup[]).map((g) => ({
      id: g.id,
      name: g.Name,
      expanded: g.State?.Expanded,
      channels: (g.GroupChannels ?? []).map((gc) => ({
        id: gc.id,
        channelId: gc.sourceChannelId,
        color: { r: gc.Color.R, g: gc.Color.G, b: gc.Color.B },
        lowerLimit: gc.LowerRange,
        upperLimit: gc.UpperRange,
      })),
    }));

    const channels = (raw.sourceChannels as LegacySourceChannel[]).map(
      (sc) => ({
        id: sc.id,
        imageId: sc.sourceImageId,
        index: sc.SourceIndex,
        name: sc.Name,
        samples: sc.Samples,
        sourceDataTypeId: sc.sourceDataTypeId,
        sourceDistribution: sc.sourceDistribution,
      }),
    );

    const images = Array.isArray(raw.images)
      ? (raw.images as LegacyExhibitImage[]).map((im) => ({
          id: im.id ?? im.uuid ?? crypto.randomUUID(),
          sizeX: im.sizeX,
          sizeY: im.sizeY,
          sizeC: im.sizeC,
          omero: normalizeOmero(im.omero),
          omeXmlHash: im.omeXmlHash ?? "",
          basename: im.basename ?? "",
        }))
      : [];

    const waypoints = (raw.waypoints as Record<string, unknown>[]).map((w) => {
      const { State: _s, ViewState: _v, Pan: _p, Zoom: _z, ...rest } = w;
      const thumb = rest.thumbnail;
      return {
        ...rest,
        thumbnail: typeof thumb === "string" ? thumb : "",
      };
    });

    return {
      imageWidth,
      imageHeight,
      waypoints,
      shapes: raw.shapes,
      groups,
      channels,
      images,
    };
  }

  return raw;
}

function buildIdReplacementMap(data: {
  waypoints: Record<string, unknown>[];
  shapes: Record<string, unknown>[];
  groups: {
    id: string;
    channels: { id: string; channelId: string }[];
  }[];
  channels: { id: string }[];
  images: { id: string }[];
}): Map<string, string> {
  const map = new Map<string, string>();

  const note = (id: unknown) => {
    if (typeof id !== "string" || id.length === 0) return;
    if (!map.has(id)) map.set(id, isUuid(id) ? id : crypto.randomUUID());
  };

  for (const im of data.images) note(im?.id);
  for (const c of data.channels) note(c?.id);
  for (const g of data.groups) {
    note(g?.id);
    for (const gc of g.channels ?? []) {
      note(gc?.id);
      note(gc?.channelId);
    }
  }
  for (const w of data.waypoints) {
    note(w?.id);
    if (w.groupId != null) note(w.groupId);
    const sids = w.shapeIds;
    if (Array.isArray(sids)) for (const sid of sids) note(sid);
  }
  for (const s of data.shapes) note(s?.id);

  return map;
}

function rewriteIds<T>(value: T, idMap: Map<string, string>): T {
  const rep = (s: string): string => idMap.get(s) ?? s;

  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return idMap.has(v) ? rep(v) : v;
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    const o = v as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) {
      if (
        (k === "id" ||
          k === "groupId" ||
          k === "channelId" ||
          k === "imageId") &&
        typeof val === "string"
      ) {
        next[k] = rep(val);
      } else if (k === "shapeIds" && Array.isArray(val)) {
        next[k] = val.map((x) => (typeof x === "string" ? rep(x) : x));
      } else {
        next[k] = walk(val);
      }
    }
    return next;
  };

  return walk(value) as T;
}

/**
 * Validate and normalize unknown input into {@link DocumentData}.
 * Migrates legacy exhibit store snapshots and coerces non-UUID primary ids.
 */
export function validateDocumentData(input: unknown): DocumentData {
  let candidate: unknown = input;

  if (isJsonExportRoot(candidate)) {
    candidate = {
      imageWidth: 0,
      imageHeight: 0,
      waypoints: candidate.waypoints,
      shapes: candidate.shapes,
      groups: [],
      channels: [],
      images: [],
    };
  } else if (
    candidate !== null &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    Array.isArray((candidate as Record<string, unknown>).waypoints) &&
    Array.isArray((candidate as Record<string, unknown>).shapes) &&
    Array.isArray((candidate as Record<string, unknown>).groups) &&
    Array.isArray((candidate as Record<string, unknown>).sourceChannels) &&
    !(
      "channels" in (candidate as object) &&
      Array.isArray((candidate as { channels?: unknown }).channels)
    )
  ) {
    candidate = normalizeLegacySnapshot(candidate as Record<string, unknown>);
  }

  candidate = preprocessDocumentDataRaw(candidate);
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new Error("minerva: invalid document root");
  }

  const asRecord = candidate as Record<string, unknown>;
  const draft = {
    imageWidth:
      typeof asRecord.imageWidth === "number" ? asRecord.imageWidth : 0,
    imageHeight:
      typeof asRecord.imageHeight === "number" ? asRecord.imageHeight : 0,
    waypoints: (asRecord.waypoints ?? []) as Record<string, unknown>[],
    shapes: (asRecord.shapes ?? []) as Record<string, unknown>[],
    groups: (asRecord.groups ?? []) as {
      id: string;
      channels: { id: string; channelId: string }[];
    }[],
    channels: (asRecord.channels ?? []) as { id: string }[],
    images: (asRecord.images ?? []) as { id: string }[],
  };

  const idMap = buildIdReplacementMap(draft);
  const rewritten = rewriteIds(draft, idMap);

  return DocumentDataSchema.parse(rewritten);
}

export function safeParseDocumentData(input: unknown) {
  try {
    return { success: true as const, data: validateDocumentData(input) };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
