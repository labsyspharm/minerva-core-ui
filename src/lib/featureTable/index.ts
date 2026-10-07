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
import { MAX_CLASS_NAMES, shouldFetchClassIndex } from "./lutLayout";

export {
  exportFeatureTableParquet,
  getFeatureTableIngestEpoch,
  hasIngestedFeatureTable,
  pageFeatureTable,
  peekClassIndex,
  subscribeFeatureTableIngest,
} from "./client";
export { peekFeatureCsv } from "./columns";

type FeatureTableColumns = { id: string; name: string };

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
  missingHandleKeys: readonly string[];
};

const emptyAccess: FeatureTableAccess = {
  missingHandleKeys: [],
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

export function classNameVisible(
  vis: ClassVisibility | undefined,
  name: string,
): boolean {
  if (!vis || vis.mode === "all") return true;
  const names = new Set(vis.names);
  return vis.mode === "hide" ? !names.has(name) : names.has(name);
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

export function classViewFor(
  waypoint: Pick<Waypoint, "classViews"> | undefined,
  channelId: string,
): ClassView | undefined {
  // `?.` covers rows set from Dexie without a parse, which lack the default.
  return waypoint?.classViews?.find((v) => v.channelId === channelId);
}

/** The waypoint's colors over the table's generated palette, by class name. */
export function classColorsFor(
  featureTable: FeatureTable,
  view: ClassView | undefined,
): Map<string, Color> {
  const colors = new Map(featureTable.nameColors.map((c) => [c.name, c.color]));
  for (const c of view?.colors ?? []) colors.set(c.name, c.color);
  return colors;
}

/**
 * Classes the view shows, in palette order, with the swatch the mask draws.
 * Undefined until the class index is loaded. Names past the palette's slots
 * draw unlabeled, so they are left out.
 */
export function shownClassRows(
  featureTable: FeatureTable,
  view: ClassView | undefined,
  seed: number,
): { name: string; color: Color }[] | undefined {
  const idx = peekClassIndex(featureTable.id);
  if (!idx) return undefined;
  const colors = classColorsFor(featureTable, view);
  const rows: { name: string; color: Color }[] = [];
  const n = Math.min(idx.names.length, MAX_CLASS_NAMES);
  for (let i = 0; i < n; i++) {
    const name = idx.names[i];
    if (!classNameVisible(view?.visibility, name)) continue;
    rows.push({
      name,
      color: colors.get(name) ?? defaultClassColor(i + 1, seed),
    });
  }
  return rows;
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
  if (
    !shouldFetchClassIndex(
      hasIngestedFeatureTable(featureTableId),
      featureTable.maxClassId + 1,
    )
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
): MaskGpuStyle | undefined {
  const idx = peekClassIndex(featureTable.id);
  if (idx === undefined) ensureIndex(featureTable);
  if (!idx) return undefined;
  const vis = view?.visibility;
  const colors = classColorsFor(featureTable, view);
  const n = Math.min(idx.names.length, MAX_CLASS_NAMES);
  const palette = new Uint8Array((n + 1) * 4);
  for (let i = 0; i < n; i++) {
    const name = idx.names[i];
    const color = colors.get(name) ?? defaultClassColor(i + 1, seed);
    const o = (i + 1) * 4;
    palette[o] = color.r;
    palette[o + 1] = color.g;
    palette[o + 2] = color.b;
    palette[o + 3] = classNameVisible(vis, name) ? 255 : 0;
  }
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

  const storyId = useDocumentStore.getState().activeStoryId;
  const handleKey = storyId
    ? `story:${storyId}:featureTable:${ingested.featureTableId}`
    : `featureTable:${ingested.featureTableId}`;
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

/** Class edits target the waypoint on screen, `activeStoryIndex`. */
function activeClassViewTarget(
  featureTableId: string,
):
  | { waypointId: string; channelId: string; view: ClassView | undefined }
  | undefined {
  const doc = useDocumentStore.getState();
  const featureTable = doc.featureTables.find((c) => c.id === featureTableId);
  const index = useAppStore.getState().activeStoryIndex;
  const waypoint = index == null ? undefined : doc.waypoints[index];
  if (!featureTable || !waypoint) return undefined;
  const channelId = featureTable.sourceChannelId;
  return {
    waypointId: waypoint.id,
    channelId,
    view: classViewFor(waypoint, channelId),
  };
}

function updateActiveClassView(
  featureTableId: string,
  update: (view: ClassView | undefined) => Omit<ClassView, "channelId">,
): void {
  const target = activeClassViewTarget(featureTableId);
  if (!target) return;
  const next = update(target.view);
  const isDefault = next.visibility.mode === "all" && next.colors.length === 0;
  useAppStore
    .getState()
    .setWaypointClassView(
      target.waypointId,
      target.channelId,
      isDefault ? null : next,
    );
}

export function toggleClassVisible(featureTableId: string, name: string): void {
  updateActiveClassView(featureTableId, (view) => ({
    visibility: toggleClassName(view?.visibility, name),
    colors: view?.colors ?? [],
  }));
}

export function setAllClassesVisible(
  featureTableId: string,
  visible: boolean,
): void {
  updateActiveClassView(featureTableId, (view) => ({
    visibility: visible ? visibilityAllOn() : visibilityAllOff(),
    colors: view?.colors ?? [],
  }));
}

export function setClassColor(
  featureTableId: string,
  name: string,
  color: Color,
): void {
  updateActiveClassView(featureTableId, (view) => ({
    visibility: view?.visibility ?? visibilityAllOn(),
    colors: [
      ...(view?.colors ?? []).filter((c) => c.name !== name),
      { name, color },
    ],
  }));
}

/** Back to every class in the table palette on the active waypoint. */
export function resetClassView(featureTableId: string): void {
  const target = activeClassViewTarget(featureTableId);
  if (!target) return;
  useAppStore
    .getState()
    .setWaypointClassView(target.waypointId, target.channelId, null);
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

/**
 * Ingest every table into the worker. A `local` source reads its Dexie blob;
 * a `url` source is fetched relative to `documentUrl` (the page by default).
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
  const missingHandleKeys: string[] = [];
  for (const featureTable of featureTables) {
    if (!reset && hasIngestedFeatureTable(featureTable.id)) continue;
    const { source } = featureTable;
    if (source.kind === "url") {
      try {
        const bytes = await fetchTableBytes(source.url, opts?.documentUrl);
        await ingestFeatureTable(featureTable.id, bytes);
        noteLut();
      } catch (e) {
        console.error("[featureTable] hydrate failed", featureTable.id, e);
      }
      continue;
    }
    const key = featureTableHandleKey(featureTable);
    if (!key) continue;
    const bytes = await getBlob(key);
    if (!bytes) {
      missingHandleKeys.push(key);
      continue;
    }
    try {
      const ingested = await ingestFeatureTable(featureTable.id, bytes);
      noteLut();
      if (ingested.persist) {
        // Legacy CSV blob. Keep the digest so `nameColors` stay matched.
        await putBlob(key, ingested.persist);
      } else if (featureTable.nameColors.length === 0) {
        scheduleClassPalette(featureTable.id, ingested.names);
      }
    } catch (e) {
      console.error("[featureTable] hydrate failed", featureTable.id, e);
      missingHandleKeys.push(key);
    }
  }
  noteAccess({ missingHandleKeys });
}
