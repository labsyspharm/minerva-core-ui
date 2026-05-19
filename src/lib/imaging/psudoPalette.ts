import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { findSourceChannel } from "@/lib/stores/documentStore";

/** OKLab L bounds × 100 (psudo default). */
const DEFAULT_LUMINANCE = new Uint16Array([45, 92]);

/** C3 names to avoid in optimized palettes. */
const DEFAULT_EXCLUDED_COLORS = [
  "grey",
  "white",
  "lightgrey",
  "darkgrey",
  "offwhite",
] as const;

/**
 * psudo README / npm tests: `false` = optimize C3 color-name distance + OKLab
 * perceptual separation only (no spatial channel overlap).
 */
export const PSUDO_INCLUDE_SPATIAL_CHANNEL_OVERLAP = false;
export const PSUDO_MAX_ITERS = 3000;
export const PSUDO_CONFUSION_BASELINE_SAMPLES = 32; // only matters if spatial on
export const PSUDO_NUM_RESTARTS = 6;
/** Passed to `psudo.optimize` (color-only path; lower = faster). */

/** Per-channel contrast passed to psudo (full uint16 range; matches palette study / README). */
const PSUDO_CONTRAST_MIN = 0;
const PSUDO_CONTRAST_MAX = 65535;

/** Channels per group from `extractChannels` default import path. */
export const IMPORT_GROUP_CHANNEL_COUNT = 4;

/** Default hex seeds from `extractChannels` (before psudo). */
const IMPORT_DEFAULT_SEED_HEX = [
  "0dabff",
  "c3ff00",
  "ff8b00",
  "ff00c7",
] as const;

export const IMPORT_DEFAULT_LOWER_LIMIT = 2 ** 5;
export const IMPORT_DEFAULT_UPPER_LIMIT = 2 ** 14;

export type RgbColor = { r: number; g: number; b: number };

export type PsudoOptimizeInputs = {
  colors: Uint16Array;
  locked: Uint16Array;
  intensities: Uint16Array;
  contrastLimits: Uint16Array;
  luminance: Uint16Array;
  excluded: string[];
  colorNames: string[];
};

function clampUint16(n: number): number {
  return Math.max(0, Math.min(65535, Math.round(n)));
}

/** No intensity pixels — valid when `PSUDO_INCLUDE_SPATIAL_CHANNEL_OVERLAP` is false. */
function colorOnlyIntensities(): Uint16Array {
  return new Uint16Array(0);
}

function defaultContrastLimits(nChannels: number): Uint16Array {
  const out = new Uint16Array(nChannels * 2);
  for (let i = 0; i < nChannels; i++) {
    out[i * 2] = PSUDO_CONTRAST_MIN;
    out[i * 2 + 1] = PSUDO_CONTRAST_MAX;
  }
  return out;
}

function colorNameHint(sourceChannels: Channel[], channelId: string): string {
  const sc = findSourceChannel(sourceChannels, channelId);
  const name = sc?.name?.trim() ?? "";
  return name;
}

/**
 * Build WASM inputs for `psudo.optimize` from a channel group and source channels.
 * Color-only path: empty intensities, full-range contrast limits (document limits are
 * for rendering only).
 */
export function buildOptimizeInputs(
  group: ChannelGroup,
  sourceChannels: Channel[],
  options?: { lockedChannelRowIds?: ReadonlySet<string> },
): PsudoOptimizeInputs {
  const rows = group.channels ?? [];
  const n = rows.length;
  const colors = new Uint16Array(n * 3);
  const locked = new Uint16Array(n);
  const colorNames: string[] = [];

  for (let i = 0; i < n; i++) {
    const gc = rows[i];
    const { r, g, b } = gc.color;
    colors[i * 3] = clampUint16(r);
    colors[i * 3 + 1] = clampUint16(g);
    colors[i * 3 + 2] = clampUint16(b);
    locked[i] = options?.lockedChannelRowIds?.has(gc.id) ? 1 : 0;
    colorNames.push(colorNameHint(sourceChannels, gc.channelId));
  }

  return {
    colors,
    locked,
    intensities: colorOnlyIntensities(),
    contrastLimits: defaultContrastLimits(n),
    luminance: DEFAULT_LUMINANCE,
    excluded: [...DEFAULT_EXCLUDED_COLORS],
    colorNames,
  };
}

function linearToDisplayRgb(
  linear: Float32Array,
  channelIndex: number,
): RgbColor {
  const i = channelIndex * 3;
  return {
    r: Math.max(0, Math.min(255, Math.round(linear[i] * 255))),
    g: Math.max(0, Math.min(255, Math.round(linear[i + 1] * 255))),
    b: Math.max(0, Math.min(255, Math.round(linear[i + 2] * 255))),
  };
}

let psudoWarmupPromise: Promise<boolean[]> | null = null;

/**
 * Preload psudo WASM in the worker pool (psudo 0.4+; one boolean per worker).
 * Safe to call multiple times; deduped until the first call settles.
 */
export function warmupPsudoPalette(): Promise<boolean[]> {
  if (!psudoWarmupPromise) {
    psudoWarmupPromise = import("psudo").then((m) => m.warmup());
  }
  return psudoWarmupPromise;
}

/**
 * Invoke `psudo.optimize` with the same argument pattern as the package README /
 * color-only tests (`include_spatial_channel_overlap: false`, no intensity data).
 */
async function invokePsudoOptimize(
  inputs: PsudoOptimizeInputs,
): Promise<Float32Array> {
  const psudo = await import("psudo");
  await warmupPsudoPalette();
  const optimized = await psudo.optimize(
    inputs.colors,
    inputs.locked,
    inputs.intensities,
    inputs.contrastLimits,
    inputs.luminance,
    inputs.excluded,
    inputs.colorNames,
    PSUDO_MAX_ITERS,
    PSUDO_CONFUSION_BASELINE_SAMPLES,
    PSUDO_INCLUDE_SPATIAL_CHANNEL_OVERLAP,
    PSUDO_NUM_RESTARTS,
  );
  return optimized instanceof Float32Array
    ? optimized
    : new Float32Array(optimized as ArrayLike<number>);
}

/**
 * Run psudo palette optimization (name + perceptual, no spatial overlap) in a Web Worker.
 */
export async function optimizeGroupPalette(
  inputs: PsudoOptimizeInputs,
): Promise<RgbColor[]> {
  const nChannels = inputs.colorNames.length;
  if (nChannels < 2) {
    throw new Error(
      "At least two channels are required to optimize a palette.",
    );
  }

  const linear = await invokePsudoOptimize(inputs);

  const out: RgbColor[] = [];
  for (let ch = 0; ch < nChannels; ch++) {
    if (inputs.locked[ch] === 1) {
      const i = ch * 3;
      out.push({
        r: inputs.colors[i],
        g: inputs.colors[i + 1],
        b: inputs.colors[i + 2],
      });
    } else {
      out.push(linearToDisplayRgb(linear, ch));
    }
  }
  return out;
}

/** True when the group is not suitable for pseudocolor optimization (e.g. RGB / H&E). */
export function isGroupEligibleForPsudoOptimize(
  group: ChannelGroup,
  sourceChannels: Channel[],
): boolean {
  const rows = group.channels ?? [];
  if (rows.length < 2) return false;
  for (const gc of rows) {
    const sc = findSourceChannel(sourceChannels, gc.channelId);
    if (sc?.samples === 3) return false;
  }
  return true;
}

/** Row ids for every channel slot in a group (used to lock existing colors on add). */
export function lockedRowIdsForGroup(group: ChannelGroup): Set<string> {
  return new Set((group.channels ?? []).map((gc) => gc.id));
}

/** Default import seed color for a channel index within a group. */
export function seedRgbForGroupChannelIndex(index: number): RgbColor {
  return hexToRgb(
    IMPORT_DEFAULT_SEED_HEX[index % IMPORT_DEFAULT_SEED_HEX.length],
  );
}

function currentGroupColors(group: ChannelGroup): RgbColor[] {
  return (group.channels ?? []).map((gc) => ({
    r: gc.color.r,
    g: gc.color.g,
    b: gc.color.b,
  }));
}

function hasUnlockedRows(
  group: ChannelGroup,
  lockedChannelRowIds: ReadonlySet<string>,
): boolean {
  return (group.channels ?? []).some((gc) => !lockedChannelRowIds.has(gc.id));
}

/**
 * Optimize a group palette with optional per-row locks.
 * Returns current colors unchanged when ineligible or all rows are locked.
 */
export async function optimizeChannelGroupWithLocks(
  group: ChannelGroup,
  sourceChannels: Channel[],
  lockedChannelRowIds: ReadonlySet<string> = new Set(),
): Promise<RgbColor[]> {
  if (!isGroupEligibleForPsudoOptimize(group, sourceChannels)) {
    return currentGroupColors(group);
  }
  if (!hasUnlockedRows(group, lockedChannelRowIds)) {
    return currentGroupColors(group);
  }
  const inputs = buildOptimizeInputs(group, sourceChannels, {
    lockedChannelRowIds,
  });
  return optimizeGroupPalette(inputs);
}

/** Apply optimized RGB values to one channel group; other groups unchanged. */
export function applyOptimizedColorsToChannelGroup(
  channelGroups: ChannelGroup[],
  groupId: string,
  colors: RgbColor[],
  options?: { lockedChannelRowIds?: ReadonlySet<string> },
): ChannelGroup[] {
  const locked = options?.lockedChannelRowIds;
  return channelGroups.map((g) => {
    if (g.id !== groupId) return g;
    const channels = g.channels.map((gc, i) => {
      if (locked?.has(gc.id)) return gc;
      const c = colors[i];
      if (!c) return gc;
      return { ...gc, color: { r: c.r, g: c.g, b: c.b } };
    });
    return { ...g, channels };
  });
}

function hexToRgb(hex: string): RgbColor {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

type ImportPaletteSlot = {
  name: string;
  seed: RgbColor;
};

function buildOptimizeInputsFromSlots(
  slots: readonly ImportPaletteSlot[],
): PsudoOptimizeInputs {
  const n = slots.length;
  const colors = new Uint16Array(n * 3);
  const locked = new Uint16Array(n);
  const colorNames: string[] = [];

  for (let i = 0; i < n; i++) {
    const slot = slots[i];
    colors[i * 3] = clampUint16(slot.seed.r);
    colors[i * 3 + 1] = clampUint16(slot.seed.g);
    colors[i * 3 + 2] = clampUint16(slot.seed.b);
    locked[i] = 0;
    colorNames.push(slot.name);
  }

  return {
    colors,
    locked,
    intensities: colorOnlyIntensities(),
    contrastLimits: defaultContrastLimits(n),
    luminance: DEFAULT_LUMINANCE,
    excluded: [...DEFAULT_EXCLUDED_COLORS],
    colorNames,
  };
}

/** Channel groups created by the default `Group N` / four-channels-per-group import path. */
export function usesDefaultFourChannelGrouping(
  channelGroups: ChannelGroup[],
): boolean {
  if (channelGroups.length === 0) return false;
  return channelGroups.every(
    (g) =>
      /^Group \d+$/.test(g.name) &&
      g.channels.length >= 1 &&
      g.channels.length <= IMPORT_GROUP_CHANNEL_COUNT,
  );
}

/** First four pseudocolor source channels on the first imported image (import palette seeds). */
function importPaletteSourceChannels(sourceChannels: Channel[]): Channel[] {
  if (sourceChannels.length === 0) return [];
  const firstImageId = sourceChannels[0].imageId;
  const fromFirst = sourceChannels.filter(
    (sc) => sc.imageId === firstImageId && sc.samples !== 3,
  );
  const pool =
    fromFirst.length > 0
      ? fromFirst
      : sourceChannels.filter((sc) => sc.samples !== 3);
  return pool.slice(0, IMPORT_GROUP_CHANNEL_COUNT);
}

/**
 * Run psudo once for four palette slots (non-spatial). Uses the first image's
 * channel names and default import contrast limits as seeds.
 */
export async function optimizeImportPaletteFour(
  sourceChannels: Channel[],
): Promise<RgbColor[]> {
  const picked = importPaletteSourceChannels(sourceChannels);
  if (picked.length < 2) {
    return IMPORT_DEFAULT_SEED_HEX.map((hex) => hexToRgb(hex));
  }

  const slots: ImportPaletteSlot[] = [];
  for (let i = 0; i < IMPORT_GROUP_CHANNEL_COUNT; i++) {
    const sc = picked[i];
    slots.push({
      name: sc?.name?.trim() ?? "",
      seed: hexToRgb(IMPORT_DEFAULT_SEED_HEX[i]),
    });
  }

  const optimized = await optimizeGroupPalette(
    buildOptimizeInputsFromSlots(slots),
  );
  const palette: RgbColor[] = [];
  for (let i = 0; i < IMPORT_GROUP_CHANNEL_COUNT; i++) {
    palette.push(optimized[i] ?? slots[i].seed);
  }
  return palette;
}

/** Apply a fixed four-color palette to each default import group (index mod 4). */
export function applyFourColorPaletteToChannelGroups(
  channelGroups: ChannelGroup[],
  palette: readonly RgbColor[],
  sourceChannels: Channel[],
): ChannelGroup[] {
  if (palette.length === 0) return channelGroups;
  return channelGroups.map((g) => {
    if (!/^Group \d+$/.test(g.name)) return g;
    const channels = g.channels.map((gc, index) => {
      const sc = findSourceChannel(sourceChannels, gc.channelId);
      if (sc?.samples === 3) return gc;
      const c = palette[index % palette.length];
      return { ...gc, color: { r: c.r, g: c.g, b: c.b } };
    });
    return { ...g, channels };
  });
}

/**
 * On image import: one psudo optimization, then the same four colors on every
 * auto-created `Group N` (skips demo CRC / H&E paths).
 */
export async function applySharedImportPaletteToChannelGroups(
  channelGroups: ChannelGroup[],
  sourceChannels: Channel[],
): Promise<ChannelGroup[]> {
  if (!usesDefaultFourChannelGrouping(channelGroups)) {
    return channelGroups;
  }
  try {
    const palette = await optimizeImportPaletteFour(sourceChannels);
    return applyFourColorPaletteToChannelGroups(
      channelGroups,
      palette,
      sourceChannels,
    );
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[psudo] import palette optimization failed", e);
    }
    return channelGroups;
  }
}
