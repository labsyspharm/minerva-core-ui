import {
  buildCompositedIntensityLayers,
  isStackVisible,
  sourceChannelInAnyGroup,
} from "@/lib/imaging/channelCompositor";
import {
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isRgbDisplayChannel,
} from "@/lib/imaging/channelKind";
import {
  hexToRgb,
  IMPORT_DEFAULT_SEED_HEX,
  looksLikeImportDefaultSeedColor,
  type RgbColor,
  rgbToHex,
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
const PSUDO_INCLUDE_SPATIAL_CHANNEL_OVERLAP = false;
const PSUDO_MAX_ITERS = 2700;
const PSUDO_CONFUSION_BASELINE_SAMPLES = 32;
/** Matches psudo 0.15+ / palette_study (× n/3, max 40 inside WASM). */
const PSUDO_NUM_RESTARTS = 18;

const PSUDO_CONTRAST_MIN = 0;
const PSUDO_CONTRAST_MAX = 65535;

type PaletteSlot = { id: string; color: RgbColor };

type PsudoOptimizeInputs = {
  colors: Uint16Array;
  locked: Uint16Array;
  /** Empty when spatial is off (color-only path). */
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

function defaultContrastLimits(nChannels: number): Uint16Array {
  const out = new Uint16Array(nChannels * 2);
  for (let i = 0; i < nChannels; i++) {
    out[i * 2] = PSUDO_CONTRAST_MIN;
    out[i * 2 + 1] = PSUDO_CONTRAST_MAX;
  }
  return out;
}

function buildOptimizeInputsFromSlots(
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
    intensities: new Uint16Array(0),
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
    psudoWarmupPromise = import("psudo").then((m) => m.warmup());
  }
  return psudoWarmupPromise;
}

/**
 * Invoke `psudo.optimize`. Argument order matches `psudo` package `index.d.ts`:
 * colors, locked_colors, intensities, contrast_limits, luminance_values,
 * excluded_colors, color_names, max_iters?, confusion_baseline_samples?,
 * include_spatial_channel_overlap?, num_restarts?
 * Color-only path: empty intensities, `include_spatial_channel_overlap: false`.
 */
async function invokePsudoOptimize(
  inputs: PsudoOptimizeInputs,
): Promise<Float32Array> {
  const psudo = await import("psudo");
  await warmupPsudoPalette();
  const n = inputs.colorNames.length;
  const t0 = performance.now();
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
  const linear =
    optimized instanceof Float32Array
      ? optimized
      : new Float32Array(optimized as ArrayLike<number>);
  if (import.meta.env.DEV) {
    const colors: string[] = [];
    for (let i = 0; i < n; i++) {
      colors.push(`#${rgbToHex(linearToDisplayRgb(linear, i))}`);
    }
    console.log("[psudo] optimize done", {
      ms: Math.round(performance.now() - t0),
      n,
      locked: [...inputs.locked].filter((v) => v === 1).length,
      spatial: inputs.spatial,
      colors,
    });
  }
  return linear;
}

async function optimizePaletteSlots(
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
  const inputs = buildOptimizeInputsFromSlots(slots, lockedIds);
  const nChannels = inputs.colorNames.length;
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

function usesDefaultImportGrouping(channelGroups: ChannelGroup[]): boolean {
  if (channelGroups.length === 0) return false;
  return channelGroups.every(
    (g) =>
      /^Group \d+$/.test(g.name) &&
      g.channels.length >= 1 &&
      g.channels.length <= DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  );
}

function isImportPaletteSource(sc: Channel, all: Channel[]): boolean {
  return (
    sc.samples !== 3 && isImageChannel(sc) && !isRgbDisplayChannel(sc, all)
  );
}

function importPaletteSourceChannels(sourceChannels: Channel[]): Channel[] {
  if (sourceChannels.length === 0) return [];
  const firstImageId = sourceChannels[0].imageId;
  const fromFirst = sourceChannels.filter(
    (sc) =>
      sc.imageId === firstImageId && isImportPaletteSource(sc, sourceChannels),
  );
  const pool =
    fromFirst.length > 0
      ? fromFirst
      : sourceChannels.filter((sc) =>
          isImportPaletteSource(sc, sourceChannels),
        );
  return pool.slice(0, DEFAULT_VISIBLE_INTENSITY_CHANNELS);
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

async function optimizeImportPalette(
  sourceChannels: Channel[],
): Promise<RgbColor[]> {
  const seeds = seedPaletteForPicked(DEFAULT_VISIBLE_INTENSITY_CHANNELS);
  const picked = importPaletteSourceChannels(sourceChannels);
  if (picked.length < 2) return seeds;

  const slots = picked.map((sc, i) => ({
    id: sc.id,
    color: seeds[i] ?? seeds[0],
  }));
  const optimized = await optimizePaletteSlots(slots, new Set());
  return seeds.map((fallback, i) => optimized[i] ?? fallback);
}

export async function applySharedImportPaletteToChannelGroups(
  channelGroups: ChannelGroup[],
  sourceChannels: Channel[],
): Promise<ChannelGroup[]> {
  if (!usesDefaultImportGrouping(channelGroups)) {
    return channelGroups;
  }
  try {
    const palette = await optimizeImportPalette(sourceChannels);
    return channelGroups.map((g) => ({
      ...g,
      channels: g.channels.map((gc, index) => {
        const sc = findSourceChannel(sourceChannels, gc.channelId);
        if (sc?.samples === 3) return gc;
        const c = palette[index % palette.length];
        return { ...gc, color: { r: c.r, g: c.g, b: c.b } };
      }),
    }));
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
  try {
    const palette = (await optimizeImportPalette(sourceChannels)).slice(
      0,
      picked.length,
    );
    return seedDefaultSourceChannelStyles(sourceChannels, palette);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[psudo] import palette failed", e);
    }
    return seedDefaultSourceChannelStyles(
      sourceChannels,
      seedPaletteForPicked(picked.length),
    );
  }
}

function needsInitPalette(
  picked: readonly Channel[],
  groups: readonly ChannelGroup[],
): boolean {
  if (picked.length < 2) return false;
  for (const sc of picked) {
    if (sc.color && !looksLikeImportDefaultSeedColor(sc.color)) return false;
  }
  const pickedIds = new Set(picked.map((sc) => sc.id));
  for (const g of groups) {
    for (const gc of g.channels) {
      if (!pickedIds.has(gc.channelId)) continue;
      if (!looksLikeImportDefaultSeedColor(gc.color)) return false;
    }
  }
  return true;
}

let initPaletteKey: string | null = null;
let initPaletteInFlight: string | null = null;
let initPaletteGeneration = 0;
let prevUngroupedStackVis: Record<string, boolean> | null = null;

export function resetInitPalette(): void {
  initPaletteGeneration += 1;
  initPaletteKey = null;
  initPaletteInFlight = null;
  prevUngroupedStackVis = null;
}

/**
 * One `psudo.optimize` for the default visible intensity channels when a story
 * opens on the seed palette (hydrate) or never received an import optimize.
 * Skips once colors are no longer the import seeds.
 */
export function ensureInitPalette(storyId: string): Promise<void> {
  const doc = useDocumentStore.getState();
  const sources = flattenImageChannelsInDocumentOrder(doc.images);
  const picked = importPaletteSourceChannels(sources);
  const key = `${storyId}:${picked.map((sc) => sc.id).join(",")}`;
  if (initPaletteKey === key || initPaletteInFlight === key) {
    return Promise.resolve();
  }
  if (!needsInitPalette(picked, doc.channelGroups)) {
    initPaletteKey = key;
    return Promise.resolve();
  }
  initPaletteInFlight = key;
  const generation = initPaletteGeneration;
  const pendingIds = picked.map((sc) => sc.id);
  setStackPalettePendingMany(pendingIds, true);
  const run = (async () => {
    try {
      const palette = await optimizeImportPalette(sources);
      if (generation !== initPaletteGeneration) return;
      const docNow = useDocumentStore.getState();
      if (docNow.activeStoryId !== storyId) return;
      const sourcesNow = flattenImageChannelsInDocumentOrder(docNow.images);
      const pickedNow = importPaletteSourceChannels(sourcesNow);
      if (
        pickedNow.map((sc) => sc.id).join(",") !==
        picked.map((sc) => sc.id).join(",")
      ) {
        return;
      }
      if (!needsInitPalette(pickedNow, docNow.channelGroups)) {
        initPaletteKey = key;
        return;
      }
      const colorBySourceId = new Map(
        pickedNow.map((sc, i) => [sc.id, palette[i]] as const),
      );
      let sourcesChanged = false;
      const nextSources = sourcesNow.map((sc) => {
        const c = colorBySourceId.get(sc.id);
        if (!c || (sc.color && !looksLikeImportDefaultSeedColor(sc.color))) {
          return sc;
        }
        sourcesChanged = true;
        return { ...sc, color: { r: c.r, g: c.g, b: c.b } };
      });
      let groupsChanged = false;
      const nextGroups = docNow.channelGroups.map((g) => {
        let rowChanged = false;
        const channels = g.channels.map((gc) => {
          const c = colorBySourceId.get(gc.channelId);
          if (!c || !looksLikeImportDefaultSeedColor(gc.color)) return gc;
          rowChanged = true;
          return { ...gc, color: { r: c.r, g: c.g, b: c.b } };
        });
        if (!rowChanged) return g;
        groupsChanged = true;
        return { ...g, channels };
      });
      if (!sourcesChanged && !groupsChanged) {
        initPaletteKey = key;
        return;
      }
      if (groupsChanged) {
        docNow.setImagesAndChannelGroups(
          applySourceChannelsToImages(docNow.images, nextSources),
          nextGroups,
        );
      } else {
        docNow.setImages(
          applySourceChannelsToImages(docNow.images, nextSources),
        );
      }
      if (import.meta.env.DEV) {
        console.log("[psudo] init palette", pendingIds);
      }
      initPaletteKey = key;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[psudo] init palette failed", e);
      }
    } finally {
      setStackPalettePendingMany(pendingIds, false);
      if (initPaletteInFlight === key) initPaletteInFlight = null;
    }
  })();
  return run;
}

let stackPaletteChain: Promise<void> = Promise.resolve();
const stackPalettePending = new Set<string>();
let stackPalettePendingSnapshot: readonly string[] = [];
const stackPalettePendingListeners = new Set<() => void>();

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
  if (sourceChannelInAnyGroup(doc.channelGroups, sourceChannelId)) return false;
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const shown = sourceChannels.find((sc) => sc.id === sourceChannelId);
  if (
    !shown ||
    !isImageChannel(shown) ||
    shown.samples === 3 ||
    isRgbDisplayChannel(shown, sourceChannels)
  ) {
    return false;
  }
  if (shown.color) return false;
  setStackPalettePendingMany([shown.id], true);
  return true;
}

function ensurePaletteForNewlyVisibleStackChannels(
  sourceChannelId: string,
): Promise<void> {
  const pending = markStackPalettePendingIfNeeded(sourceChannelId);
  const run = stackPaletteChain.then(async () => {
    try {
      await runEnsureStackPalette(sourceChannelId);
    } finally {
      if (pending) setStackPalettePendingMany([sourceChannelId], false);
    }
  });
  stackPaletteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function reconcileUngroupedStackPalette(
  stackVisibilities: Record<string, boolean>,
): void {
  const vis = stackVisibilities;
  const prev = prevUngroupedStackVis;
  prevUngroupedStackVis = vis;
  if (prev === null) return;
  const doc = useDocumentStore.getState();
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  for (const sc of sourceChannels) {
    if (sourceChannelInAnyGroup(doc.channelGroups, sc.id)) continue;
    if (isStackVisible(prev, sc.id) || !isStackVisible(vis, sc.id)) continue;
    void ensurePaletteForNewlyVisibleStackChannels(sc.id);
  }
}

async function runEnsureStackPalette(sourceChannelId: string): Promise<void> {
  const doc = useDocumentStore.getState();
  if (sourceChannelInAnyGroup(doc.channelGroups, sourceChannelId)) return;
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const shown = sourceChannels.find((sc) => sc.id === sourceChannelId);
  if (
    !shown ||
    !isImageChannel(shown) ||
    shown.samples === 3 ||
    isRgbDisplayChannel(shown, sourceChannels) ||
    shown.color
  ) {
    return;
  }

  const groups = doc.channelGroups;
  const app = useAppStore.getState();
  const lockedSlots: PaletteSlot[] = [];
  const unlocked: Channel[] = [];
  const seen = new Set<string>();
  for (const { sc, gc } of buildCompositedIntensityLayers({
    onLoader: sourceChannels.filter(isImageChannel),
    activeGroup: groups.find((g) => g.id === app.activeChannelGroupId),
    channelGroups: groups,
    stackVisibilities: app.channelVisibilities,
    groupRowVisibilities: app.channelGroupRowVisibilities,
    hasVisibilityMap: true,
    requireColor: false,
  })) {
    if (seen.has(sc.id)) continue;
    if (sc.samples === 3 || isRgbDisplayChannel(sc, sourceChannels)) continue;
    seen.add(sc.id);
    const color = gc?.color ?? sc.color;
    if (color) {
      lockedSlots.push({ id: sc.id, color: asRgbColor(color) });
    } else if (!gc) {
      unlocked.push(sc);
    }
  }
  if (!seen.has(shown.id)) unlocked.push(shown);
  if (unlocked.length === 0) return;

  const lockedIds = new Set(lockedSlots.map((slot) => slot.id));
  const unlockedStart = startingColorAwayFromLocked(
    lockedSlots.map((slot) => slot.color),
  );
  const slots: PaletteSlot[] = [
    ...lockedSlots,
    ...unlocked.map((sc) => ({ id: sc.id, color: unlockedStart })),
  ];

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
  const sourcesNow = flattenImageChannelsInDocumentOrder(docNow.images);
  const unlockedIds = new Set(unlocked.map((sc) => sc.id));
  const indexById = new Map(slots.map((slot, i) => [slot.id, i] as const));

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
