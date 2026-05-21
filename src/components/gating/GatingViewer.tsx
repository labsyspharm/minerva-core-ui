import {
  type Layer,
  OrthographicView,
  type OrthographicViewState,
} from "@deck.gl/core";
import { PolygonLayer } from "@deck.gl/layers";
import Deck from "@deck.gl/react";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import * as React from "react";
import styled from "styled-components";
import { createGatingMaskLayers } from "@/lib/gating/gatingMaskLayers";
import { getCellsInLassos } from "@/lib/gating/lassoSelection";
import { useGatingStore } from "@/lib/stores/gatingStore";
import { ORTHO_VIEW_ID } from "@/lib/viewer/deckViewIds";

const Main = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  background: #0d1117;
`;

export function GatingViewer() {
  const biomarkerLoader = useGatingStore((s) => s.biomarkerLoader);
  const maskLoader = useGatingStore((s) => s.maskLoader);
  const cellTable = useGatingStore((s) => s.cellTable);
  const config = useGatingStore((s) => s.config);
  const gates = useGatingStore((s) => s.gates);
  const evalMode = useGatingStore((s) => s.evalMode);
  const outlines = useGatingStore((s) => s.outlines);
  const selectionRowIndices = useGatingStore((s) => s.selectionRowIndices);
  const textureRevision = useGatingStore((s) => s.textureRevision);
  const displayChannels = useGatingStore((s) => s.displayChannels);
  const spatialIndex = useGatingStore((s) => s.spatialIndex);
  const lassos = useGatingStore((s) => s.lassos);
  const drawMode = useGatingStore((s) => s.drawMode);
  const activeTool = useGatingStore((s) => s.activeTool);
  const setSelectionRowIndices = useGatingStore(
    (s) => s.setSelectionRowIndices,
  );
  const addLasso = useGatingStore((s) => s.addLasso);
  const setActiveTool = useGatingStore((s) => s.setActiveTool);

  const [viewState, setViewState] = React.useState<OrthographicViewState>({
    target: [0, 0, 0],
    zoom: 0,
  });
  const [lassoPoints, setLassoPoints] = React.useState<[number, number][]>([]);
  const [isLassoDrawing, setIsLassoDrawing] = React.useState(false);

  React.useEffect(() => {
    if (!config) return;
    const sx = config.sizeX || 4096;
    const sy = config.sizeY || 4096;
    setViewState((vs) => ({
      ...vs,
      target: [sx / 2, sy / 2, 0],
      zoom: Math.log2(Math.min(800 / sx, 600 / sy)),
    }));
  }, [config]);

  const finishLasso = React.useCallback(
    (points: [number, number][]) => {
      if (!spatialIndex || points.length < 3) return;
      const lasso = {
        id: crypto.randomUUID(),
        polygon: points,
        mode: "union" as const,
      };
      addLasso(lasso);
      const indices = getCellsInLassos(spatialIndex, [...lassos, lasso]);
      setSelectionRowIndices(indices);
      setLassoPoints([]);
      setIsLassoDrawing(false);
    },
    [spatialIndex, lassos, addLasso, setSelectionRowIndices],
  );

  const biomarkerLayers = React.useMemo(() => {
    if (!biomarkerLoader) return [];
    const visible = displayChannels.filter((d) => d.visible);
    if (visible.length === 0) return [];
    return [
      new MultiscaleImageLayer({
        id: "gating-biomarker",
        loader: biomarkerLoader,
        selections: visible.map((d) => ({
          c: d.sourceIndex,
          z: 0,
          t: 0,
        })),
        colors: visible.map((d) => d.rgb),
        contrastLimits: visible.map(
          (d) => [d.lowerLimit, d.upperLimit] as [number, number],
        ),
        channelsVisible: visible.map(() => true),
      } as never),
    ];
  }, [biomarkerLoader, displayChannels]);

  const maskLayers = React.useMemo(() => {
    if (!maskLoader || !cellTable) return [];
    return createGatingMaskLayers({
      maskLoader,
      cellTable,
      gates,
      evalMode,
      selection: selectionRowIndices,
      outlines,
      drawMode,
      revision: textureRevision,
    });
  }, [
    maskLoader,
    cellTable,
    gates,
    evalMode,
    selectionRowIndices,
    outlines,
    drawMode,
    textureRevision,
  ]);

  const lassoPreviewLayer = React.useMemo(() => {
    if (lassoPoints.length < 2) return null;
    const ring = [...lassoPoints, lassoPoints[0]];
    return new PolygonLayer({
      id: "gating-lasso-preview",
      data: [{ polygon: ring }],
      getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
      getFillColor: [255, 200, 0, 40],
      getLineColor: [255, 200, 0, 220],
      getLineWidth: 2,
      pickable: false,
    });
  }, [lassoPoints]);

  const allLayers = React.useMemo(() => {
    const layers: Layer[] = [...biomarkerLayers, ...maskLayers];
    if (lassoPreviewLayer) layers.push(lassoPreviewLayer);
    return layers;
  }, [biomarkerLayers, maskLayers, lassoPreviewLayer]);

  const onPointer =
    (type: "dragStart" | "drag" | "dragEnd") =>
    (info: { coordinate?: number[] }) => {
      if (activeTool !== "gating-lasso" || !info.coordinate) return;
      const [x, y] = info.coordinate;
      const pt: [number, number] = [x, y];
      if (type === "dragStart") {
        setIsLassoDrawing(true);
        setLassoPoints([pt]);
      } else if (type === "drag" && isLassoDrawing) {
        setLassoPoints((prev) => [...prev, pt]);
      } else if (type === "dragEnd" && isLassoDrawing) {
        setLassoPoints((prev) => {
          const final: [number, number][] = [...prev, pt];
          if (final.length >= 3) finishLasso(final);
          return [];
        });
        setIsLassoDrawing(false);
      }
    };

  if (!config || !biomarkerLoader) {
    return (
      <Main>
        <p style={{ padding: 16, color: "#8899aa" }}>
          Import a gating dataset to view biomarkers and segmentation.
        </p>
      </Main>
    );
  }

  return (
    <Main>
      <Deck
        views={new OrthographicView({ id: ORTHO_VIEW_ID, controller: true })}
        viewState={
          { [ORTHO_VIEW_ID]: viewState } as Record<
            string,
            OrthographicViewState
          >
        }
        onViewStateChange={({ viewState: vs }) => {
          const map = vs as unknown as Record<string, OrthographicViewState>;
          const next = map[ORTHO_VIEW_ID];
          if (next) setViewState(next);
        }}
        layers={allLayers}
        controller={{
          dragPan: activeTool === "move",
          dragRotate: false,
        }}
        onDragStart={onPointer("dragStart")}
        onDrag={onPointer("drag")}
        onDragEnd={onPointer("dragEnd")}
      />
      <Toolbar>
        <button
          type="button"
          className={activeTool === "move" ? "active" : ""}
          onClick={() => setActiveTool("move")}
        >
          Pan
        </button>
        <button
          type="button"
          className={activeTool === "gating-lasso" ? "active" : ""}
          onClick={() => setActiveTool("gating-lasso")}
          disabled={!spatialIndex}
          title={
            spatialIndex
              ? "Lasso to select cells"
              : "Lasso unavailable — re-import with X / Y centroid columns"
          }
        >
          Lasso
        </button>
        <button
          type="button"
          onClick={() => {
            useGatingStore.getState().clearLassos();
          }}
        >
          Clear selection
        </button>
      </Toolbar>
    </Main>
  );
}

const Toolbar = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 4px;
  z-index: 3;
  button {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #e6edf3;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    &.active {
      border-color: #6af;
    }
  }
`;
