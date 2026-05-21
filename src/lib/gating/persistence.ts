import { storyDb } from "@/lib/persistence/db";
import type { GatingDatasetConfig, GatingPreset } from "./types";

export type GatingDatasetRecord = {
  id: string;
  config: GatingDatasetConfig;
  modifiedAt: string;
};

export async function saveGatingDataset(
  record: GatingDatasetRecord,
): Promise<void> {
  await storyDb.gatingDatasets.put(record);
}

export async function loadGatingDataset(
  id: string,
): Promise<GatingDatasetRecord | undefined> {
  return storyDb.gatingDatasets.get(id);
}

export async function listGatingDatasetSummaries(): Promise<
  { id: string; name: string; modifiedAt: string }[]
> {
  const rows = await storyDb.gatingDatasets
    .orderBy("modifiedAt")
    .reverse()
    .toArray();
  return rows.map((r) => ({
    id: r.id,
    name: r.config.name,
    modifiedAt: r.modifiedAt,
  }));
}

export async function deleteGatingDataset(id: string): Promise<void> {
  await storyDb.gatingDatasets.delete(id);
  await storyDb.gatingPresets.where("datasetId").equals(id).delete();
}

export async function saveGatingPreset(preset: GatingPreset): Promise<void> {
  await storyDb.gatingPresets.put(preset);
}

export async function listGatingPresetsForDataset(
  datasetId: string,
): Promise<GatingPreset[]> {
  return storyDb.gatingPresets.where("datasetId").equals(datasetId).toArray();
}

export async function deleteGatingPreset(id: string): Promise<void> {
  await storyDb.gatingPresets.delete(id);
}

/** Dexie handle keys for gating file bundles (not story-scoped). */
export function gatingHandleKey(
  datasetId: string,
  role: "biomarker" | "mask" | "csv",
): string {
  return `gating:${datasetId}:${role}`;
}
