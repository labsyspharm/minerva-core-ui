import {
  configWaypoints,
  exhibit_config,
  jpeg_exhibit_config,
} from "@/config/demoCrc";
import { GROUP_CHANNELS_CRC01 } from "@/lib/authoring/config";
import type { ExhibitConfig } from "@/lib/legacy/exhibit";
import type {
  ChannelGroup,
  DocumentData,
  Image,
  ImageChannel,
} from "@/lib/stores/documentSchema";
import {
  configWaypointToWaypoint,
  hydrateConfigWaypoint,
  type LegacyExhibitWaypoint,
  migrateLegacyWaypointShapes,
} from "@/lib/stores/storeUtils";
import { normalizeWaypointToBounds } from "@/lib/waypoints/waypoint";
import { getStoryRecord, saveStoryDocument } from "./storyPersistence";

/** Stable Dexie row id so `pnpm run demo` always has one spine on the library shelf. */
export const DEMO_SHELF_STORY_ID = "018fd3a0-0000-7000-8000-00000000de11";

export const DEMO_CRC_OME_TIFF_URL =
  "https://lsp-public-data.s3.amazonaws.com/lin-2021-crc-atlas/CRC01-096-097.ome.tif";

const DEMO_JPEG_URL = "crc-export";

/** Mirrors `exhibit_config.Name` for the CRC demo build. */
export const DEMO_SHELF_TITLE =
  exhibit_config.Name ??
  "Multiplexed 3D atlas of state transitions and immune interactions in colorectal cancer";

/** Pixel size of CRC01-096-097.ome.tif (from OME metadata). */
const CRC_SIZE_X = 26139;
const CRC_SIZE_Y = 27120;

/** Nominal authoring viewport used only to bake Pan/Zoom → bounds at seed time. */
const SEED_VIEWPORT_W = 1280;
const SEED_VIEWPORT_H = 800;

const DEMO_IMAGE_ID = "018fd3a0-0000-7000-8000-00000000c001";

const EMPTY_EXHIBIT_CONFIG: ExhibitConfig = {
  Name: "",
  Stories: [],
  Groups: [],
};

/** OME channel names for CRC01 (index order). */
const CRC_CHANNEL_NAMES = [
  "DNA1",
  "CYCIF_AF488",
  "CYCIF_AF555",
  "CYCIF_AF647",
  "CYCIF_DNA2",
  "CYCIF_CTRL488",
  "CYCIF_CTRL555",
  "CYCIF_CTRL647",
  "CYCIF_DNA3",
  "CYCIF_CD3",
  "Na_K_ATPase",
  "CYCIF_CD45RO",
  "CYCIF_DNA4",
  "Ki67",
  "PanCK",
  "ASMA",
  "CYCIF_DNA5",
  "CD4",
  "CD45",
  "PD1",
  "CYCIF_DNA6",
  "CD20",
  "CD68",
  "CD8a",
  "CYCIF_DNA7",
  "CD163",
  "FOXP3",
  "PDL1",
  "CYCIF_DNA8",
  "Ecadherin",
  "Vimentin",
  "CYCIF_CDX2",
  "CYCIF_DNA9",
  "LaminABC",
  "Desmin",
  "CD31",
  "DNA10",
  "PCNA",
  "CYCIF_Ki67_2",
  "Collagen",
  "HE_r",
  "HE_g",
  "HE_b",
] as const;

function hexToRgb(c: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(c, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function channelId(index: number): string {
  return `018fd3a0-0000-7000-8100-${index.toString(16).padStart(12, "0")}`;
}

function groupId(index: number): string {
  return `018fd3a0-0000-7000-8200-${index.toString(16).padStart(12, "0")}`;
}

function groupChannelRowId(groupIndex: number, rowIndex: number): string {
  const n = groupIndex * 256 + rowIndex;
  return `018fd3a0-0000-7000-8300-${n.toString(16).padStart(12, "0")}`;
}

export function isJpegDemoMode(): boolean {
  return import.meta.env.MODE === "demo-jpeg";
}

/** `pnpm run demo` (CRC OME-TIFF shelf) or `pnpm run jpeg`. */
export function isDemoContentEnabled(): boolean {
  return isJpegDemoMode() || import.meta.env.MODE === "demo";
}

export function getDemoDocumentTitle(): string {
  return isDemoContentEnabled() ? "Minerva 2.0 Demo" : "Minerva";
}

/**
 * Full CRC demo {@link DocumentData} for the library shelf: remote OME-TIFF source,
 * exhibit channel groups, and waypoints (with legacy arrows/overlays migrated).
 */
export function buildDemoCrcDocumentData(): DocumentData {
  const channels: ImageChannel[] = CRC_CHANNEL_NAMES.map((name, index) => ({
    id: channelId(index),
    index,
    name,
    kind: "channel" as const,
    samples: 1,
    sourceDataTypeId: "uint16",
  }));

  const nameByExhibitChannel: Record<string, string> = {};
  const channelGroups: ChannelGroup[] = [];
  const groups = (exhibit_config.Groups ?? []).filter(
    (g) => g.Image?.Method === "Colorimetric" && g.Path in GROUP_CHANNELS_CRC01,
  );

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const indices = GROUP_CHANNELS_CRC01[g.Path];
    if (!indices || indices.length !== g.Channels.length) continue;

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const exhibitName = g.Channels[i];
      nameByExhibitChannel[exhibitName] = channelId(idx);
      const ch = channels[idx];
      if (ch) ch.name = exhibitName;
    }

    channelGroups.push({
      id: groupId(gi),
      name: g.Name,
      expanded: gi === 0,
      channels: g.Channels.map((name, i) => ({
        id: groupChannelRowId(gi, i),
        channelId: nameByExhibitChannel[name],
        color: hexToRgb(g.Colors[i]),
        lowerLimit: g.Lows[i],
        upperLimit: g.Highs[i],
      })),
    });
  }

  const image: Image = {
    id: DEMO_IMAGE_ID,
    sizeX: CRC_SIZE_X,
    sizeY: CRC_SIZE_Y,
    sizeC: CRC_CHANNEL_NAMES.length,
    omeXmlHash: "",
    basename: "CRC01-096-097.ome.tif",
    contentRole: "intensity",
    channels,
    source: { kind: "url", url: DEMO_CRC_OME_TIFF_URL },
  };

  const { stories: migrated, shapes } = migrateLegacyWaypointShapes(
    structuredClone(configWaypoints),
    [],
    CRC_SIZE_X,
    CRC_SIZE_Y,
  );

  const waypoints = migrated.map((story) => {
    const hydrated = hydrateConfigWaypoint(story, channelGroups);
    const normalized = normalizeWaypointToBounds(
      hydrated,
      CRC_SIZE_X,
      CRC_SIZE_Y,
      SEED_VIEWPORT_W,
      SEED_VIEWPORT_H,
    );
    const { waypoint } = configWaypointToWaypoint(
      normalized,
      CRC_SIZE_X,
      CRC_SIZE_Y,
      SEED_VIEWPORT_W,
      SEED_VIEWPORT_H,
    );
    return { ...waypoint, thumbnail: waypoint.thumbnail ?? "" };
  });

  return {
    metadata: {
      title: DEMO_SHELF_TITLE,
      imageSource: DEMO_CRC_OME_TIFF_URL,
    },
    waypoints,
    shapes,
    channelGroups,
    images: [image],
  };
}

/**
 * In `vite --mode demo`, ensure one shelf row exists with the full CRC demo document
 * (OME-TIFF URL, channel groups, waypoints) when the DB had none / an empty shell.
 */
export async function ensureDemoShelfStory(): Promise<void> {
  if (import.meta.env.MODE !== "demo") return;
  const existing = await getStoryRecord(DEMO_SHELF_STORY_ID);
  // Already hydrated with the remote OME-TIFF (or a prior full demo save).
  if (existing && existing.data.images.length > 0) return;

  const seed = buildDemoCrcDocumentData();
  if (!existing) {
    await saveStoryDocument(DEMO_SHELF_STORY_ID, seed);
    return;
  }

  // Upgrade an empty title-only shelf row without clobbering any user waypoints.
  await saveStoryDocument(DEMO_SHELF_STORY_ID, {
    ...seed,
    waypoints:
      existing.data.waypoints.length > 0
        ? existing.data.waypoints
        : seed.waypoints,
    shapes:
      existing.data.shapes.length > 0 ? existing.data.shapes : seed.shapes,
    metadata: {
      ...seed.metadata,
      ...existing.data.metadata,
      title: seed.metadata.title,
      imageSource: seed.metadata.imageSource,
    },
  });
}

/** Main / router props for demo modes; empty exhibit seed for normal `dev` / `build`. */
export function getDemoMainProps(): {
  demo_dicom_web: boolean;
  demo_jpeg: boolean;
  demo_url?: string;
  exhibit_config: ExhibitConfig;
  configWaypoints: LegacyExhibitWaypoint[];
} {
  const jpeg = isJpegDemoMode();
  const enabled = isDemoContentEnabled();
  return {
    demo_dicom_web: false,
    demo_jpeg: jpeg,
    demo_url: enabled
      ? jpeg
        ? DEMO_JPEG_URL
        : DEMO_CRC_OME_TIFF_URL
      : undefined,
    exhibit_config: enabled
      ? jpeg
        ? jpeg_exhibit_config
        : exhibit_config
      : EMPTY_EXHIBIT_CONFIG,
    configWaypoints: enabled && !jpeg ? configWaypoints : [],
  };
}
