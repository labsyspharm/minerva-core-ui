/** RGB 0–255 per gate / display channel. */
export type RgbTriplet = [number, number, number];

export type GatingImageChannelMapping = {
  /** CSV column header */
  csvColumn: string;
  /** OME channel short name or index label */
  omeName: string;
  /** Source channel index in biomarker loader */
  sourceIndex: number;
};

export type GatingDatasetConfig = {
  id: string;
  name: string;
  idField: string;
  xCoordinate: string;
  yCoordinate: string;
  areaField?: string;
  imageData: GatingImageChannelMapping[];
  biomarkerHandleKey: string;
  maskHandleKey: string;
  csvHandleKey: string;
  sizeX: number;
  sizeY: number;
  tileSize?: number;
  log1pColumns?: string[];
  createdAt: string;
  modifiedAt: string;
};

export type GateDefinition = {
  id: string;
  column: string;
  min: number;
  max: number;
  rgb: RgbTriplet;
  enabled: boolean;
};

export type DisplayChannelDefinition = {
  id: string;
  sourceIndex: number;
  name: string;
  rgb: RgbTriplet;
  lowerLimit: number;
  upperLimit: number;
  visible: boolean;
};

export type GateEvalMode = "and" | "or";

export type GatingDrawMode = "fill_and" | "fill_or" | "edges" | "pick";

export type CellFeatureTable = {
  rowCount: number;
  columns: Map<string, Float32Array>;
  ids: Uint32Array | string[];
  idToIndex: Map<number | string, number>;
  numericIds: boolean;
};

export type GatingPreset = {
  id: string;
  datasetId: string;
  name: string;
  gates: GateDefinition[];
  displayChannels: DisplayChannelDefinition[];
  evalMode: GateEvalMode;
  outlines: boolean;
  savedAt: string;
};

export const MAX_GATES = 4;
export const MAX_DISPLAY_CHANNELS = 4;

/** WebGL 1D texture width cap (power of two); document for large cohorts. */
export const GATING_TEXTURE_MAX_CELLS = 1_048_576;
