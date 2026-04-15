import {
  type DocumentData,
  DocumentDataSchema,
  DocumentMetadataSchema,
} from "./documentSchema";
import { isUuid, preprocessDocumentDataRaw } from "./storeUtils";

const VERSIONS = new Set(["1", "2"]);

/** story.json root: version + waypoints + shapes only. */
function isJsonExportRoot(raw: unknown): raw is {
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

/** Fold legacy flat `channels[]` into `images[].channels` (each with `id`). */
function parseMetadataField(raw: unknown): DocumentData["metadata"] {
  const r = DocumentMetadataSchema.safeParse(raw);
  return r.success ? r.data : {};
}

function foldTopLevelChannelsIntoImages(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const chList = raw.channels;
  if (!Array.isArray(chList) || chList.length === 0) return raw;

  type FlatCh = {
    id: string;
    imageId: string;
    index: number;
    name: string;
    samples?: number;
    sourceDataTypeId?: string;
    sourceDistribution?: DocumentData["images"][0]["channels"][0]["sourceDistribution"];
  };

  const flat = chList as FlatCh[];

  const imagesIn = Array.isArray(raw.images)
    ? ([...raw.images] as Record<string, unknown>[])
    : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const im of imagesIn) {
    if (im && typeof im.id === "string") {
      const ch = Array.isArray(im.channels)
        ? [...(im.channels as unknown[])]
        : [];
      byKey.set(im.id, { ...im, channels: ch });
    }
  }

  for (const c of flat) {
    const imgId = String(c.imageId);
    let im = byKey.get(imgId);
    if (!im) {
      im = {
        id: imgId,
        sizeX: 1,
        sizeY: 1,
        sizeC: 0,
        omeXmlHash: "",
        basename: "",
        channels: [],
      };
      imagesIn.push(im);
      byKey.set(imgId, im);
    }
    const channels = (im.channels as Record<string, unknown>[]) ?? [];
    if (
      !channels.some(
        (row) =>
          row &&
          typeof (row as { id?: string }).id === "string" &&
          (row as { id: string }).id === String(c.id),
      )
    ) {
      channels.push({
        id: String(c.id),
        index: c.index,
        name: c.name ?? "",
        ...(c.samples != null ? { samples: c.samples } : {}),
        ...(c.sourceDataTypeId != null
          ? { sourceDataTypeId: c.sourceDataTypeId }
          : {}),
        ...(c.sourceDistribution != null
          ? { sourceDistribution: c.sourceDistribution }
          : {}),
      });
    }
    im.channels = channels;
  }

  const channelGroupsIn = Array.isArray(raw.channelGroups)
    ? (raw.channelGroups as Record<string, unknown>[])
    : Array.isArray(raw.groups)
      ? (raw.groups as Record<string, unknown>[])
      : [];
  const { channels: _removed, groups: _legacyGroups, ...rest } = raw;
  return { ...rest, images: imagesIn, channelGroups: channelGroupsIn };
}

function normalizeLegacySnapshot(raw: Record<string, unknown>): unknown {
  const imageWidth = typeof raw.imageWidth === "number" ? raw.imageWidth : 0;
  const imageHeight = typeof raw.imageHeight === "number" ? raw.imageHeight : 0;

  const hasNewNested =
    Array.isArray(raw.images) &&
    (raw.images as Record<string, unknown>[]).some(
      (im) => im && Array.isArray(im.channels) && im.channels.length > 0,
    );
  if (
    Array.isArray(raw.waypoints) &&
    Array.isArray(raw.shapes) &&
    (Array.isArray(raw.groups) || Array.isArray(raw.channelGroups)) &&
    Array.isArray(raw.sourceChannels) &&
    !hasNewNested
  ) {
    const sourceChannels = raw.sourceChannels as LegacySourceChannel[];

    let images = Array.isArray(raw.images)
      ? (raw.images as LegacyExhibitImage[]).map((im) => ({
          id: im.id ?? im.uuid ?? crypto.randomUUID(),
          sizeX: im.sizeX,
          sizeY: im.sizeY,
          sizeC: im.sizeC,
          omero: normalizeOmero(im.omero),
          omeXmlHash: im.omeXmlHash ?? "",
          basename: im.basename ?? "",
          channels: [] as DocumentData["images"][0]["channels"],
        }))
      : [];

    const imageByLegacyId = new Map<string, (typeof images)[0]>();
    for (const im of images) {
      imageByLegacyId.set(im.id, im);
    }

    for (const sc of sourceChannels) {
      const imgId = sc.sourceImageId;
      let im = imageByLegacyId.get(imgId);
      if (!im) {
        im = {
          id: imgId,
          sizeX: 1,
          sizeY: 1,
          sizeC: 0,
          omero: undefined,
          omeXmlHash: "",
          basename: "",
          channels: [],
        };
        images.push(im);
        imageByLegacyId.set(imgId, im);
      }
      if (!im.channels.some((row) => row.id === sc.id)) {
        im.channels.push({
          id: sc.id,
          index: sc.SourceIndex,
          name: sc.Name,
          samples: sc.Samples,
          sourceDataTypeId: sc.sourceDataTypeId,
          sourceDistribution: sc.sourceDistribution,
        });
      }
    }

    const legacyGroupRows = (
      Array.isArray(raw.channelGroups) ? raw.channelGroups : raw.groups
    ) as LegacyGroup[];
    const channelGroups = legacyGroupRows.map((g) => ({
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

    const waypoints = (raw.waypoints as Record<string, unknown>[]).map((w) => {
      const { State: _s, ViewState: _v, Pan: _p, Zoom: _z, ...rest } = w;
      const thumb = rest.thumbnail;
      return {
        ...rest,
        thumbnail: typeof thumb === "string" ? thumb : "",
      };
    });

    if (imageWidth > 0 && imageHeight > 0 && images.length > 0) {
      images = [
        {
          ...images[0],
          sizeX: imageWidth,
          sizeY: imageHeight,
        },
        ...images.slice(1),
      ];
    }

    return {
      metadata: {},
      waypoints,
      shapes: raw.shapes,
      channelGroups,
      images,
    };
  }

  return raw;
}

function ensureImageChannelIds(images: { id: string; channels?: unknown[] }[]) {
  for (const im of images) {
    for (const rawCh of im.channels ?? []) {
      const ch = rawCh as Record<string, unknown>;
      if (typeof ch.id !== "string" || ch.id.length === 0) {
        ch.id = crypto.randomUUID();
      }
    }
  }
}

/** Older documents used `imageId` + `channelIndex` on group rows; resolve to nested `channelId`. */
function migrateGroupChannelsToChannelId(
  channelGroups: { channels?: unknown[] }[],
  images: { id: string; channels?: { id?: string; index?: number }[] }[],
) {
  for (const g of channelGroups) {
    for (const rawGc of g.channels ?? []) {
      const gc = rawGc as Record<string, unknown>;
      if (typeof gc.channelId === "string" && gc.channelId.length > 0) {
        continue;
      }
      const imId = gc.imageId;
      const idx = gc.channelIndex;
      if (typeof imId !== "string" || typeof idx !== "number") {
        continue;
      }
      const im = images.find((i) => i.id === imId);
      const ch = im?.channels?.find((c) => c.index === idx);
      if (ch && typeof ch.id === "string") {
        gc.channelId = ch.id;
      }
      delete gc.imageId;
      delete gc.channelIndex;
    }
  }
}

function buildIdReplacementMap(data: {
  waypoints: Record<string, unknown>[];
  shapes: Record<string, unknown>[];
  channelGroups: {
    id: string;
    channels?: unknown[];
  }[];
  images: { id: string; channels?: unknown[] }[];
}): Map<string, string> {
  const map = new Map<string, string>();

  const note = (id: unknown) => {
    if (typeof id !== "string" || id.length === 0) return;
    if (!map.has(id)) map.set(id, isUuid(id) ? id : crypto.randomUUID());
  };

  for (const im of data.images) {
    note(im?.id);
    for (const ch of im.channels ?? []) {
      const row = ch as {
        id?: string;
        sourceDistribution?: { id?: string };
      };
      if (row?.id != null) note(row.id);
      if (row?.sourceDistribution?.id != null) note(row.sourceDistribution.id);
    }
  }
  for (const g of data.channelGroups) {
    note(g?.id);
    for (const rawGc of g.channels ?? []) {
      const gc = rawGc as { id?: string; channelId?: string };
      note(gc?.id);
      if (gc?.channelId != null) note(gc.channelId);
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
        (k === "id" || k === "groupId" || k === "imageId") &&
        typeof val === "string"
      ) {
        next[k] = rep(val);
      } else if (k === "shapeIds" && Array.isArray(val)) {
        next[k] = val.map((x) => (typeof x === "string" ? rep(x) : x));
      } else if (k === "channelId" && typeof val === "string") {
        next[k] = rep(val);
      } else {
        next[k] = walk(val);
      }
    }
    return next;
  };

  return walk(value) as T;
}

function collectImageChannelIds(data: DocumentData): Set<string> {
  const imageChannelIds = new Set<string>();
  for (const im of data.images) {
    for (const ch of im.channels) {
      imageChannelIds.add(ch.id);
    }
  }
  return imageChannelIds;
}

/**
 * Removes references that can occur after edits (e.g. deleted channel group) so
 * {@link validateDocumentRelations} and persistence do not fail on drift.
 */
function repairDocumentReferenceDrift(data: DocumentData): DocumentData {
  const imageChannelIds = collectImageChannelIds(data);

  const channelGroups = data.channelGroups.map((g) => {
    const channels = g.channels.filter((e) => imageChannelIds.has(e.channelId));
    if (channels.length === g.channels.length) return g;
    return { ...g, channels };
  });

  const groupIds = new Set(channelGroups.map((g) => g.id));
  const shapeIds = new Set(data.shapes.map((s) => s.id));

  const waypoints = data.waypoints.map((wp) => {
    const groupId =
      wp.groupId != null && !groupIds.has(wp.groupId) ? undefined : wp.groupId;
    const shapeIdsFiltered = wp.shapeIds.filter((id) => shapeIds.has(id));
    if (
      groupId === wp.groupId &&
      shapeIdsFiltered.length === wp.shapeIds.length
    ) {
      return wp;
    }
    return { ...wp, groupId, shapeIds: shapeIdsFiltered };
  });

  const cgSame = channelGroups.every((g, i) => g === data.channelGroups[i]);
  const wpSame = waypoints.every((w, i) => w === data.waypoints[i]);
  if (cgSame && wpSame) return data;
  return { ...data, channelGroups, waypoints };
}

function validateDocumentRelations(data: DocumentData): DocumentData {
  const repaired = repairDocumentReferenceDrift(data);
  const groupIds = new Set(repaired.channelGroups.map((x) => x.id));
  const shapeIds = new Set(repaired.shapes.map((x) => x.id));
  const imageChannelIds = collectImageChannelIds(repaired);

  for (const group of repaired.channelGroups) {
    for (const entry of group.channels) {
      if (!imageChannelIds.has(entry.channelId)) {
        throw new Error(
          `minerva: group ${group.id} references missing channelId ${entry.channelId}`,
        );
      }
    }
  }

  for (const waypoint of repaired.waypoints) {
    if (waypoint.groupId != null && !groupIds.has(waypoint.groupId)) {
      throw new Error(
        `minerva: waypoint ${waypoint.id} references missing groupId ${waypoint.groupId}`,
      );
    }
    for (const shapeId of waypoint.shapeIds) {
      if (!shapeIds.has(shapeId)) {
        throw new Error(
          `minerva: waypoint ${waypoint.id} references missing shapeId ${shapeId}`,
        );
      }
    }
  }

  return repaired;
}

/**
 * Validate and normalize unknown input into {@link DocumentData}.
 * Migrates legacy exhibit store snapshots and coerces non-UUID primary ids.
 */
export function validateDocumentData(input: unknown): DocumentData {
  let candidate: unknown = input;

  if (isJsonExportRoot(candidate)) {
    candidate = {
      metadata: {},
      waypoints: candidate.waypoints,
      shapes: candidate.shapes,
      channelGroups: [],
      images: [],
    };
  } else if (
    candidate !== null &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    Array.isArray((candidate as Record<string, unknown>).waypoints) &&
    Array.isArray((candidate as Record<string, unknown>).shapes) &&
    (Array.isArray((candidate as Record<string, unknown>).groups) ||
      Array.isArray((candidate as Record<string, unknown>).channelGroups)) &&
    Array.isArray((candidate as Record<string, unknown>).sourceChannels) &&
    !(
      Array.isArray((candidate as Record<string, unknown>).images) &&
      (
        (candidate as Record<string, unknown>).images as Record<
          string,
          unknown
        >[]
      ).some((im) => im && Array.isArray(im.channels) && im.channels.length > 0)
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

  let asRecord = candidate as Record<string, unknown>;
  if (
    "channels" in asRecord &&
    Array.isArray(asRecord.channels) &&
    (asRecord.channels as unknown[]).length > 0
  ) {
    asRecord = foldTopLevelChannelsIntoImages(asRecord);
  }

  const legacyW =
    typeof asRecord.imageWidth === "number" ? asRecord.imageWidth : 0;
  const legacyH =
    typeof asRecord.imageHeight === "number" ? asRecord.imageHeight : 0;

  let imagesDraft = (asRecord.images ?? []) as {
    id: string;
    sizeX?: number;
    sizeY?: number;
    channels?: unknown[];
  }[];

  if (legacyW > 0 && legacyH > 0 && imagesDraft.length > 0) {
    imagesDraft = [
      {
        ...imagesDraft[0],
        sizeX: legacyW,
        sizeY: legacyH,
      },
      ...imagesDraft.slice(1),
    ];
  }

  const rawCg = asRecord.channelGroups ?? asRecord.groups;
  const draft = {
    metadata: parseMetadataField(asRecord.metadata),
    waypoints: (asRecord.waypoints ?? []) as Record<string, unknown>[],
    shapes: (asRecord.shapes ?? []) as Record<string, unknown>[],
    channelGroups: (Array.isArray(rawCg) ? rawCg : []) as {
      id: string;
      channels: Record<string, unknown>[];
    }[],
    images: imagesDraft,
  };

  for (const im of draft.images) {
    if (!Array.isArray(im.channels)) im.channels = [];
  }

  ensureImageChannelIds(draft.images);
  migrateGroupChannelsToChannelId(draft.channelGroups, draft.images);

  for (const g of draft.channelGroups) {
    for (const rawGc of g.channels ?? []) {
      const gc = rawGc as Record<string, unknown>;
      if (typeof gc.id !== "string" || gc.id.length === 0) {
        gc.id = crypto.randomUUID();
      }
      if (typeof gc.channelId !== "string" || gc.channelId.length === 0) {
        throw new Error(
          "minerva: group channel missing channelId after migration",
        );
      }
    }
  }

  const idMap = buildIdReplacementMap(draft);
  const rewritten = rewriteIds(draft, idMap);

  const parsed = DocumentDataSchema.parse(rewritten);
  return validateDocumentRelations(parsed);
}
