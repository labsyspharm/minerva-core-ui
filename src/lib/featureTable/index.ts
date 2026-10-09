import {
  type ClassVisibility,
  defaultClassColor,
  type MaskGpuStyle,
} from "@/lib/imaging/maskLayers";
import {
  optimizeDistinctPalette,
  seedRgbForGroupChannelIndex,
} from "@/lib/imaging/psudoPalette";
import { deleteBlob, getBlob, putBlob } from "@/lib/persistence/db";
import { deleteFileHandle } from "@/lib/persistence/fileHandles";
import { useAppStore } from "@/lib/stores/appStore";
import type {
  ClassView,
  Color,
  FeatureTable,
  Waypoint,
} from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  dropFeatureTable,
  fetchClassIndex,
  hasIngestedFeatureTable,
  ingestFeatureTable,
  peekClassIndex,
  resetFeatureTables,
} from "./client";
import { indexTexSize, MAX_CLASS_NAMES } from "./lutLayout";

export {
  hasIngestedFeatureTable,
  pageFeatureTable,
  peekClassIndex,
} from "./client";
export { peekFeatureCsv } from "./columns";

type FeatureTableColumns = { id: string; name: string };

/** Dexie blob key for a table's stored Parquet. */
export function featureTableBlobKey(
  storyId: string | null | undefined,
  featureTableId: string,
): string {
  return storyId
    ? `story:${storyId}:featureTable:${featureTableId}`
    : `featureTable:${featureTableId}`;
}

/** Dexie blob key, also tolerating a stored `{ handleKey }` with no `kind`. */
export function featureTableHandleKey(
  featureTable: Pick<FeatureTable, "source">,
): string | undefined {
  const { source } = featureTable;
  return "handleKey" in source ? source.handleKey : undefined;
}

type AttachFeatureTableResult =
  | { ok: true; featureTable: FeatureTable }
  | { ok: false; error: string };

const attachListeners = new Set<() => void>();
const pendingAttachSet = new Set<string>();
let pendingAttachIds: readonly string[] = [];

export function subscribeFeatureTablePending(
  onStoreChange: () => void,
): () => void {
  attachListeners.add(onStoreChange);
  return () => {
    attachListeners.delete(onStoreChange);
  };
}

export function getFeatureTablePendingSourceIds(): readonly string[] {
  return pendingAttachIds;
}

type FeatureTableAccess = {
  /** Tables whose stored or sidecar bytes could not be read. */
  missingTableIds: readonly string[];
};

const emptyAccess: FeatureTableAccess = {
  missingTableIds: [],
};

let featureTableAccess: FeatureTableAccess = emptyAccess;
const accessListeners = new Set<() => void>();

function noteAccess(next: FeatureTableAccess) {
  featureTableAccess = next;
  for (const fn of accessListeners) fn();
}

export function subscribeFeatureTableAccess(
  onStoreChange: () => void,
): () => void {
  accessListeners.add(onStoreChange);
  return () => {
    accessListeners.delete(onStoreChange);
  };
}

export function getFeatureTableAccess(): FeatureTableAccess {
  return featureTableAccess;
}

async function dropStoredSource(featureTable: FeatureTable): Promise<void> {
  const handleKey = featureTableHandleKey(featureTable);
  if (!handleKey) return;
  await deleteBlob(handleKey).catch(() => undefined);
  // Stories saved before Parquet also kept a file handle.
  await deleteFileHandle(handleKey).catch(() => undefined);
}

/** Visibility test for many class names: builds the name set once. */
export function classVisibilityTest(
  vis: ClassVisibility | undefined,
): (name: string) => boolean {
  if (!vis || vis.mode === "all") return () => true;
  const names = new Set(vis.names);
  return vis.mode === "hide"
    ? (name) => !names.has(name)
    : (name) => names.has(name);
}

export function classNameVisible(
  vis: ClassVisibility | undefined,
  name: string,
): boolean {
  return classVisibilityTest(vis)(name);
}

function visibilityAllOn(): ClassVisibility {
  return { mode: "all" };
}

function visibilityAllOff(): ClassVisibility {
  return { mode: "show", names: [] };
}

function toggleClassName(
  vis: ClassVisibility | undefined,
  name: string,
): ClassVisibility {
  if (name.length === 0) return vis ?? visibilityAllOn();
  const visible = classNameVisible(vis, name);
  const current = vis ?? visibilityAllOn();
  if (!visible) {
    if (current.mode === "all") return current;
    if (current.mode === "hide") {
      const next = current.names.filter((n) => n !== name);
      return next.length === 0
        ? visibilityAllOn()
        : { mode: "hide", names: next };
    }
    return current.names.includes(name)
      ? current
      : { mode: "show", names: [...current.names, name] };
  }
  if (current.mode === "all") {
    return { mode: "hide", names: [name] };
  }
  if (current.mode === "hide") {
    return current.names.includes(name)
      ? current
      : { mode: "hide", names: [...current.names, name] };
  }
  return {
    mode: "show",
    names: current.names.filter((n) => n !== name),
  };
}

function featureTableForChannel(
  sourceChannelId: string,
): FeatureTable | undefined {
  return useDocumentStore
    .getState()
    .featureTables.find((c) => c.sourceChannelId === sourceChannelId);
}

const paletteJobs = new Map<string, object>();

function applyNameColors(
  featureTableId: string,
  nameColors: FeatureTable["nameColors"],
) {
  const doc = useDocumentStore.getState();
  const current = doc.featureTables.find((c) => c.id === featureTableId);
  if (!current) return;
  const have = new Map(current.nameColors.map((c) => [c.name, c]));
  doc.setFeatureTables(
    doc.featureTables.map((c) => {
      if (c.id !== featureTableId) return c;
      return {
        ...c,
        nameColors: nameColors.map((row) => have.get(row.name) ?? row),
      };
    }),
  );
}

function scheduleClassPalette(
  featureTableId: string,
  names: readonly string[],
) {
  if (names.length === 0) return;
  const job = {};
  paletteJobs.set(featureTableId, job);
  const paint = (palette?: readonly { r: number; g: number; b: number }[]) => {
    if (paletteJobs.get(featureTableId) !== job) return;
    applyNameColors(
      featureTableId,
      names.map((name, i) => ({
        name,
        color: palette?.[i] ?? seedRgbForGroupChannelIndex(i),
      })),
    );
  };
  void optimizeDistinctPalette(names.length)
    .then(paint)
    .catch((e) => {
      console.warn("[featureTable] class palette failed", e);
      paint();
    })
    .finally(() => {
      if (paletteJobs.get(featureTableId) === job)
        paletteJobs.delete(featureTableId);
    });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const lutPending = new Set<string>();
let lutEpoch = 0;
const lutListeners = new Set<() => void>();

export function subscribeFeatureTableLut(
  onStoreChange: () => void,
): () => void {
  lutListeners.add(onStoreChange);
  return () => {
    lutListeners.delete(onStoreChange);
  };
}

export function getFeatureTableLutEpoch(): number {
  return lutEpoch;
}

function noteLut() {
  lutEpoch += 1;
  for (const fn of lutListeners) fn();
}

/**
 * In-progress class color for one waypoint. Painted over that waypoint's view
 * until the picker commits. `owner` is the list whose picker set it, so another
 * list closing its picker leaves this one alone.
 */
let classColorPreview: {
  owner: string;
  waypointId: string;
  featureTableId: string;
  name: string;
  color: Color;
} | null = null;

export function previewClassColor(
  owner: string,
  waypointId: string,
  featureTableId: string,
  name: string,
  color: Color,
): void {
  const prev = classColorPreview;
  if (
    prev?.owner === owner &&
    prev.waypointId === waypointId &&
    prev.featureTableId === featureTableId &&
    prev.name === name &&
    prev.color.r === color.r &&
    prev.color.g === color.g &&
    prev.color.b === color.b
  ) {
    return;
  }
  classColorPreview = { owner, waypointId, featureTableId, name, color };
  noteLut();
}

export function clearClassColorPreview(owner: string): void {
  if (classColorPreview?.owner !== owner) return;
  classColorPreview = null;
  noteLut();
}

export function classViewFor(
  waypoint: Pick<Waypoint, "classViews"> | undefined,
  channelId: string,
): ClassView | undefined {
  // `?.` covers rows set from Dexie without a parse, which lack the default.
  return waypoint?.classViews?.find((v) => v.channelId === channelId);
}

/**
 * `view` with `hidden` classes also off. The playback legend hides classes
 * for the session this way; the waypoint's own view is not changed.
 */
export function withHiddenClasses(
  view: ClassView | undefined,
  channelId: string,
  hidden: readonly string[] | undefined,
): ClassView | undefined {
  if (!hidden?.length) return view;
  const vis = view?.visibility ?? visibilityAllOn();
  const visibility: ClassVisibility =
    vis.mode === "show"
      ? { mode: "show", names: vis.names.filter((n) => !hidden.includes(n)) }
      : {
          mode: "hide",
          names: [
            ...new Set([...(vis.mode === "hide" ? vis.names : []), ...hidden]),
          ],
        };
  return { channelId, colors: view?.colors ?? [], visibility };
}

/** The waypoint's colors over the table's generated palette, by class name. */
export function classColorsFor(
  featureTable: FeatureTable,
  view: ClassView | undefined,
  waypointId?: string,
): Map<string, Color> {
  const colors = new Map(featureTable.nameColors.map((c) => [c.name, c.color]));
  for (const c of view?.colors ?? []) colors.set(c.name, c.color);
  if (
    classColorPreview?.waypointId === waypointId &&
    classColorPreview.featureTableId === featureTable.id
  ) {
    colors.set(classColorPreview.name, classColorPreview.color);
  }
  return colors;
}

/**
 * One entry per palette slot (slot `i + 1`), as the mask draws it. Names past
 * the palette's slots draw unlabeled, so they are left out.
 */
function classSlots(
  names: readonly string[],
  view: ClassView | undefined,
  seed: number,
  colors: ReadonlyMap<string, Color>,
): { name: string; color: Color; visible: boolean }[] {
  const visible = classVisibilityTest(view?.visibility);
  return names.slice(0, MAX_CLASS_NAMES).map((name, i) => ({
    name,
    color: colors.get(name) ?? defaultClassColor(i + 1, seed),
    visible: visible(name),
  }));
}

/**
 * Classes the view shows, in palette order, with the swatch the mask draws.
 * Undefined until the class index is loaded.
 */
export function shownClassRows(
  featureTable: FeatureTable,
  view: ClassView | undefined,
  seed: number,
  waypointId?: string,
): { name: string; color: Color }[] | undefined {
  const idx = peekClassIndex(featureTable.id);
  if (!idx) return undefined;
  const colors = classColorsFor(featureTable, view, waypointId);
  return classSlots(idx.names, view, seed, colors)
    .filter((slot) => slot.visible)
    .map(({ name, color }) => ({ name, color }));
}

function paletteRev(
  featureTable: FeatureTable,
  vis: ClassVisibility | undefined,
  seed: number,
  colors: ReadonlyMap<string, Color>,
): string {
  const visPart =
    !vis || vis.mode === "all" ? "all" : `${vis.mode}:${vis.names.join("\0")}`;
  const colorPart = [...colors]
    .map(([name, c]) => `${name}:${c.r},${c.g},${c.b}`)
    .join(";");
  return `${featureTable.digest}:${seed}:${visPart}:${colorPart}`;
}

// `noteLut` bumps the epoch that rebuilds mask layers, which call back here.
// Only a fetched index notes it, so a miss or an error cannot loop.
function ensureIndex(featureTable: FeatureTable) {
  const featureTableId = featureTable.id;
  if (
    peekClassIndex(featureTableId) !== undefined ||
    lutPending.has(featureTableId)
  )
    return;
  // No rows yet, or the index would not fit a texture.
  if (
    !hasIngestedFeatureTable(featureTableId) ||
    indexTexSize(featureTable.maxClassId + 1) == null
  )
    return;
  lutPending.add(featureTableId);
  void fetchClassIndex(featureTableId)
    .then((idx) => {
      if (idx) noteLut();
    })
    .catch((e) => {
      console.error("[featureTable] class index failed", e);
    })
    .finally(() => {
      lutPending.delete(featureTableId);
    });
}

export function gpuStyleForFeatureTable(
  featureTable: FeatureTable,
  view: ClassView | undefined,
  seed: number,
  waypointId?: string,
): MaskGpuStyle | undefined {
  const idx = peekClassIndex(featureTable.id);
  if (idx === undefined) ensureIndex(featureTable);
  if (!idx) return undefined;
  const vis = view?.visibility;
  const colors = classColorsFor(featureTable, view, waypointId);
  const slots = classSlots(idx.names, view, seed, colors);
  const palette = new Uint8Array((slots.length + 1) * 4);
  slots.forEach(({ color, visible }, i) => {
    const o = (i + 1) * 4;
    palette[o] = color.r;
    palette[o + 1] = color.g;
    palette[o + 2] = color.b;
    palette[o + 3] = visible ? 255 : 0;
  });
  return {
    index: idx.data,
    width: idx.width,
    height: idx.height,
    palette,
    missHidden: vis?.mode === "show",
    indexRev: featureTable.digest,
    rev: paletteRev(featureTable, vis, seed, colors),
  };
}

export async function completeFeatureTableIngest(
  sourceChannelId: string,
  job: ReturnType<typeof ingestFeatureCsvFile>,
): Promise<AttachFeatureTableResult> {
  pendingAttachSet.add(sourceChannelId);
  pendingAttachIds = [...pendingAttachSet];
  for (const fn of attachListeners) fn();
  try {
    const ingested = await job;
    if (ingested.ok === false) return ingested;
    return commitIngestedFeatureTable(sourceChannelId, ingested.ingested);
  } finally {
    pendingAttachSet.delete(sourceChannelId);
    pendingAttachIds = [...pendingAttachSet];
    for (const fn of attachListeners) fn();
  }
}

type IngestedFeatureCsv = {
  featureTableId: string;
  maxClassId: number;
  names: string[];
  persist: Uint8Array;
  digest: string;
};

export async function ingestFeatureCsvFile(
  file: File,
  columns?: FeatureTableColumns,
): Promise<
  { ok: true; ingested: IngestedFeatureCsv } | { ok: false; error: string }
> {
  const featureTableId = crypto.randomUUID();
  try {
    const ingested = await ingestFeatureTable(featureTableId, file, columns);
    const persist = ingested.persist;
    if (!persist) throw new Error("Feature table CSV ingest produced no data");
    return {
      ok: true,
      ingested: {
        featureTableId,
        maxClassId: ingested.maxClassId,
        names: ingested.names,
        persist,
        digest: await sha256Hex(persist),
      },
    };
  } catch (e) {
    console.error("[featureTable] ingest failed", e);
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not index feature table CSV",
    };
  }
}

async function commitIngestedFeatureTable(
  sourceChannelId: string,
  ingested: IngestedFeatureCsv,
): Promise<AttachFeatureTableResult> {
  const existing = featureTableForChannel(sourceChannelId);
  if (existing && existing.id !== ingested.featureTableId) {
    paletteJobs.delete(existing.id);
    await dropFeatureTable(existing.id).catch(() => undefined);
    await dropStoredSource(existing);
  }

  let nameColors: FeatureTable["nameColors"] = [];
  const reuse =
    existing &&
    existing.digest === ingested.digest &&
    existing.nameColors.length > 0;
  if (reuse) nameColors = existing.nameColors;

  const handleKey = featureTableBlobKey(
    useDocumentStore.getState().activeStoryId,
    ingested.featureTableId,
  );
  await putBlob(handleKey, ingested.persist);
  const featureTable: FeatureTable = {
    id: ingested.featureTableId,
    sourceChannelId,
    source: { kind: "local", handleKey },
    maxClassId: ingested.maxClassId,
    nameColors,
    digest: ingested.digest,
  };
  const doc = useDocumentStore.getState();
  const next = existing
    ? doc.featureTables.map((c) => (c.id === existing.id ? featureTable : c))
    : [...doc.featureTables, featureTable];
  doc.setFeatureTables(next);
  if (nameColors.length === 0) {
    scheduleClassPalette(ingested.featureTableId, ingested.names);
  }
  return { ok: true, featureTable };
}

export async function detachFeatureTable(
  sourceChannelId: string,
): Promise<void> {
  const featureTable = featureTableForChannel(sourceChannelId);
  if (!featureTable) return;
  paletteJobs.delete(featureTable.id);
  await dropFeatureTable(featureTable.id).catch(() => undefined);
  await dropStoredSource(featureTable);
  const doc = useDocumentStore.getState();
  if (doc.featureTables.some((c) => c.id === featureTable.id)) {
    doc.setFeatureTables(
      doc.featureTables.filter((c) => c.id !== featureTable.id),
    );
  }
  dropClassViews(sourceChannelId);
}

/** Remove one mask's class views from every waypoint. */
function dropClassViews(channelId: string): void {
  const doc = useDocumentStore.getState();
  if (!doc.waypoints.some((w) => classViewFor(w, channelId))) return;
  doc.setWaypoints(
    doc.waypoints.map((w) =>
      classViewFor(w, channelId)
        ? {
            ...w,
            classViews: (w.classViews ?? []).filter(
              (v) => v.channelId !== channelId,
            ),
          }
        : w,
    ),
  );
}

export function detachRemovedFeatureTables(
  previous: readonly FeatureTable[],
  remaining: readonly FeatureTable[],
): void {
  for (const featureTable of previous) {
    if (remaining.some((c) => c.id === featureTable.id)) continue;
    void detachFeatureTable(featureTable.sourceChannelId);
  }
  useDocumentStore.getState().setFeatureTables([...remaining]);
}

/**
 * Class edits name their waypoint: the channel panel passes the one on
 * screen, the waypoint detail view passes its own.
 */
function classViewTarget(
  waypointId: string,
  featureTableId: string,
): { channelId: string; view: ClassView | undefined } | undefined {
  const doc = useDocumentStore.getState();
  const featureTable = doc.featureTables.find((c) => c.id === featureTableId);
  const waypoint = doc.waypoints.find((w) => w.id === waypointId);
  if (!featureTable || !waypoint) return undefined;
  const channelId = featureTable.sourceChannelId;
  return { channelId, view: classViewFor(waypoint, channelId) };
}

function updateClassView(
  waypointId: string,
  featureTableId: string,
  update: (view: ClassView | undefined) => Omit<ClassView, "channelId">,
): void {
  const target = classViewTarget(waypointId, featureTableId);
  if (!target) return;
  const next = update(target.view);
  const isDefault = next.visibility.mode === "all" && next.colors.length === 0;
  useAppStore
    .getState()
    .setWaypointClassView(
      waypointId,
      target.channelId,
      isDefault ? null : next,
    );
}

export function toggleClassVisible(
  waypointId: string,
  featureTableId: string,
  name: string,
): void {
  updateClassView(waypointId, featureTableId, (view) => ({
    visibility: toggleClassName(view?.visibility, name),
    colors: view?.colors ?? [],
  }));
}

export function setAllClassesVisible(
  waypointId: string,
  featureTableId: string,
  visible: boolean,
): void {
  updateClassView(waypointId, featureTableId, (view) => ({
    visibility: visible ? visibilityAllOn() : visibilityAllOff(),
    colors: view?.colors ?? [],
  }));
}

export function setClassColor(
  waypointId: string,
  featureTableId: string,
  name: string,
  color: Color,
): void {
  updateClassView(waypointId, featureTableId, (view) => ({
    visibility: view?.visibility ?? visibilityAllOn(),
    colors: [
      ...(view?.colors ?? []).filter((c) => c.name !== name),
      { name, color },
    ],
  }));
}

/** Back to every class in the table palette on that waypoint. */
export function resetClassView(
  waypointId: string,
  featureTableId: string,
): void {
  const target = classViewTarget(waypointId, featureTableId);
  if (!target) return;
  useAppStore
    .getState()
    .setWaypointClassView(waypointId, target.channelId, null);
}

async function fetchTableBytes(
  url: string,
  documentUrl: string | undefined,
): Promise<Uint8Array> {
  const base = new URL(
    documentUrl ?? window.location.href,
    window.location.href,
  );
  const res = await fetch(new URL(url, base));
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Stored bytes for one table, or undefined when there are none to read. */
async function readTableBytes(
  featureTable: FeatureTable,
  documentUrl: string | undefined,
): Promise<Uint8Array | undefined> {
  const { source } = featureTable;
  if (source.kind === "url") return fetchTableBytes(source.url, documentUrl);
  const key = featureTableHandleKey(featureTable);
  return key ? getBlob(key) : undefined;
}

/**
 * Ingest every table into the worker. A `local` source reads its Dexie blob;
 * a `url` source is fetched relative to `documentUrl` (the page by default).
 * A table that cannot be read is listed in `missingTableIds`.
 */
export async function hydrateFeatureTables(
  featureTables: readonly FeatureTable[],
  reset: boolean,
  opts?: { documentUrl?: string },
): Promise<void> {
  if (reset) {
    lutPending.clear();
    await resetFeatureTables();
  }
  const pending = featureTables.filter(
    (featureTable) => reset || !hasIngestedFeatureTable(featureTable.id),
  );
  // Reads overlap; ingests stay in order on the worker's one DuckDB connection.
  const reads = pending.map((featureTable) =>
    readTableBytes(featureTable, opts?.documentUrl).catch((e) => {
      console.error("[featureTable] hydrate failed", featureTable.id, e);
      return undefined;
    }),
  );
  const missingTableIds: string[] = [];
  for (const [i, featureTable] of pending.entries()) {
    const bytes = await reads[i];
    if (!bytes) {
      missingTableIds.push(featureTable.id);
      continue;
    }
    try {
      const ingested = await ingestFeatureTable(featureTable.id, bytes);
      noteLut();
      const key = featureTableHandleKey(featureTable);
      if (ingested.persist && key) {
        // Legacy CSV blob. Keep the digest so `nameColors` stay matched.
        await putBlob(key, ingested.persist);
      }
      if (featureTable.nameColors.length === 0) {
        scheduleClassPalette(featureTable.id, ingested.names);
      }
    } catch (e) {
      console.error("[featureTable] hydrate failed", featureTable.id, e);
      missingTableIds.push(featureTable.id);
    }
  }
  noteAccess({ missingTableIds });
}
