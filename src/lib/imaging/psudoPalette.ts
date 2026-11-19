import {
  applyVisibilityTransition,
  buildCompositedIntensityLayers,
  isStackVisible,
  sourceChannelInAnyGroup,
} from "@/lib/imaging/channelCompositor";
import {
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isRgbDisplayChannel,
} from "@/lib/imaging/channelKind";
import { loaderForImage } from "@/lib/imaging/gmmScheduler";
import {
  DEFAULT_HE_STAIN_COLORS,
  heStainColorsForFit,
} from "@/lib/imaging/heStainColors";
import { ensureHeStainFit } from "@/lib/imaging/heStainFit";
import {
  hexToRgb,
  IMPORT_DEFAULT_SEED_HEX,
  looksLikeImportDefaultSeedColor,
  type RgbColor,
  rgbToHex,
  seedDefaultSourceChannelStyles,
} from "@/lib/imaging/sourceChannelStyle";
import { useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup, Image } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  joinLastUndoStep,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import {
  applySourceChannelsToImages,
  patchGroupRowOnGroups,
  patchSourceChannelOnImages,
} from "@/lib/stores/storeUtils";

/** OKLab L bounds × 100 (psudo 0.15+ / palette study default). */
const DEFAULT_LUMINANCE = new Uint16Array([60, 92]);
/**
 * IHC stains are colors on white glass: dark enough to show on it, light
 * enough to keep their hue over hematoxylin.
 */
const STAIN_LUMINANCE = new Uint16Array([40, 75]);

/**
 * psudo README / npm tests: `false` = optimize C3 color-name distance + OKLab
 * perceptual separation only (no spatial channel overlap).
 */
const PSUDO_INCLUDE_SPATIAL_CHANNEL_OVERLAP = false;
const PSUDO_MAX_ITERS = 2700;
const PSUDO_CONFUSION_BASELINE_SAMPLES = 32;
/** Matches psudo 0.15+ / palette_study (× n/3, max 40 inside WASM). */
const PSUDO_NUM_RESTARTS = 18;

const CLASS_PALETTE_MAX_ITERS = 400;
const CLASS_PALETTE_CONFUSION_SAMPLES = 16;
const CLASS_PALETTE_RESTARTS = 3;

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

const STACK_SEED_COLORS: RgbColor[] = [
  ...IMPORT_DEFAULT_SEED_HEX.map((hex) => hexToRgb(hex)),
  { r: 255, g: 255, b: 255 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
];
const STACK_SEED_HEX = new Set(STACK_SEED_COLORS.map((c) => rgbToHex(c)));

function isStackSeedColor(color: {
  r?: number;
  g?: number;
  b?: number;
}): boolean {
  return STACK_SEED_HEX.has(rgbToHex(color));
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
  return optimized instanceof Float32Array
    ? optimized
    : new Float32Array(optimized as ArrayLike<number>);
}

/** Per-call changes to the default psudo inputs (search budget, luminance window). */
type PaletteOverrides = Partial<
  Pick<
    PsudoOptimizeInputs,
    "maxIters" | "confusionSamples" | "numRestarts" | "luminance"
  >
>;

async function optimizePaletteSlots(
  slots: readonly PaletteSlot[],
  lockedIds: ReadonlySet<string> = new Set(),
  overrides?: PaletteOverrides,
): Promise<RgbColor[]> {
  if (slots.length < 2) {
    throw new Error(
      "At least two channels are required to optimize a palette.",
    );
  }
  if (slots.every((slot) => lockedIds.has(slot.id))) {
    return slots.map((slot) => ({ ...slot.color }));
  }
  const inputs = {
    ...buildOptimizeInputsFromSlots(slots, lockedIds),
    ...overrides,
  };
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

/** One psudo color per distinct class name (n=1 skips optimize). */
export async function optimizeDistinctPalette(
  count: number,
): Promise<RgbColor[]> {
  if (count <= 0) return [];
  if (count === 1) return [seedRgbForGroupChannelIndex(0)];
  const slots: PaletteSlot[] = Array.from({ length: count }, (_, i) => ({
    id: String(i),
    color: seedRgbForGroupChannelIndex(i),
  }));
  return optimizePaletteSlots(slots, new Set(), {
    maxIters: CLASS_PALETTE_MAX_ITERS,
    confusionSamples: CLASS_PALETTE_CONFUSION_SAMPLES,
    numRestarts: CLASS_PALETTE_RESTARTS,
  });
}

/** An intensity channel drawn as an absorbing IHC stain. */
function isStainChannel(sc: Channel | undefined): boolean {
  return Boolean(sc?.stain && sc.samples !== 3 && isImageChannel(sc));
}

/** Stains are colors on glass; see `STAIN_LUMINANCE`. */
const STAIN_OVERRIDES: PaletteOverrides = { luminance: STAIN_LUMINANCE };

/** White glass: what a stain is set apart from when nothing else is shown. */
const GLASS_SLOT: PaletteSlot = {
  id: "glass",
  color: { r: 255, g: 255, b: 255 },
};

/**
 * The H&E that stains among `candidates` (a group's rows, the shown layers)
 * are drawn over: an RGB channel drawn as brightfield (stains not separated,
 * or separated as brightfield), preferring packed RGB with an open loader,
 * which the Macenko fit can read.
 */
function heUnder(
  sourceChannels: Channel[],
  candidates: readonly Channel[],
): Channel | undefined {
  const split = useAppStore.getState().heDeconvByChannelId;
  const rgb = candidates.filter(
    (sc) =>
      split[sc.id]?.mode !== "fluorescence" &&
      isRgbDisplayChannel(sc, sourceChannels),
  );
  return (
    rgb.find((sc) => sc.samples === 3 && loaderForImage(sc.imageId)) ?? rgb[0]
  );
}

/**
 * Hematoxylin and eosin of `he` as fixed palette entries, so stains are
 * colored apart from them: Macenko-fitted for packed RGB with an open loader
 * (the fit reads interleaved pixels), reference colors otherwise.
 */
async function heContextSlots(he: Channel | undefined): Promise<PaletteSlot[]> {
  if (!he) return [];
  const loader = he.samples === 3 ? loaderForImage(he.imageId) : undefined;
  const colors = loader
    ? heStainColorsForFit(
        await ensureHeStainFit({
          loader,
          cacheKey: `${he.imageId}:${he.index}`,
          channelIndex: he.index,
        }),
      )
    : DEFAULT_HE_STAIN_COLORS;
  return [
    { id: "he:hematoxylin", color: colors.hematoxylin },
    { id: "he:eosin", color: colors.eosin },
  ];
}

/**
 * A group's rows split by draw mode. Glowing and absorbing channels are seen
 * differently, so each kind is optimized among its own; H&E's two colors join
 * the stains, so one stain over H&E is enough to optimize.
 */
function groupDrawModes(group: ChannelGroup, sourceChannels: Channel[]) {
  const fluorescence: PaletteSlot[] = [];
  const stains: PaletteSlot[] = [];
  const rows: Channel[] = [];
  for (const gc of group.channels ?? []) {
    const sc = findSourceChannel(sourceChannels, gc.channelId);
    if (!sc) continue;
    rows.push(sc);
    // Masks and RGB images draw their own colors, not the row's.
    if (!isImageChannel(sc) || isRgbDisplayChannel(sc, sourceChannels)) {
      continue;
    }
    const slot = { id: gc.id, color: asRgbColor(gc.color) };
    (isStainChannel(sc) ? stains : fluorescence).push(slot);
  }
  // The group's own H&E row, else the H&E shown under it.
  const he =
    stains.length > 0
      ? heUnder(sourceChannels, [
          ...rows,
          ...shownIntensityLayers(
            useDocumentStore.getState().channelGroups,
            sourceChannels,
          ).map((layer) => layer.sc),
        ])
      : undefined;
  return {
    fluorescence,
    stains,
    he,
    canOptimizeFluorescence: fluorescence.length >= 2,
    canOptimizeStains: stains.length + (he ? 2 : 0) >= 2,
  };
}

export function isGroupEligibleForPsudoOptimize(
  group: ChannelGroup,
  sourceChannels: Channel[],
): boolean {
  const modes = groupDrawModes(group, sourceChannels);
  return modes.canOptimizeFluorescence || modes.canOptimizeStains;
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
  const modes = groupDrawModes(group, sourceChannels);
  const anyUnlocked = (slots: PaletteSlot[]) =>
    slots.some((slot) => !lockedChannelRowIds.has(slot.id));
  const fluorescence =
    modes.canOptimizeFluorescence && anyUnlocked(modes.fluorescence);
  const stains = modes.canOptimizeStains && anyUnlocked(modes.stains);
  if (!fluorescence && !stains) return currentGroupColors(group);
  // Started now so the H&E fit overlaps the fluorescence pass.
  const he = stains ? heContextSlots(modes.he) : null;
  const colorById = new Map<string, RgbColor>();
  const keep = (slots: PaletteSlot[], colors: RgbColor[]) => {
    slots.forEach((slot, i) => {
      colorById.set(slot.id, colors[i]);
    });
  };
  if (fluorescence) {
    keep(
      modes.fluorescence,
      await optimizePaletteSlots(modes.fluorescence, lockedChannelRowIds),
    );
  }
  if (he) {
    const heSlots = await he;
    const slots = [...modes.stains, ...heSlots];
    const locked = new Set([
      ...lockedChannelRowIds,
      ...heSlots.map((slot) => slot.id),
    ]);
    keep(slots, await optimizePaletteSlots(slots, locked, STAIN_OVERRIDES));
  }
  return (group.channels ?? []).map(
    (gc) => colorById.get(gc.id) ?? asRgbColor(gc.color),
  );
}

function sameRgb(
  a: { r?: number; g?: number; b?: number } | undefined,
  b: { r?: number; g?: number; b?: number } | undefined,
): boolean {
  return a?.r === b?.r && a?.g === b?.g && a?.b === b?.b;
}

/**
 * `channelGroups` with `colors`, optimized for `from` (the group as it was),
 * applied by row id. Rows removed, recolored or locked since are left alone:
 * the optimize can take seconds while the H&E fit loads.
 */
export function applyOptimizedColorsToChannelGroup(
  channelGroups: ChannelGroup[],
  from: ChannelGroup,
  colors: RgbColor[],
  options?: { lockedChannelRowIds?: ReadonlySet<string> },
): ChannelGroup[] {
  const locked = options?.lockedChannelRowIds;
  const optimized = new Map(
    from.channels.map((gc, i) => [gc.id, { was: gc.color, c: colors[i] }]),
  );
  return channelGroups.map((g) => {
    if (g.id !== from.id) return g;
    const channels = g.channels.map((gc) => {
      const row = optimized.get(gc.id);
      if (!row?.c || locked?.has(gc.id) || !sameRgb(gc.color, row.was)) {
        return gc;
      }
      return { ...gc, color: { r: row.c.r, g: row.c.g, b: row.c.b } };
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
  return (
    STACK_SEED_COLORS.find(
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

/**
 * Import palette for an export or preview when no group row exists.
 * Existing colors and contrast limits are left alone.
 */
export async function paintUngroupedExportColors(
  images: Image[],
  channelGroups: ChannelGroup[],
): Promise<Image[]> {
  if (channelGroups.some((g) => g.channels.length > 0)) return images;
  const flat = flattenImageChannelsInDocumentOrder(images);
  if (flat.every((ch) => ch.color)) return images;
  const painted = await applySharedImportPaletteToSourceChannels(flat);
  const colorById = new Map(
    painted.flatMap((ch) => (ch.color ? [[ch.id, ch.color] as const] : [])),
  );
  return images.map((image) => ({
    ...image,
    channels: image.channels.map((ch) => {
      const color = colorById.get(ch.id);
      return color && !ch.color ? { ...ch, color } : ch;
    }),
  }));
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
  fillBeforeStain.clear();
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
/** Palette runs in flight per source channel; a channel is pending while any are. */
const stackPalettePending = new Map<string, number>();
let stackPalettePendingSnapshot: readonly string[] = [];
const stackPalettePendingListeners = new Set<() => void>();

/** Each `true` must be paired with a `false` once that run ends. */
export function setStackPalettePendingMany(
  sourceChannelIds: readonly string[],
  pending: boolean,
): void {
  if (sourceChannelIds.length === 0) return;
  let changed = false;
  for (const id of sourceChannelIds) {
    const runs = (stackPalettePending.get(id) ?? 0) + (pending ? 1 : -1);
    if (runs > 0) {
      changed ||= runs === 1 && pending;
      stackPalettePending.set(id, runs);
    } else if (stackPalettePending.delete(id)) {
      changed = true;
    }
  }
  if (!changed) return;
  stackPalettePendingSnapshot = [...stackPalettePending.keys()];
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

export function assignUngroupedStackSeedColor(
  sourceChannelId: string,
): boolean {
  const doc = useDocumentStore.getState();
  if (sourceChannelInAnyGroup(doc.channelGroups, sourceChannelId)) return false;
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const shown = sourceChannels.find((sc) => sc.id === sourceChannelId);
  if (
    !shown ||
    shown.color ||
    !isImageChannel(shown) ||
    shown.samples === 3 ||
    isRgbDisplayChannel(shown, sourceChannels)
  ) {
    return false;
  }
  const locked: RgbColor[] = [];
  for (const sc of sourceChannels) {
    if (sc.color) locked.push(asRgbColor(sc.color));
  }
  for (const group of doc.channelGroups) {
    for (const gc of group.channels) locked.push(asRgbColor(gc.color));
  }
  const color = startingColorAwayFromLocked(locked);
  doc.setImages(
    applySourceChannelsToImages(
      doc.images,
      sourceChannels.map((sc) =>
        sc.id === sourceChannelId ? { ...sc, color } : sc,
      ),
    ),
  );
  return true;
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
  if (shown.color && !isStackSeedColor(shown.color)) return false;
  setStackPalettePendingMany([shown.id], true);
  return true;
}

export function optimizeUngroupedStackChannel(
  sourceChannelId: string,
): Promise<void> {
  const pending = markStackPalettePendingIfNeeded(sourceChannelId);
  const enqueue = () => {
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
  };
  const doc = useDocumentStore.getState();
  const sources = flattenImageChannelsInDocumentOrder(doc.images);
  if (
    !pending ||
    !isStainChannel(findSourceChannel(sources, sourceChannelId))
  ) {
    return enqueue();
  }
  // A stain waits for the H&E fit before joining the queue, so channels shown
  // after it aren't held up behind the fit.
  const layers = shownIntensityLayers(doc.channelGroups, sources);
  return heContextSlots(
    heUnder(
      sources,
      layers.map((layer) => layer.sc),
    ),
  ).then(enqueue, enqueue);
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
    void optimizeUngroupedStackChannel(sc.id);
  }
}

/** The intensity layers the viewer draws now, each with the group row it comes from, if any. */
function shownIntensityLayers(
  groups: ChannelGroup[],
  sourceChannels: Channel[],
) {
  const app = useAppStore.getState();
  const visibility = applyVisibilityTransition(
    sourceChannels,
    groups,
    app.channelVisibilities,
    app.channelGroupRowVisibilities,
    { kind: "sync" },
  );
  return buildCompositedIntensityLayers({
    onLoader: sourceChannels.filter(isImageChannel),
    activeGroup: groups.find((g) => g.id === app.activeChannelGroupId),
    channelGroups: groups,
    stackVisibilities: visibility.channelVisibilities,
    groupRowVisibilities: visibility.channelGroupRowVisibilities,
    hasVisibilityMap: true,
  });
}

/**
 * Fixed palette entries for coloring `shown`: the other shown channels of its
 * draw mode, plus the H&E drawn under a stain, or glass when there's neither.
 */
async function shownPaletteContext(
  shown: Channel,
  layers: ReturnType<typeof shownIntensityLayers>,
  sourceChannels: Channel[],
): Promise<PaletteSlot[]> {
  const stain = isStainChannel(shown);
  const slots: PaletteSlot[] = [];
  const seen = new Set<string>([shown.id]);
  for (const { sc, gc } of layers) {
    if (seen.has(sc.id)) continue;
    if (sc.samples === 3 || isRgbDisplayChannel(sc, sourceChannels)) continue;
    if (isStainChannel(sc) !== stain) continue;
    seen.add(sc.id);
    const color = gc?.color ?? sc.color;
    if (color) slots.push({ id: sc.id, color: asRgbColor(color) });
  }
  if (!stain) return slots;
  const he = heUnder(
    sourceChannels,
    layers.map((layer) => layer.sc),
  );
  slots.push(...(await heContextSlots(he)));
  return slots.length > 0 ? slots : [GLASS_SLOT];
}

/** Where a channel's drawn color lives: a group row, else its source channel. */
type ColorTarget = { sourceId: string; rowId?: string };

/** `rowId` if the choice was made on a group row, else the shown group row. */
function colorTarget(
  sourceId: string,
  rowId: string | undefined,
  layers: ReturnType<typeof shownIntensityLayers>,
): ColorTarget {
  return {
    sourceId,
    rowId: rowId ?? layers.find((layer) => layer.sc.id === sourceId)?.gc?.id,
  };
}

function colorAt(
  target: ColorTarget,
  doc = useDocumentStore.getState(),
): { r?: number; g?: number; b?: number } | undefined {
  if (!target.rowId) {
    const images = flattenImageChannelsInDocumentOrder(doc.images);
    return findSourceChannel(images, target.sourceId)?.color;
  }
  for (const g of doc.channelGroups) {
    const gc = g.channels.find((c) => c.id === target.rowId);
    if (gc) return gc.color;
  }
  return undefined;
}

/**
 * Fill colors of channels recolored as stains, by row id (or source id for a
 * source color), given back when they stop being stains.
 */
const fillBeforeStain = new Map<
  string,
  { sourceId: string; color: RgbColor }
>();

/**
 * Draws a source channel as an IHC stain, or stops. Starting picks a stain
 * color (`recolorAsStain`); stopping gives back the fill colors it replaced.
 * `rowId` is the group row the choice was made on, if any. One undo step.
 */
export function setStainMode(
  sourceId: string,
  stain: boolean,
  rowId?: string,
): void {
  const doc = useDocumentStore.getState();
  let images = patchSourceChannelOnImages(doc.images, sourceId, {
    stain: stain || undefined,
  });
  if (stain) {
    doc.setImages(images);
    void recolorAsStain(sourceId, rowId);
    return;
  }
  let groups = doc.channelGroups;
  for (const [key, fill] of fillBeforeStain) {
    if (fill.sourceId !== sourceId) continue;
    fillBeforeStain.delete(key);
    if (key === sourceId) {
      images = patchSourceChannelOnImages(images, sourceId, {
        color: fill.color,
      });
    } else {
      groups = patchGroupRowOnGroups(groups, key, { color: fill.color });
    }
  }
  if (groups === doc.channelGroups) doc.setImages(images);
  else doc.setImagesAndChannelGroups(images, groups);
}

/**
 * Recolors a channel just switched to IHC stain, whose fluorescence color is
 * usually too pale on glass: apart from the shown stains and H&E, written
 * where its color lives (see `colorTarget`). Skipped if that color is locked
 * or changed while the H&E fit or psudo runs; joins the switch's undo step.
 */
async function recolorAsStain(
  sourceChannelId: string,
  rowId?: string,
): Promise<void> {
  const doc = useDocumentStore.getState();
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const shown = sourceChannels.find((sc) => sc.id === sourceChannelId);
  if (!shown || !isStainChannel(shown)) return;
  const layers = shownIntensityLayers(doc.channelGroups, sourceChannels);
  const target = colorTarget(shown.id, rowId, layers);
  const locked = () =>
    Boolean(
      target.rowId && useAppStore.getState().colorLockedRowIds[target.rowId],
    );
  if (locked()) return;
  const current = colorAt(target, doc);
  setStackPalettePendingMany([shown.id], true);
  try {
    const context = await shownPaletteContext(shown, layers, sourceChannels);
    const slots: PaletteSlot[] = [
      ...context,
      {
        id: shown.id,
        color: current
          ? asRgbColor(current)
          : startingColorAwayFromLocked(context.map((slot) => slot.color)),
      },
    ];
    const colors = await optimizePaletteSlots(
      slots,
      new Set(context.map((slot) => slot.id)),
      STAIN_OVERRIDES,
    );
    const c = colors[slots.length - 1];
    const color = { r: c.r, g: c.g, b: c.b };
    const docNow = useDocumentStore.getState();
    const now = flattenImageChannelsInDocumentOrder(docNow.images);
    if (
      !isStainChannel(findSourceChannel(now, shown.id)) ||
      locked() ||
      !sameRgb(colorAt(target, docNow), current)
    ) {
      return;
    }
    if (current) {
      fillBeforeStain.set(target.rowId ?? shown.id, {
        sourceId: shown.id,
        color: asRgbColor(current),
      });
    }
    joinLastUndoStep(() => {
      if (target.rowId) {
        docNow.setChannelGroups(
          patchGroupRowOnGroups(docNow.channelGroups, target.rowId, { color }),
        );
      } else {
        docNow.setImages(
          patchSourceChannelOnImages(docNow.images, shown.id, { color }),
        );
      }
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[psudo] stain color optimization failed", e);
    }
  } finally {
    setStackPalettePendingMany([shown.id], false);
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
    isRgbDisplayChannel(shown, sourceChannels)
  ) {
    return;
  }
  if (shown.color && !isStackSeedColor(shown.color)) return;

  const stain = isStainChannel(shown);
  const lockedSlots = await shownPaletteContext(
    shown,
    shownIntensityLayers(doc.channelGroups, sourceChannels),
    sourceChannels,
  );

  const lockedIds = new Set(lockedSlots.map((slot) => slot.id));
  const unlockedStart = shown.color
    ? asRgbColor(shown.color)
    : startingColorAwayFromLocked(lockedSlots.map((slot) => slot.color));
  const slots: PaletteSlot[] = [
    ...lockedSlots,
    { id: shown.id, color: unlockedStart },
  ];

  if (slots.length < 2) {
    if (shown.color) return;
    doc.setImages(
      applySourceChannelsToImages(
        doc.images,
        sourceChannels.map((sc) =>
          sc.id === shown.id ? { ...sc, color: unlockedStart } : sc,
        ),
      ),
    );
    return;
  }

  let colors: RgbColor[];
  try {
    colors = await optimizePaletteSlots(
      slots,
      lockedIds,
      stain ? STAIN_OVERRIDES : undefined,
    );
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[psudo] stack palette optimization failed", e);
    }
    return;
  }

  const docNow = useDocumentStore.getState();
  const sourcesNow = flattenImageChannelsInDocumentOrder(docNow.images);
  const unlockedIdx = slots.length - 1;

  let changed = false;
  const next = sourcesNow.map((sc) => {
    if (sc.id !== shown.id) return sc;
    if (sc.color && !isStackSeedColor(sc.color)) return sc;
    const c = colors[unlockedIdx];
    if (!c) return sc;
    changed = true;
    return { ...sc, color: { r: c.r, g: c.g, b: c.b } };
  });
  if (!changed) return;
  docNow.setImages(applySourceChannelsToImages(docNow.images, next));
}
