import { isStackVisible } from "@/lib/imaging/channelCompositor";
import {
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isMaskChannel,
  isRgbDisplayChannel,
} from "@/lib/imaging/channelKind";
import {
  hexToRgb,
  IMPORT_DEFAULT_SEED_HEX,
  type RgbColor,
  seedDefaultSourceChannelStyles,
} from "@/lib/imaging/sourceChannelStyle";
import { useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { applySourceChannelsToImages } from "@/lib/stores/storeUtils";

/** OKLab L bounds × 100 (psudo 0.15+ / palette study default). */
const DEFAULT_LUMINANCE = new Uint16Array([60, 92]);

/**
 * psudo README / npm tests: `false` = optimize C3 color-name distance + OKLab
 * perceptual separation only (no spatial channel overlap).
 */
export const PSUDO_INCLUDE_SPATIAL_CHANNEL_OVERLAP = false;
export const PSUDO_MAX_ITERS = 2700;
export const PSUDO_CONFUSION_BASELINE_SAMPLES = 32;
/** Matches psudo 0.15+ / palette_study (× n/3, max 40 inside WASM). */
export const PSUDO_NUM_RESTARTS = 18;

const PSUDO_CONTRAST_MIN = 0;
const PSUDO_CONTRAST_MAX = 65535;

const IMPORT_GROUP_SLOT_COUNT = DEFAULT_VISIBLE_INTENSITY_CHANNELS;

export type PaletteSlot = { id: string; color: RgbColor };

export type PsudoOptimizeInputs = {
  colors: Uint16Array;
  locked: Uint16Array;
  /** Column-major intensities, or empty when `spatial` is false (color-only path). */
  intensities: Uint16Array;
  contrastLimits: Uint16Array;
  luminance: Uint16Array;
  excluded: string[];
  /** Per-channel C3 hints; use empty strings for name-free optimization. */
  colorNames: string[];
  maxIters: number;
  confusionSamples: number;
  spatial: boolean;
  numRestarts: number;
};

function clampUint16(n: number): number {
  return Math.max(0, Math.min(65535, Math.round(n)));
}

function asRgbColor(color: { r?: number; g?: number; b?: number }): RgbColor {
  return { r: color.r ?? 0, g: color.g ?? 0, b: color.b ?? 0 };
}

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

export function buildOptimizeInputsFromSlots(
  slots: readonly PaletteSlot[],
  lockedIds?: ReadonlySet<string>,
): PsudoOptimizeInputs {
  const n = slots.length;
  const colors = new Uint16Array(n * 3);
  const locked = new Uint16Array(n);

  for (let i = 0; i < n; i++) {
    const slot = slots[i];
    const { r, g, b } = slot.color;
    colors[i * 3] = clampUint16(r);
    colors[i * 3 + 1] = clampUint16(g);
    colors[i * 3 + 2] = clampUint16(b);
    locked[i] = lockedIds?.has(slot.id) ? 1 : 0;
  }

  return {
    colors,
    locked,
    intensities: colorOnlyIntensities(),
    contrastLimits: defaultContrastLimits(n),
    luminance: DEFAULT_LUMINANCE,
    excluded: [],
    colorNames: Array.from({ length: n }, () => ""),
    maxIters: PSUDO_MAX_ITERS,
    confusionSamples: PSUDO_CONFUSION_BASELINE_SAMPLES,
    spatial: PSUDO_INCLUDE_SPATIAL_CHANNEL_OVERLAP,
    numRestarts: PSUDO_NUM_RESTARTS,
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

export function warmupPsudoPalette(): Promise<boolean[]> {
  if (!psudoWarmupPromise) {
    psudoWarmupPromise = import("psudo").then(async (m) => {
      const t0 = performance.now();
      const result = await m.warmup();
      console.log("[psudo] warmup", {
        ms: Math.round(performance.now() - t0),
      });
      return result;
    });
  }
  return psudoWarmupPromise;
}

/**
 * Invoke `psudo.optimize`. Argument order matches `psudo` package `index.d.ts`:
 * colors, locked_colors, intensities, contrast_limits, luminance_values,
 * excluded_colors, color_names, max_iters?, confusion_baseline_samples?,
 * include_spatial_channel_overlap?, num_restarts?
 * (color-only path: empty intensities, `include_spatial_channel_overlap: false`).
 */
async function invokePsudoOptimize(
  inputs: PsudoOptimizeInputs,
): Promise<Float32Array> {
  const psudo = await import("psudo");
  await warmupPsudoPalette();
  let locked = 0;
  for (let i = 0; i < inputs.locked.length; i++) {
    if (inputs.locked[i]) locked++;
  }
  const meta = {
    channels: inputs.colorNames.length,
    locked,
    spatial: inputs.spatial,
    maxIters: inputs.maxIters,
    numRestarts: inputs.numRestarts,
  };
  console.log("[psudo] optimize start", meta);
  const t0 = performance.now();
  try {
    const optimized = await psudo.optimize(
      inputs.colors,
      inputs.locked,
      inputs.intensities,
      inputs.contrastLimits,
      inputs.luminance,
      inputs.excluded,
      inputs.colorNames,
      inputs.maxIters,
      inputs.confusionSamples,
      inputs.spatial,
      inputs.numRestarts,
    );
    console.log("[psudo] optimize done", {
      ...meta,
      ms: Math.round(performance.now() - t0),
    });
    return optimized instanceof Float32Array
      ? optimized
      : new Float32Array(optimized as ArrayLike<number>);
  } catch (e) {
    console.warn("[psudo] optimize failed", {
      ...meta,
      ms: Math.round(performance.now() - t0),
      error: e,
    });
    throw e;
  }
}

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

export async function optimizePaletteSlots(
  slots: readonly PaletteSlot[],
  lockedIds: ReadonlySet<string> = new Set(),
): Promise<RgbColor[]> {
  if (slots.length < 2) {
    throw new Error(
      "At least two channels are required to optimize a palette.",
    );
  }
  if (slots.every((slot) => lockedIds.has(slot.id))) {
    return slots.map((slot) => ({ ...slot.color }));
  }
  return optimizeGroupPalette(buildOptimizeInputsFromSlots(slots, lockedIds));
}

export function isGroupEligibleForPsudoOptimize(
  group: ChannelGroup,
  sourceChannels: Channel[],
): boolean {
  let imageChannelCount = 0;
  for (const gc of group.channels ?? []) {
    const sc = findSourceChannel(sourceChannels, gc.channelId);
    if (!sc || sc.samples === 3 || !isImageChannel(sc)) continue;
    imageChannelCount++;
  }
  return imageChannelCount >= 2;
}

export function lockedRowIdsForGroup(group: ChannelGroup): Set<string> {
  return new Set((group.channels ?? []).map((gc) => gc.id));
}

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

export async function optimizeChannelGroupWithLocks(
  group: ChannelGroup,
  sourceChannels: Channel[],
  lockedChannelRowIds: ReadonlySet<string> = new Set(),
): Promise<RgbColor[]> {
  if (!isGroupEligibleForPsudoOptimize(group, sourceChannels)) {
    return currentGroupColors(group);
  }
  const slots: PaletteSlot[] = (group.channels ?? []).map((gc) => ({
    id: gc.id,
    color: asRgbColor(gc.color),
  }));
  if (!slots.some((slot) => !lockedChannelRowIds.has(slot.id))) {
    return currentGroupColors(group);
  }
  return optimizePaletteSlots(slots, lockedChannelRowIds);
}

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

export function usesDefaultFourChannelGrouping(
  channelGroups: ChannelGroup[],
): boolean {
  if (channelGroups.length === 0) return false;
  return channelGroups.every(
    (g) =>
      /^Group \d+$/.test(g.name) &&
      g.channels.length >= 1 &&
      g.channels.length <= IMPORT_GROUP_SLOT_COUNT,
  );
}

function importPaletteSourceChannels(sourceChannels: Channel[]): Channel[] {
  if (sourceChannels.length === 0) return [];
  const firstImageId = sourceChannels[0].imageId;
  const fromFirst = sourceChannels.filter(
    (sc) =>
      sc.imageId === firstImageId &&
      sc.samples !== 3 &&
      isImageChannel(sc) &&
      !isRgbDisplayChannel(sc, sourceChannels),
  );
  const pool =
    fromFirst.length > 0
      ? fromFirst
      : sourceChannels.filter(
          (sc) =>
            sc.samples !== 3 &&
            isImageChannel(sc) &&
            !isRgbDisplayChannel(sc, sourceChannels),
        );
  return pool.slice(0, IMPORT_GROUP_SLOT_COUNT);
}

function seedPaletteForPicked(count: number): RgbColor[] {
  return Array.from({ length: count }, (_, i) =>
    seedRgbForGroupChannelIndex(i),
  );
}

function startingColorAwayFromLocked(
  lockedColors: readonly RgbColor[],
): RgbColor {
  const candidates: RgbColor[] = [
    ...IMPORT_DEFAULT_SEED_HEX.map((hex) => hexToRgb(hex)),
    { r: 255, g: 255, b: 255 },
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 255, b: 0 },
  ];
  return (
    candidates.find(
      (c) =>
        !lockedColors.some(
          (locked) => locked.r === c.r && locked.g === c.g && locked.b === c.b,
        ),
    ) ?? { r: 255, g: 255, b: 255 }
  );
}

export async function optimizeImportPaletteFour(
  sourceChannels: Channel[],
): Promise<RgbColor[]> {
  const seeds = seedPaletteForPicked(IMPORT_GROUP_SLOT_COUNT);
  const picked = importPaletteSourceChannels(sourceChannels);
  if (picked.length < 2) return seeds;

  const n = Math.min(IMPORT_GROUP_SLOT_COUNT, picked.length);
  const slots = picked.slice(0, n).map((sc, i) => ({
    id: sc.id,
    color: seeds[i] ?? seeds[0],
  }));
  const optimized = await optimizePaletteSlots(slots, new Set());
  return seeds.map((fallback, i) => optimized[i] ?? fallback);
}

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

export async function applySharedImportPaletteToSourceChannels(
  sourceChannels: Channel[],
): Promise<Channel[]> {
  const picked = importPaletteSourceChannels(sourceChannels);
  const seeds = seedPaletteForPicked(picked.length);
  const t0 = performance.now();
  console.log("[psudo] import palette start", { channels: picked.length });
  try {
    const palette =
      picked.length < 2
        ? seeds
        : await optimizePaletteSlots(
            picked.map((sc, i) => ({
              id: sc.id,
              color: seeds[i] ?? seeds[0],
            })),
            new Set(),
          );
    console.log("[psudo] import palette done", {
      ms: Math.round(performance.now() - t0),
      channels: picked.length,
      optimized: picked.length >= 2,
    });
    return seedDefaultSourceChannelStyles(sourceChannels, palette);
  } catch (e) {
    console.warn("[psudo] import palette failed", {
      ms: Math.round(performance.now() - t0),
      channels: picked.length,
      error: e,
    });
    return seedDefaultSourceChannelStyles(sourceChannels, seeds);
  }
}

function stackPaletteParticipants(
  sourceChannels: Channel[],
  stackVisibilities: Record<string, boolean>,
): Channel[] {
  return sourceChannels.filter((sc) => {
    if (!isImageChannel(sc) || sc.samples === 3) return false;
    if (isMaskChannel(sc) || isRgbDisplayChannel(sc, sourceChannels)) {
      return false;
    }
    return isStackVisible(stackVisibilities, sc.id);
  });
}

let stackPaletteChain: Promise<void> = Promise.resolve();
const stackPalettePending = new Set<string>();
let stackPalettePendingSnapshot: readonly string[] = [];
const stackPalettePendingListeners = new Set<() => void>();

function setStackPalettePending(sourceChannelId: string, pending: boolean) {
  setStackPalettePendingMany([sourceChannelId], pending);
}

export function setStackPalettePendingMany(
  sourceChannelIds: readonly string[],
  pending: boolean,
): void {
  if (sourceChannelIds.length === 0) return;
  let changed = false;
  for (const id of sourceChannelIds) {
    if (pending) {
      if (stackPalettePending.has(id)) continue;
      stackPalettePending.add(id);
      changed = true;
    } else if (stackPalettePending.delete(id)) {
      changed = true;
    }
  }
  if (!changed) return;
  stackPalettePendingSnapshot = [...stackPalettePending];
  for (const listener of stackPalettePendingListeners) listener();
}

export function subscribeStackPalettePending(
  onStoreChange: () => void,
): () => void {
  stackPalettePendingListeners.add(onStoreChange);
  return () => {
    stackPalettePendingListeners.delete(onStoreChange);
  };
}

export function getStackPalettePendingIds(): readonly string[] {
  return stackPalettePendingSnapshot;
}

function markStackPalettePendingIfNeeded(sourceChannelId: string): boolean {
  const doc = useDocumentStore.getState();
  if (doc.channelGroups.length > 0) return false;
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const shown = sourceChannels.find((sc) => sc.id === sourceChannelId);
  if (
    !shown ||
    !isImageChannel(shown) ||
    shown.samples === 3 ||
    isMaskChannel(shown) ||
    isRgbDisplayChannel(shown, sourceChannels)
  ) {
    return false;
  }
  if (shown.color) return false;
  setStackPalettePending(shown.id, true);
  return true;
}

export function ensurePaletteForNewlyVisibleStackChannels(args: {
  sourceChannelId: string;
}): Promise<void> {
  const pending = markStackPalettePendingIfNeeded(args.sourceChannelId);
  const run = stackPaletteChain.then(async () => {
    try {
      await runEnsureStackPalette(args);
    } finally {
      if (pending) setStackPalettePending(args.sourceChannelId, false);
    }
  });
  stackPaletteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function runEnsureStackPalette(args: {
  sourceChannelId: string;
}): Promise<void> {
  const doc = useDocumentStore.getState();
  if (doc.channelGroups.length > 0) return;

  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const shown = sourceChannels.find((sc) => sc.id === args.sourceChannelId);
  if (
    !shown ||
    !isImageChannel(shown) ||
    shown.samples === 3 ||
    isMaskChannel(shown) ||
    isRgbDisplayChannel(shown, sourceChannels) ||
    shown.color
  ) {
    return;
  }

  const vis = useAppStore.getState().channelVisibilities;
  const participants = stackPaletteParticipants(
    flattenImageChannelsInDocumentOrder(useDocumentStore.getState().images),
    vis,
  );
  const unlocked = participants.filter((sc) => !sc.color);
  if (unlocked.length === 0) return;

  const lockedIds = new Set(
    participants.filter((sc) => sc.color).map((sc) => sc.id),
  );
  const lockedColors = participants
    .filter((sc) => lockedIds.has(sc.id) && sc.color)
    .map((sc) => asRgbColor(sc.color as RgbColor));
  const unlockedStart = startingColorAwayFromLocked(lockedColors);
  const slots: PaletteSlot[] = participants.map((sc) => ({
    id: sc.id,
    color: lockedIds.has(sc.id)
      ? asRgbColor(sc.color as RgbColor)
      : unlockedStart,
  }));

  let colors: RgbColor[];
  try {
    colors =
      slots.length < 2
        ? slots.map((slot) => slot.color)
        : await optimizePaletteSlots(slots, lockedIds);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[psudo] stack palette optimization failed", e);
    }
    return;
  }

  const docNow = useDocumentStore.getState();
  if (docNow.channelGroups.length > 0) return;
  const sourcesNow = flattenImageChannelsInDocumentOrder(docNow.images);
  const unlockedIds = new Set(unlocked.map((sc) => sc.id));
  const indexById = new Map(participants.map((sc, i) => [sc.id, i] as const));

  let changed = false;
  const next = sourcesNow.map((sc) => {
    if (!unlockedIds.has(sc.id) || sc.color) return sc;
    const idx = indexById.get(sc.id);
    if (idx == null) return sc;
    const c = colors[idx];
    if (!c) return sc;
    changed = true;
    return { ...sc, color: { r: c.r, g: c.g, b: c.b } };
  });
  if (!changed) return;
  docNow.setImages(applySourceChannelsToImages(docNow.images, next));
}
