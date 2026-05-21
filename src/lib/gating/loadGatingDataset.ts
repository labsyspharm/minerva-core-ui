import { toLoader } from "@/lib/imaging/filesystem";
import { loaderPixelSizeXY } from "@/lib/imaging/viv";
import type { PoolClass } from "@/lib/imaging/workers/Pool";
import { putFileHandle } from "@/lib/persistence/fileHandles";
import { useGatingStore } from "@/lib/stores/gatingStore";
import {
  csvHeadersFromText,
  loadCellTableFromHandle,
  parseCellCsv,
} from "./cellTable";
import {
  type GatingDatasetRecord,
  gatingHandleKey,
  saveGatingDataset,
} from "./persistence";
import { buildSpatialIndex } from "./spatialIndex";
import { percentileThresholds } from "./stats";
import type { GatingDatasetConfig, GatingImageChannelMapping } from "./types";

export type GatingImportFiles = {
  name: string;
  biomarkerHandle: Handle.File;
  maskHandle: Handle.File;
  csvHandle: Handle.File;
  idField: string;
  xCoordinate?: string;
  yCoordinate?: string;
  imageData: GatingImageChannelMapping[];
  log1pColumns?: string[];
};

export async function importGatingDataset(
  files: GatingImportFiles,
  pool?: PoolClass,
): Promise<string> {
  const datasetId = crypto.randomUUID();
  const now = new Date().toISOString();

  await putFileHandle(
    gatingHandleKey(datasetId, "biomarker"),
    files.biomarkerHandle,
  );
  await putFileHandle(gatingHandleKey(datasetId, "mask"), files.maskHandle);
  await putFileHandle(gatingHandleKey(datasetId, "csv"), files.csvHandle);

  const biomarkerLoader = await toLoader({
    in_f: files.biomarkerHandle.name,
    handle: files.biomarkerHandle,
    pool: pool ?? undefined,
  });
  const maskLoader = await toLoader({
    in_f: files.maskHandle.name,
    handle: files.maskHandle,
    pool: pool ?? undefined,
  });

  const size = loaderPixelSizeXY(biomarkerLoader) ?? { sizeX: 0, sizeY: 0 };

  const csvFile = await files.csvHandle.getFile();
  const csvText = await csvFile.text();
  const cellTable = parseCellCsv(csvText, {
    idField: files.idField,
    xField: files.xCoordinate || undefined,
    yField: files.yCoordinate || undefined,
    log1pColumns: files.log1pColumns,
  });

  const xs = files.xCoordinate
    ? cellTable.columns.get(files.xCoordinate)
    : null;
  const ys = files.yCoordinate
    ? cellTable.columns.get(files.yCoordinate)
    : null;
  if (xs && ys && size.sizeX > 0 && size.sizeY > 0) {
    let warnCount = 0;
    for (let i = 0; i < cellTable.rowCount && warnCount < 5; i++) {
      const x = xs[i];
      const y = ys[i];
      if (x < 0 || y < 0 || x > size.sizeX || y > size.sizeY) {
        console.warn(
          `[gating] cell ${i} (${x}, ${y}) outside image ${size.sizeX}x${size.sizeY}`,
        );
        warnCount++;
      }
    }
  }

  const spatialIndex =
    files.xCoordinate && files.yCoordinate
      ? buildSpatialIndex(cellTable, files.xCoordinate, files.yCoordinate)
      : null;
  const csvHeaders = csvHeadersFromText(csvText);

  const config: GatingDatasetConfig = {
    id: datasetId,
    name: files.name,
    idField: files.idField,
    xCoordinate: files.xCoordinate ?? "",
    yCoordinate: files.yCoordinate ?? "",
    imageData: files.imageData,
    biomarkerHandleKey: gatingHandleKey(datasetId, "biomarker"),
    maskHandleKey: gatingHandleKey(datasetId, "mask"),
    csvHandleKey: gatingHandleKey(datasetId, "csv"),
    sizeX: size.sizeX,
    sizeY: size.sizeY,
    log1pColumns: files.log1pColumns,
    createdAt: now,
    modifiedAt: now,
  };

  await saveGatingDataset({
    id: datasetId,
    config,
    modifiedAt: now,
  });

  useGatingStore.getState().setDataset({
    config,
    cellTable,
    spatialIndex,
    csvHeaders,
    biomarkerLoader,
    maskLoader,
  });

  const store = useGatingStore.getState();
  if (files.imageData.length > 0) {
    const gates = files.imageData.map((m, i) => ({
      id: crypto.randomUUID(),
      column: m.csvColumn,
      min: 0,
      max: 1,
      rgb: [
        [255, 0, 0],
        [0, 255, 0],
        [0, 128, 255],
        [255, 200, 0],
      ][i % 4] as [number, number, number],
      enabled: true,
    }));
    for (let i = 0; i < gates.length; i++) {
      const col = cellTable.columns.get(gates[i].column);
      if (col) {
        const t = percentileThresholds(col, null);
        if (t) {
          gates[i] = { ...gates[i], min: t.min, max: t.max };
        }
      }
    }
    store.setGates(gates);
  }

  return datasetId;
}

export async function restoreGatingDataset(
  record: GatingDatasetRecord,
  handles: {
    biomarker: Handle.File;
    mask: Handle.File;
    csv: Handle.File;
  },
  pool?: PoolClass,
): Promise<void> {
  const { config } = record;
  const biomarkerLoader = await toLoader({
    in_f: handles.biomarker.name,
    handle: handles.biomarker,
    pool: pool ?? undefined,
  });
  const maskLoader = await toLoader({
    in_f: handles.mask.name,
    handle: handles.mask,
    pool: pool ?? undefined,
  });
  const cellTable = await loadCellTableFromHandle(handles.csv, config);
  const spatialIndex =
    config.xCoordinate && config.yCoordinate
      ? buildSpatialIndex(cellTable, config.xCoordinate, config.yCoordinate)
      : null;
  const csvFile = await handles.csv.getFile();
  const csvHeaders = csvHeadersFromText(await csvFile.text());

  useGatingStore.getState().setDataset({
    config,
    cellTable,
    spatialIndex,
    csvHeaders,
    biomarkerLoader,
    maskLoader,
  });
}
