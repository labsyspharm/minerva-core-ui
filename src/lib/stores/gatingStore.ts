import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { SpatialIndex } from "@/lib/gating/spatialIndex";
import type {
  CellFeatureTable,
  DisplayChannelDefinition,
  GateDefinition,
  GateEvalMode,
  GatingDatasetConfig,
  GatingDrawMode,
} from "@/lib/gating/types";
import { MAX_DISPLAY_CHANNELS, MAX_GATES } from "@/lib/gating/types";
import type { Loader } from "@/lib/imaging/viv";

export type GatingLoaderEntry = {
  loader: Loader;
  role: "biomarker" | "mask";
};

export type LassoSelection = {
  id: string;
  polygon: [number, number][];
  mode: "union" | "complement";
};

type GatingState = {
  active: boolean;
  config: GatingDatasetConfig | null;
  cellTable: CellFeatureTable | null;
  spatialIndex: SpatialIndex | null;
  csvHeaders: string[];
  biomarkerLoader: Loader | null;
  maskLoader: Loader | null;
  gates: GateDefinition[];
  displayChannels: DisplayChannelDefinition[];
  evalMode: GateEvalMode;
  outlines: boolean;
  drawMode: GatingDrawMode;
  selectionRowIndices: Set<number> | null;
  lassos: LassoSelection[];
  activeTool: string;
  gatedCount: number;
  textureRevision: number;
};

type GatingActions = {
  setActive: (active: boolean) => void;
  setDataset: (payload: {
    config: GatingDatasetConfig;
    cellTable: CellFeatureTable;
    spatialIndex: SpatialIndex | null;
    csvHeaders: string[];
    biomarkerLoader: Loader;
    maskLoader: Loader;
  }) => void;
  clearDataset: () => void;
  setGate: (index: number, patch: Partial<GateDefinition>) => void;
  setGates: (gates: GateDefinition[]) => void;
  addGate: (column: string) => void;
  removeGate: (index: number) => void;
  setDisplayChannel: (
    index: number,
    patch: Partial<DisplayChannelDefinition>,
  ) => void;
  setEvalMode: (mode: GateEvalMode) => void;
  setOutlines: (outlines: boolean) => void;
  setDrawMode: (mode: GatingDrawMode) => void;
  setSelectionRowIndices: (indices: Set<number> | null) => void;
  addLasso: (lasso: LassoSelection) => void;
  clearLassos: () => void;
  setActiveTool: (tool: string) => void;
  setGatedCount: (n: number) => void;
  bumpTextureRevision: () => void;
};

export type GatingStore = GatingState & GatingActions;

const defaultGates = (): GateDefinition[] => [];

function newGateId(): string {
  return crypto.randomUUID();
}

const initialState: GatingState = {
  active: false,
  config: null,
  cellTable: null,
  spatialIndex: null,
  csvHeaders: [],
  biomarkerLoader: null,
  maskLoader: null,
  gates: defaultGates(),
  displayChannels: [],
  evalMode: "and",
  outlines: false,
  drawMode: "fill_and",
  selectionRowIndices: null,
  lassos: [],
  activeTool: "move",
  gatedCount: 0,
  textureRevision: 0,
};

export const useGatingStore = create<GatingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setActive: (active) => set({ active }),

      setDataset: (payload) =>
        set({
          active: true,
          config: payload.config,
          cellTable: payload.cellTable,
          spatialIndex: payload.spatialIndex,
          csvHeaders: payload.csvHeaders,
          biomarkerLoader: payload.biomarkerLoader,
          maskLoader: payload.maskLoader,
          gates: [],
          displayChannels: payload.config.imageData
            .slice(0, MAX_DISPLAY_CHANNELS)
            .map((m, i) => ({
              id: newGateId(),
              sourceIndex: m.sourceIndex,
              name: m.omeName,
              rgb: paletteRgb(i),
              lowerLimit: 0,
              upperLimit: 65535,
              visible: i < 4,
            })),
          selectionRowIndices: null,
          lassos: [],
          gatedCount: payload.cellTable.rowCount,
          textureRevision: 0,
        }),

      clearDataset: () => set({ ...initialState }),

      setGate: (index, patch) => {
        const gates = [...get().gates];
        if (index < 0 || index >= gates.length) return;
        gates[index] = { ...gates[index], ...patch };
        set({ gates });
        get().bumpTextureRevision();
      },

      setGates: (gates) => {
        set({ gates });
        get().bumpTextureRevision();
      },

      addGate: (column) => {
        const gates = get().gates;
        if (gates.length >= MAX_GATES) return;
        const idx = gates.length;
        set({
          gates: [
            ...gates,
            {
              id: newGateId(),
              column,
              min: 0,
              max: 1,
              rgb: paletteRgb(idx),
              enabled: true,
            },
          ],
        });
        get().bumpTextureRevision();
      },

      removeGate: (index) => {
        set({ gates: get().gates.filter((_, i) => i !== index) });
        get().bumpTextureRevision();
      },

      setDisplayChannel: (index, patch) => {
        const displayChannels = [...get().displayChannels];
        if (index < 0 || index >= displayChannels.length) return;
        displayChannels[index] = { ...displayChannels[index], ...patch };
        set({ displayChannels });
      },

      setEvalMode: (mode) => {
        set({ evalMode: mode });
        get().bumpTextureRevision();
      },

      setOutlines: (outlines) => {
        set({ outlines });
        get().bumpTextureRevision();
      },

      setDrawMode: (mode) => {
        set({ drawMode: mode });
        get().bumpTextureRevision();
      },

      setSelectionRowIndices: (indices) => {
        set({ selectionRowIndices: indices });
        get().bumpTextureRevision();
      },

      addLasso: (lasso) => set((s) => ({ lassos: [...s.lassos, lasso] })),

      clearLassos: () => set({ lassos: [], selectionRowIndices: null }),

      setActiveTool: (tool) => set({ activeTool: tool }),

      setGatedCount: (n) => set({ gatedCount: n }),

      bumpTextureRevision: () =>
        set((s) => ({ textureRevision: s.textureRevision + 1 })),
    }),
    { name: "gating-store" },
  ),
);

function paletteRgb(i: number): [number, number, number] {
  const palette: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 128, 255],
    [255, 200, 0],
  ];
  return palette[i % palette.length];
}
