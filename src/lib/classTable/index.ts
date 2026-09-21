import {
  type ClassVisibility,
  defaultClassColor,
  type MaskGpuStyle,
} from "@/lib/imaging/maskLayers";
import { optimizeDistinctPalette } from "@/lib/imaging/psudoPalette";
import { deleteBlob, getBlob, putBlob } from "@/lib/persistence/db";
import { useAppStore } from "@/lib/stores/appStore";
import type { ClassTable, Color } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  dropClassTable,
  ingestClassTable,
  rebuildClassTableLut,
  resetClassTables,
} from "./client";

export {
  getClassTableIngestEpoch,
  pageClassTable,
  subscribeClassTableIngest,
} from "./client";
export { peekClassCsv } from "./columns";

type ClassTableColumns = { id: string; name: string };

type AttachClassTableResult =
  | { ok: true; classTable: ClassTable }
  | { ok: false; error: string };

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

function asColumns(
  c: { id?: string; name?: string } | undefined,
): ClassTableColumns | undefined {
  return c?.id && c?.name ? { id: c.id, name: c.name } : undefined;
}

function classTableForChannel(sourceChannelId: string): ClassTable | undefined {
  return useDocumentStore
    .getState()
    .classTables.find((c) => c.sourceChannelId === sourceChannelId);
}

async function nameColorsFromNames(
  names: readonly string[],
): Promise<ClassTable["nameColors"]> {
  const palette = await optimizeDistinctPalette(names.length);
  return names.map((name, i) => ({
    name,
    color: palette[i] ?? { r: 128, g: 128, b: 128 },
  }));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const lutCache = new Map<string, MaskGpuStyle>();
const lutPending = new Map<string, string>();
let lutEpoch = 0;
const lutListeners = new Set<() => void>();

export function subscribeClassTableLut(onStoreChange: () => void): () => void {
  lutListeners.add(onStoreChange);
  return () => {
    lutListeners.delete(onStoreChange);
  };
}

export function getClassTableLutEpoch(): number {
  return lutEpoch;
}

function noteLut() {
  lutEpoch += 1;
  for (const fn of lutListeners) fn();
}

function clearLut(classTableId: string) {
  lutCache.delete(classTableId);
  lutPending.delete(classTableId);
}

function lutRev(
  classTable: ClassTable,
  vis: ClassVisibility | undefined,
  seed: number,
): string {
  const visPart =
    !vis || vis.mode === "all" ? "all" : `${vis.mode}:${vis.names.join("\0")}`;
  const colors = classTable.nameColors
    .map((c) => `${c.name}:${c.color.r},${c.color.g},${c.color.b}`)
    .join(";");
  return `${classTable.digest}:${seed}:${visPart}:${colors}`;
}

function fallbackStyle(
  classTable: ClassTable,
  vis: ClassVisibility | undefined,
  seed: number,
  rev: string,
): MaskGpuStyle {
  const maxClassId = classTable.maxClassId;
  if (maxClassId + 1 > 1_048_576) {
    return {
      strategy: "sparse",
      missHidden: vis?.mode === "show",
      overrides: new Uint32Array(32),
      rev,
    };
  }
  const unnamedAlpha = vis?.mode === "show" ? 0 : 255;
  const width = Math.min(1024, Math.max(1, maxClassId + 1));
  const height = Math.max(1, Math.ceil((maxClassId + 1) / width));
  const rgba = new Uint8Array(width * height * 4);
  for (let id = 1; id <= maxClassId; id++) {
    const color = defaultClassColor(id, seed);
    const x = id % width;
    const y = Math.floor(id / width);
    const i = (y * width + x) * 4;
    rgba[i] = color.r;
    rgba[i + 1] = color.g;
    rgba[i + 2] = color.b;
    rgba[i + 3] = unnamedAlpha;
  }
  return { strategy: "denseLut", rgba, width, height, rev };
}

function ensureLut(
  classTable: ClassTable,
  vis: ClassVisibility | undefined,
  seed: number,
  rev: string,
) {
  if (lutPending.get(classTable.id) === rev) return;
  lutPending.set(classTable.id, rev);
  void rebuildClassTableLut({
    classTableId: classTable.id,
    maxClassId: classTable.maxClassId,
    seed,
    nameColors: classTable.nameColors.map((c) => ({
      name: c.name,
      r: c.color.r,
      g: c.color.g,
      b: c.color.b,
    })),
    vis,
    rev,
  })
    .then((style) => {
      if (lutPending.get(classTable.id) !== rev) return;
      lutCache.set(classTable.id, style);
      noteLut();
    })
    .catch(() => {
      if (lutPending.get(classTable.id) === rev)
        lutPending.delete(classTable.id);
    });
}

export function gpuStyleForClassTable(
  classTable: ClassTable,
  vis: ClassVisibility | undefined,
  seed: number,
): MaskGpuStyle {
  const rev = lutRev(classTable, vis, seed);
  const hit = lutCache.get(classTable.id);
  if (hit && hit.strategy !== "plane" && hit.rev === rev) return hit;
  ensureLut(classTable, vis, seed, rev);
  return hit ?? fallbackStyle(classTable, vis, seed, `pending:${rev}`);
}

export async function attachClassTable(input: {
  sourceChannelId: string;
  file: File;
  columns?: ClassTableColumns;
}): Promise<AttachClassTableResult> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await input.file.arrayBuffer());
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not read class CSV",
    };
  }
  const digest = await sha256Hex(bytes);
  const existing = classTableForChannel(input.sourceChannelId);
  if (
    existing &&
    existing.digest === digest &&
    existing.columns?.id === input.columns?.id &&
    existing.columns?.name === input.columns?.name
  ) {
    try {
      const ingested = await ingestClassTable(
        existing.id,
        bytes,
        input.columns ?? asColumns(existing.columns),
      );
      clearLut(existing.id);
      if (existing.nameColors.length === 0) {
        const nameColors = await nameColorsFromNames(ingested.names);
        const classTable = { ...existing, nameColors };
        const doc = useDocumentStore.getState();
        doc.setClassTables(
          doc.classTables.map((c) => (c.id === classTable.id ? classTable : c)),
        );
        return { ok: true, classTable };
      }
    } catch {
      /* already attached */
    }
    return { ok: true, classTable: existing };
  }

  const classTableId = existing?.id ?? crypto.randomUUID();
  let maxClassId: number;
  let nameColors: ClassTable["nameColors"] = [];
  try {
    const ingested = await ingestClassTable(classTableId, bytes, input.columns);
    maxClassId = ingested.maxClassId;
    try {
      nameColors = await nameColorsFromNames(ingested.names);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[psudo] class palette failed", e);
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not index class CSV",
    };
  }

  const storyId = useDocumentStore.getState().activeStoryId;
  const handleKey = storyId
    ? `story:${storyId}:classTable:${classTableId}`
    : `classTable:${classTableId}`;
  await putBlob(handleKey, bytes);
  const classTable: ClassTable = {
    id: classTableId,
    sourceChannelId: input.sourceChannelId,
    source: { handleKey },
    maxClassId,
    nameColors,
    digest,
    ...(input.columns ? { columns: input.columns } : {}),
  };
  clearLut(classTableId);
  const doc = useDocumentStore.getState();
  const next = existing
    ? doc.classTables.map((c) => (c.id === classTableId ? classTable : c))
    : [...doc.classTables, classTable];
  doc.setClassTables(next);
  const vis = { ...useAppStore.getState().classTableVisibilities };
  vis[classTableId] = visibilityAllOn();
  useAppStore.setState({ classTableVisibilities: vis });
  return { ok: true, classTable };
}

export async function detachClassTable(sourceChannelId: string): Promise<void> {
  const classTable = classTableForChannel(sourceChannelId);
  if (!classTable) return;
  clearLut(classTable.id);
  await dropClassTable(classTable.id).catch(() => undefined);
  await deleteBlob(classTable.source.handleKey).catch(() => undefined);
  const doc = useDocumentStore.getState();
  if (doc.classTables.some((c) => c.id === classTable.id)) {
    doc.setClassTables(doc.classTables.filter((c) => c.id !== classTable.id));
  }
  const vis = { ...useAppStore.getState().classTableVisibilities };
  delete vis[classTable.id];
  useAppStore.setState({ classTableVisibilities: vis });
}

export function detachRemovedClassTables(
  previous: readonly ClassTable[],
  remaining: readonly ClassTable[],
): void {
  for (const classTable of previous) {
    if (remaining.some((c) => c.id === classTable.id)) continue;
    void detachClassTable(classTable.sourceChannelId);
  }
  useDocumentStore.getState().setClassTables([...remaining]);
}

export function toggleClassVisible(classTableId: string, name: string): void {
  const vis = { ...useAppStore.getState().classTableVisibilities };
  vis[classTableId] = toggleClassName(vis[classTableId], name);
  useAppStore.setState({ classTableVisibilities: vis });
}

export function setAllClassesVisible(
  classTableId: string,
  visible: boolean,
): void {
  const vis = { ...useAppStore.getState().classTableVisibilities };
  vis[classTableId] = visible ? visibilityAllOn() : visibilityAllOff();
  useAppStore.setState({ classTableVisibilities: vis });
}

export function setClassColor(
  classTableId: string,
  name: string,
  color: Color,
): void {
  const doc = useDocumentStore.getState();
  doc.setClassTables(
    doc.classTables.map((c) => {
      if (c.id !== classTableId) return c;
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

export async function hydrateClassTables(
  classTables: readonly ClassTable[],
  reset: boolean,
): Promise<void> {
  if (reset) {
    lutCache.clear();
    lutPending.clear();
    await resetClassTables();
  }
  const next = [...classTables];
  let changed = false;
  for (let i = 0; i < next.length; i++) {
    const classTable = next[i];
    const bytes = await getBlob(classTable.source.handleKey);
    if (!bytes) continue;
    try {
      const ingested = await ingestClassTable(
        classTable.id,
        bytes,
        asColumns(classTable.columns),
      );
      clearLut(classTable.id);
      if (classTable.nameColors.length > 0) continue;
      next[i] = {
        ...classTable,
        nameColors: await nameColorsFromNames(ingested.names),
      };
      changed = true;
    } catch {
      // Skip tables whose CSV no longer parses; GPU still uses persisted maxClassId.
    }
  }
  if (changed) useDocumentStore.getState().setClassTables(next);
}
