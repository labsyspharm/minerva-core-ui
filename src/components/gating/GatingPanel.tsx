import * as React from "react";
import styled from "styled-components";
import {
  downloadGatedCsvExport,
  downloadGatesJson,
  parseGatesJsonFile,
} from "@/lib/gating/exportGating";
import { countGatedCells } from "@/lib/gating/gateEval";
import {
  listGatingPresetsForDataset,
  saveGatingPreset,
} from "@/lib/gating/persistence";
import {
  computeColumnHistogram,
  gatingGmm,
  percentileThresholds,
} from "@/lib/gating/stats";
import type { GatingPreset } from "@/lib/gating/types";
import { MAX_GATES } from "@/lib/gating/types";
import { useGatingStore } from "@/lib/stores/gatingStore";
import { GatingGateSlider } from "./GatingGateSlider";

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 10px 8px;
  height: 100%;
  overflow-y: auto;
  background: #000;
  color: #e6edf3;
  font-size: 12px;
`;

const Title = styled.h3`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8899aa;
  margin: 0 0 8px;
`;

const Btn = styled.button`
  background: #2a2a2a;
  border: 1px solid #444;
  color: #e6edf3;
  padding: 6px 10px;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
  &:hover {
    background: #333;
  }
`;

export function GatingPanel() {
  const config = useGatingStore((s) => s.config);
  const cellTable = useGatingStore((s) => s.cellTable);
  const gates = useGatingStore((s) => s.gates);
  const csvHeaders = useGatingStore((s) => s.csvHeaders);
  const evalMode = useGatingStore((s) => s.evalMode);
  const selectionRowIndices = useGatingStore((s) => s.selectionRowIndices);
  const setGate = useGatingStore((s) => s.setGate);
  const setGates = useGatingStore((s) => s.setGates);
  const addGate = useGatingStore((s) => s.addGate);
  const setEvalMode = useGatingStore((s) => s.setEvalMode);
  const setOutlines = useGatingStore((s) => s.setOutlines);
  const outlines = useGatingStore((s) => s.outlines);
  const setGatedCount = useGatingStore((s) => s.setGatedCount);
  const setDrawMode = useGatingStore((s) => s.setDrawMode);
  const drawMode = useGatingStore((s) => s.drawMode);
  const gatedCount = useGatingStore((s) => s.gatedCount);

  const [presetName, setPresetName] = React.useState("");
  const [presets, setPresets] = React.useState<GatingPreset[]>([]);

  React.useEffect(() => {
    if (!config || !cellTable) return;
    const n = countGatedCells(cellTable, gates, evalMode);
    setGatedCount(n);
  }, [config, cellTable, gates, evalMode, setGatedCount]);

  React.useEffect(() => {
    if (!config?.id) return;
    void listGatingPresetsForDataset(config.id).then(setPresets);
  }, [config?.id]);

  if (!config || !cellTable) {
    return (
      <Panel>
        <Title>CSV gates</Title>
        <p>Load a gating dataset to configure gates.</p>
      </Panel>
    );
  }

  const numericColumns = csvHeaders.filter((h) => {
    const col = cellTable.columns.get(h);
    return col && h !== config.idField;
  });

  const onAddGate = () => {
    const used = new Set(gates.map((g) => g.column));
    const next = numericColumns.find((c) => !used.has(c));
    if (next) addGate(next);
  };

  return (
    <Panel>
      <Title>CSV gates ({gatedCount.toLocaleString()} cells)</Title>
      <Row>
        <label>
          <input
            type="radio"
            checked={evalMode === "and"}
            onChange={() => setEvalMode("and")}
          />{" "}
          AND
        </label>
        <label>
          <input
            type="radio"
            checked={evalMode === "or"}
            onChange={() => setEvalMode("or")}
          />{" "}
          OR
        </label>
        <label>
          <input
            type="checkbox"
            checked={outlines}
            onChange={(e) => setOutlines(e.target.checked)}
          />{" "}
          Outlines
        </label>
      </Row>
      <Row>
        <label>
          Fill AND
          <input
            type="radio"
            name="drawMode"
            checked={drawMode === "fill_and"}
            onChange={() => setDrawMode("fill_and")}
          />
        </label>
        <label>
          Fill OR
          <input
            type="radio"
            name="drawMode"
            checked={drawMode === "fill_or"}
            onChange={() => setDrawMode("fill_or")}
          />
        </label>
        <label>
          Edges
          <input
            type="radio"
            name="drawMode"
            checked={drawMode === "edges"}
            onChange={() => setDrawMode("edges")}
          />
        </label>
      </Row>
      {gates.map((gate, i) => {
        const col = cellTable.columns.get(gate.column);
        if (!col) return null;
        const sel =
          selectionRowIndices && selectionRowIndices.size > 0
            ? [...selectionRowIndices]
            : null;
        const hist = computeColumnHistogram(col, sel);
        let dataMin = hist.min;
        let dataMax = hist.max;
        if (dataMin === dataMax) {
          dataMin -= 0.5;
          dataMax += 0.5;
        }
        return (
          <GatingGateSlider
            key={gate.id}
            column={gate.column}
            min={gate.min}
            max={gate.max}
            dataMin={dataMin}
            dataMax={dataMax}
            histogram={hist}
            rgb={gate.rgb}
            enabled={gate.enabled}
            onChange={(min, max) => setGate(i, { min, max })}
            onToggle={(enabled) => setGate(i, { enabled })}
            onAuto={() => {
              const gmm = gatingGmm(cellTable, gate.column, sel);
              const pct = percentileThresholds(col, sel);
              const t = gmm ?? pct;
              if (t) setGate(i, { min: t.min, max: t.max });
            }}
          />
        );
      })}
      {gates.length < MAX_GATES && (
        <Btn type="button" onClick={onAddGate}>
          + Add gate
        </Btn>
      )}
      <Title>Export & presets</Title>
      <Btn
        type="button"
        onClick={() =>
          downloadGatedCsvExport({
            table: cellTable,
            headers: csvHeaders,
            gates,
            mode: evalMode,
            selection: selectionRowIndices,
            datasetName: config.name,
          })
        }
      >
        Download gated CSV
      </Btn>
      <Btn type="button" onClick={() => downloadGatesJson(gates, config.name)}>
        Download gates JSON
      </Btn>
      <input
        type="file"
        accept=".json,application/json"
        style={{ fontSize: 10 }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const text = await f.text();
          const loaded = parseGatesJsonFile(text);
          loaded.forEach((g, i) => {
            setGate(i, g);
          });
        }}
      />
      <input
        type="text"
        placeholder="Preset name"
        value={presetName}
        onChange={(e) => setPresetName(e.target.value)}
        style={{
          background: "#2c2c2c",
          border: "1px solid #444",
          color: "#e6edf3",
          padding: 4,
        }}
      />
      <Btn
        type="button"
        onClick={async () => {
          if (!presetName.trim()) return;
          const preset: GatingPreset = {
            id: crypto.randomUUID(),
            datasetId: config.id,
            name: presetName.trim(),
            gates,
            displayChannels: useGatingStore.getState().displayChannels,
            evalMode,
            outlines,
            savedAt: new Date().toISOString(),
          };
          await saveGatingPreset(preset);
          setPresets(await listGatingPresetsForDataset(config.id));
          setPresetName("");
        }}
      >
        Save preset
      </Btn>
      {presets.map((p) => (
        <Btn
          key={p.id}
          type="button"
          onClick={() => {
            setGates(p.gates);
            setEvalMode(p.evalMode);
            setOutlines(p.outlines);
          }}
        >
          Load: {p.name}
        </Btn>
      ))}
    </Panel>
  );
}

const Row = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
`;
