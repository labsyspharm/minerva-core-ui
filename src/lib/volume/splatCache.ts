import type {
  ChannelGroup,
  Image,
  View3d,
  VolumeSplats,
} from "@/lib/stores/documentSchema";
import { loadKiln } from "./imsVolume";
import { DEFAULT_DENSITY, interpolateView3d, isClipped } from "./view3d";
import type { ChannelSplats } from "./volumeViewerBridge";

/**
 * What a splat cloud reproduces: one channel group in one render mode.
 * Volume rendering also depends on density; MIP and Surface do not.
 */
export type SplatLook = {
  groupId: string;
  renderMode: View3d["renderMode"];
  density: number;
};

/** Densities equal to 3 significant digits give the same look. */
function roundDensity(density: number): number {
  return Number(density.toPrecision(3));
}

/** Identity of a look (density only matters in volume rendering). */
export function splatKey(look: SplatLook): string {
  const density = look.renderMode === "dvr" ? roundDensity(look.density) : "";
  return `${look.groupId}|${look.renderMode}|${density}`;
}

type StoryWaypoint = { groupId?: string; view3d?: View3d };
type Orbit = View3d["camera"];

/** The look a waypoint shows; waypoints without a group use `fallback`. */
function lookOf(
  wp: StoryWaypoint,
  groups: ChannelGroup[],
  fallback: ChannelGroup | undefined,
): { group: ChannelGroup; look: SplatLook } | null {
  const group = groups.find((g) => g.id === wp.groupId) ?? fallback;
  if (!group) return null;
  return {
    group,
    look: {
      groupId: group.id,
      renderMode: wp.view3d?.renderMode ?? "dvr",
      density: wp.view3d?.density ?? DEFAULT_DENSITY,
    },
  };
}

/**
 * Looks to train splats for, in story order: each distinct channel group ×
 * render mode (× density for volume rendering) the waypoints show. Waypoints
 * without a group use the active (or first) group; with no waypoints at all,
 * that group in volume rendering. Clipped waypoints show the live volume
 * (splats can't reproduce a clip), so they add no look.
 */
export function looksToTrain(
  groups: ChannelGroup[],
  waypoints: StoryWaypoint[],
  activeGroupId: string | null,
): { group: ChannelGroup; look: SplatLook }[] {
  const fallback = groups.find((g) => g.id === activeGroupId) ?? groups[0];
  const out = new Map<string, { group: ChannelGroup; look: SplatLook }>();
  for (const wp of waypoints) {
    if (wp.view3d && isClipped(wp.view3d)) continue;
    const entry = lookOf(wp, groups, fallback);
    if (!entry) continue;
    const key = splatKey(entry.look);
    if (!out.has(key)) out.set(key, entry);
  }
  if (waypoints.length === 0 && fallback) {
    const look: SplatLook = {
      groupId: fallback.id,
      renderMode: "dvr",
      density: DEFAULT_DENSITY,
    };
    out.set(splatKey(look), { group: fallback, look });
  }
  return [...out.values()];
}

/** A waypoint camera turned `yawDeg`/`pitchDeg` around its target and zoomed. */
function nudge(
  camera: Orbit,
  yawDeg: number,
  pitchDeg: number,
  zoom: number,
): Orbit {
  const [rx, ry, dist, tx, ty, tz] = camera;
  const limit = Math.PI / 2 - 0.02;
  const pitch = Math.max(
    -limit,
    Math.min(limit, rx + (pitchDeg * Math.PI) / 180),
  );
  return [pitch, ry + (yawDeg * Math.PI) / 180, dist * zoom, tx, ty, tz];
}

/**
 * Cameras the story shows `look` from, to train its splats on alongside
 * kiln's spread-out views: the look's waypoint views, the flights to and from
 * them, those views nudged a little (viewers drag) and more of the flights —
 * most important first, at most `max`. `evaluate`: views near the waypoints
 * that training doesn't see, to score the splats where the story looks.
 */
export function storyCameras(
  look: SplatLook,
  groups: ChannelGroup[],
  waypoints: StoryWaypoint[],
  activeGroupId: string | null,
  max: number,
): { train: Orbit[]; evaluate: Orbit[] } {
  const fallback = groups.find((g) => g.id === activeGroupId) ?? groups[0];
  const key = splatKey(look);
  // Clipped waypoints show the live volume; flights through them too.
  const views = waypoints.map((wp) =>
    wp.view3d && !isClipped(wp.view3d) ? wp.view3d : null,
  );
  const ofLook = waypoints.map((wp, i) => {
    const entry = views[i] ? lookOf(wp, groups, fallback) : null;
    return !!entry && splatKey(entry.look) === key;
  });
  const own = views.filter((v, i): v is View3d => v !== null && !!ofLook[i]);
  const flights: [View3d, View3d][] = [];
  for (let i = 0; i + 1 < views.length; i++) {
    const a = views[i];
    const b = views[i + 1];
    if (a && b && (ofLook[i] || ofLook[i + 1])) flights.push([a, b]);
  }
  const along = (t: number) =>
    flights.map(([a, b]) => interpolateView3d(a, b, t).camera);
  const train = [
    ...own.map((v) => v.camera),
    ...along(0.5),
    ...own.flatMap(({ camera: c }) => [
      nudge(c, 10, 0, 1),
      nudge(c, -10, 0, 1),
      nudge(c, 0, 10, 1),
      nudge(c, 0, -10, 1),
      nudge(c, 0, 0, 0.85),
      nudge(c, 0, 0, 1.15),
    ]),
    ...along(0.25),
    ...along(0.75),
  ].slice(0, Math.max(0, max));
  const evaluate = own.slice(0, 4).map((v) => nudge(v.camera, 5, 5, 1.07));
  return { train, evaluate };
}

/**
 * File name for a look's PLY inside the story's `splats/` folder; per-channel
 * files add the channel's index in the image.
 */
export function splatFileName(look: SplatLook, channelIndex?: number): string {
  const density =
    look.renderMode === "dvr"
      ? `-d${String(roundDensity(look.density)).replace(".", "_")}`
      : "";
  const channel = channelIndex === undefined ? "" : `-c${channelIndex}`;
  return `${look.groupId}-${look.renderMode}${density}${channel}.ply`;
}

/**
 * Clouds trained by the latest story export, by {@link splatKey}: authoring
 * shows them (its document holds no splat entries).
 */
const trained = new Map<string, ChannelSplats[]>();
/** PLY files fetched by the player, by resolved URL. */
const fetched = new Map<string, Promise<ChannelSplats["cloud"]>>();

let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  for (const fn of listeners) fn();
}

export function rememberTrainedSplats(
  look: SplatLook,
  channels: ChannelSplats[],
) {
  trained.set(splatKey(look), channels);
  notify();
}

/** A new export replaces the previous one's clouds. */
export function forgetTrainedSplats() {
  if (trained.size === 0) return;
  trained.clear();
  notify();
}

/** For `useSyncExternalStore`: bumps when the trained clouds change. */
export function subscribeSplats(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function splatsVersion(): number {
  return version;
}

/**
 * Splat entries recorded in the document for `look`: one per channel, or one
 * for the whole group.
 */
export function documentSplatsFor(
  image: Image,
  look: SplatLook | null,
): VolumeSplats[] {
  if (image.source?.kind !== "volume" || !look) return [];
  const key = splatKey(look);
  // Volume-rendering entries always record their density.
  return (
    image.source.splats?.filter(
      ({ groupId, renderMode, density = 0 }) =>
        splatKey({ groupId, renderMode, density }) === key,
    ) ?? []
  );
}

/** True when splats exist for the look (trained now or in the document). */
export function hasSplatsFor(image: Image, look: SplatLook | null): boolean {
  return (
    (!!look && trained.has(splatKey(look))) ||
    documentSplatsFor(image, look).length > 0
  );
}

/**
 * The look's clouds: trained this session, else the document's PLYs
 * (`url` resolved against `documentUrl`). Null when there are none.
 */
export async function splatCloudsFor(
  image: Image,
  look: SplatLook | null,
  documentUrl: string,
): Promise<ChannelSplats[] | null> {
  if (!look) return null;
  const local = trained.get(splatKey(look));
  if (local) return local;
  const entries = documentSplatsFor(image, look);
  if (entries.length === 0) return null;
  return Promise.all(
    entries.map(async (entry) => ({
      channelId: entry.channelId ?? null,
      cloud: await fetchPly(new URL(entry.url, documentUrl).href, entry.url),
    })),
  );
}

function fetchPly(url: string, label: string): Promise<ChannelSplats["cloud"]> {
  let p = fetched.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Splats ${label}: HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const { readPly } = await loadKiln();
      return readPly(bytes);
    })();
    p.catch(() => fetched.delete(url));
    fetched.set(url, p);
  }
  return p;
}
