import {
  ensureFileHandlePermission,
  ephemeralFileHandleFromFile,
  findFile,
  hasFileHandlePermission,
} from "@/lib/imaging/filesystem";
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
import {
  deleteFileHandle,
  getFileHandle,
  putFileHandle,
} from "@/lib/persistence/fileHandles";
import { useAppStore } from "@/lib/stores/appStore";
import type { Color, FeatureTable } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  dropFeatureTable,
  fetchClassIndex,
  hasIngestedFeatureTable,
  ingestFeatureTable,
  peekClassIndex,
  resetFeatureTables,
} from "./client";
import { MAX_CLASS_NAMES } from "./lutLayout";

export {
  getFeatureTableIngestEpoch,
  hasIngestedFeatureTable,
  pageFeatureTable,
  peekClassIndex,
  subscribeFeatureTableIngest,
} from "./client";
export { peekFeatureCsv } from "./columns";

type FeatureTableColumns = { id: string; name: string };

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
  deniedHandleKeys: readonly string[];
  missingHandleKeys: readonly string[];
};

const emptyAccess: FeatureTableAccess = {
  deniedHandleKeys: [],
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

async function dropStoredSource(handleKey: string): Promise<void> {
  await deleteBlob(handleKey).catch(() => undefined);
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
  void optimizeDistinctPalette(names.length)
    .then((palette) => {
      if (paletteJobs.get(featureTableId) !== job) return;
      applyNameColors(
        featureTableId,
        names.map((name, i) => ({
          name,
          color: palette[i] ?? seedRgbForGroupChannelIndex(i),
        })),
      );
    })
    .catch((e) => {
      console.warn("[featureTable] class palette failed", e);
      if (paletteJobs.get(featureTableId) !== job) return;
      applyNameColors(
        featureTableId,
        names.map((name, i) => ({
          name,
          color: seedRgbForGroupChannelIndex(i),
        })),
      );
    })
    .finally(() => {
      if (paletteJobs.get(featureTableId) === job)
        paletteJobs.delete(featureTableId);
    });
}

function cancelClassPalette(featureTableId: string) {
  paletteJobs.delete(featureTableId);
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

function paletteRev(
  featureTable: FeatureTable,
  vis: ClassVisibility | undefined,
  seed: number,
): string {
  const visPart =
    !vis || vis.mode === "all" ? "all" : `${vis.mode}:${vis.names.join("\0")}`;
  const colors = featureTable.nameColors
    .map((c) => `${c.name}:${c.color.r},${c.color.g},${c.color.b}`)
    .join(";");
  return `${featureTable.digest}:${seed}:${visPart}:${colors}`;
}

function ensureIndex(featureTableId: string) {
  if (peekClassIndex(featureTableId) || lutPending.has(featureTableId)) return;
  lutPending.add(featureTableId);
  void fetchClassIndex(featureTableId)
    .catch((e) => {
      console.error("[featureTable] class index failed", e);
    })
    .finally(() => {
      lutPending.delete(featureTableId);
      noteLut();
    });
}

export function gpuStyleForFeatureTable(
  featureTable: FeatureTable,
  vis: ClassVisibility | undefined,
  seed: number,
): MaskGpuStyle | undefined {
  const idx = peekClassIndex(featureTable.id);
  if (!idx) {
    ensureIndex(featureTable.id);
    return undefined;
  }
  const colors = new Map(featureTable.nameColors.map((c) => [c.name, c.color]));
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
    rev: paletteRev(featureTable, vis, seed),
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
  columns: FeatureTableColumns;
  header: boolean;
  handle: Handle.File;
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
        columns: ingested.columns,
        header: ingested.header,
        handle:
          (file as File & { handle?: Handle.File }).handle ??
          ephemeralFileHandleFromFile(file),
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
    cancelClassPalette(existing.id);
    await dropFeatureTable(existing.id).catch(() => undefined);
    await dropStoredSource(existing.source.handleKey);
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
  await putFileHandle(handleKey, ingested.handle);
  await putBlob(handleKey, ingested.persist);
  const featureTable: FeatureTable = {
    id: ingested.featureTableId,
    sourceChannelId,
    source: { handleKey },
    maxClassId: ingested.maxClassId,
    nameColors,
    digest: ingested.digest,
    columns: ingested.columns,
    header: ingested.header,
  };
  const doc = useDocumentStore.getState();
  const next = existing
    ? doc.featureTables.map((c) => (c.id === existing.id ? featureTable : c))
    : [...doc.featureTables, featureTable];
  doc.setFeatureTables(next);
  const vis = { ...useAppStore.getState().featureTableVisibilities };
  if (existing) delete vis[existing.id];
  vis[ingested.featureTableId] =
    vis[ingested.featureTableId] ?? visibilityAllOn();
  useAppStore.setState({ featureTableVisibilities: vis });
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
  cancelClassPalette(featureTable.id);
  await dropFeatureTable(featureTable.id).catch(() => undefined);
  await dropStoredSource(featureTable.source.handleKey);
  const doc = useDocumentStore.getState();
  if (doc.featureTables.some((c) => c.id === featureTable.id)) {
    doc.setFeatureTables(
      doc.featureTables.filter((c) => c.id !== featureTable.id),
    );
  }
  const vis = { ...useAppStore.getState().featureTableVisibilities };
  delete vis[featureTable.id];
  useAppStore.setState({ featureTableVisibilities: vis });
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

export function toggleClassVisible(featureTableId: string, name: string): void {
  const vis = { ...useAppStore.getState().featureTableVisibilities };
  vis[featureTableId] = toggleClassName(vis[featureTableId], name);
  useAppStore.setState({ featureTableVisibilities: vis });
}

export function setAllClassesVisible(
  featureTableId: string,
  visible: boolean,
): void {
  const vis = { ...useAppStore.getState().featureTableVisibilities };
  vis[featureTableId] = visible ? visibilityAllOn() : visibilityAllOff();
  useAppStore.setState({ featureTableVisibilities: vis });
}

export function setClassColor(
  featureTableId: string,
  name: string,
  color: Color,
): void {
  const doc = useDocumentStore.getState();
  doc.setFeatureTables(
    doc.featureTables.map((c) => {
      if (c.id !== featureTableId) return c;
      const i = c.nameColors.findIndex((o) => o.name === name);
      if (i >= 0) {
        const nameColors = c.nameColors.slice();
        nameColors[i] = { name, color };
        return { ...c, nameColors };
      }
      return {
        ...c,
        nameColors: [...c.nameColors, { name, color }],
      };
    }),
  );
}

export async function hydrateFeatureTables(
  featureTables: readonly FeatureTable[],
  reset: boolean,
  opts?: { requestPermission?: boolean },
): Promise<void> {
  if (reset) {
    lutPending.clear();
    await resetFeatureTables();
  }
  const deniedHandleKeys: string[] = [];
  const missingHandleKeys: string[] = [];
  const canAccess = opts?.requestPermission
    ? ensureFileHandlePermission
    : hasFileHandlePermission;
  const ingestSource = async (
    featureTable: FeatureTable,
    source: File | Uint8Array,
  ) => {
    const ingested = await ingestFeatureTable(featureTable.id, source, {
      id: featureTable.columns.id,
      name: featureTable.columns.name,
      header: featureTable.header,
    });
    noteLut();
    if (featureTable.nameColors.length === 0) {
      scheduleClassPalette(featureTable.id, ingested.names);
    }
  };
  for (const featureTable of featureTables) {
    if (!reset && hasIngestedFeatureTable(featureTable.id)) continue;
    const key = featureTable.source.handleKey;
    const stored = await getFileHandle(key);
    if (stored) {
      const handle = stored as Handle.File;
      if (!(await canAccess(handle))) {
        deniedHandleKeys.push(key);
        continue;
      }
      try {
        if (!(await findFile({ handle }))) {
          missingHandleKeys.push(key);
          continue;
        }
        await ingestSource(featureTable, await handle.getFile());
      } catch (e) {
        console.error("[featureTable] hydrate failed", featureTable.id, e);
        missingHandleKeys.push(key);
      }
      continue;
    }
    const bytes = await getBlob(key);
    if (bytes) {
      try {
        await ingestSource(featureTable, bytes);
      } catch (e) {
        console.error("[featureTable] hydrate failed", featureTable.id, e);
        missingHandleKeys.push(key);
      }
      continue;
    }
    missingHandleKeys.push(key);
  }
  noteAccess({ deniedHandleKeys, missingHandleKeys });
}

export async function requestFeatureTableFileAccess(): Promise<void> {
  await hydrateFeatureTables(useDocumentStore.getState().featureTables, false, {
    requestPermission: true,
  });
}
