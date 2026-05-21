import * as React from "react";
import styled from "styled-components";
import type { ColumnHistogram } from "@/lib/gating/stats";

const Wrap = styled.div`
  margin-bottom: 1rem;
  padding: 8px;
  background: #111;
  border: 1px solid #333;
  border-radius: 4px;
`;

const HistSvg = styled.svg`
  width: 100%;
  height: 48px;
  display: block;
  margin-bottom: 6px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const Label = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #8899aa;
  min-width: 80px;
`;

type Props = {
  column: string;
  min: number;
  max: number;
  dataMin: number;
  dataMax: number;
  histogram: ColumnHistogram | null;
  rgb: [number, number, number];
  enabled: boolean;
  onChange: (min: number, max: number) => void;
  onAuto: () => void;
  onToggle: (enabled: boolean) => void;
};

export function GatingGateSlider(props: Props) {
  const span = props.dataMax - props.dataMin || 1;
  const hist = props.histogram;

  const bars = React.useMemo(() => {
    if (!hist || hist.sampleCount === 0) return null;
    const maxBin = Math.max(...hist.bins, 1);
    const w = hist.binCount;
    const pts: string[] = [];
    for (let i = 0; i < w; i++) {
      const h = (hist.bins[i] / maxBin) * 40;
      const x = (i / w) * 200;
      pts.push(`${x},${48 - h}`);
    }
    return (
      <HistSvg viewBox="0 0 200 48" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={`rgb(${props.rgb.join(",")})`}
          strokeWidth="1"
          points={pts.join(" ")}
        />
        <rect
          x={((props.min - props.dataMin) / span) * 200}
          y="0"
          width={Math.max(2, ((props.max - props.min) / span) * 200)}
          height="48"
          fill={`rgba(${props.rgb.join(",")},0.25)`}
        />
      </HistSvg>
    );
  }, [hist, props.min, props.max, props.dataMin, props.rgb, span]);

  return (
    <Wrap>
      <Row>
        <Label>{props.column}</Label>
        <input
          type="checkbox"
          checked={props.enabled}
          onChange={(e) => props.onToggle(e.target.checked)}
          title="Enable gate"
        />
        <button type="button" onClick={props.onAuto}>
          Auto
        </button>
      </Row>
      {bars}
      <Row>
        <input
          type="range"
          min={props.dataMin}
          max={props.dataMax}
          step={(props.dataMax - props.dataMin) / 500 || 0.01}
          value={props.min}
          onChange={(e) => props.onChange(Number(e.target.value), props.max)}
          style={{ flex: 1 }}
        />
        <input
          type="range"
          min={props.dataMin}
          max={props.dataMax}
          step={(props.dataMax - props.dataMin) / 500 || 0.01}
          value={props.max}
          onChange={(e) => props.onChange(props.min, Number(e.target.value))}
          style={{ flex: 1 }}
        />
      </Row>
      <Row style={{ fontSize: 10, color: "#8899aa" }}>
        <span>
          {props.min.toFixed(3)} – {props.max.toFixed(3)}
        </span>
      </Row>
    </Wrap>
  );
}
