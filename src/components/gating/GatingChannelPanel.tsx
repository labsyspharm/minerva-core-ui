import styled from "styled-components";
import { MAX_DISPLAY_CHANNELS } from "@/lib/gating/types";
import { useGatingStore } from "@/lib/stores/gatingStore";

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

const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid #333;
  border-radius: 4px;
  margin-bottom: 6px;
`;

export function GatingChannelPanel() {
  const displayChannels = useGatingStore((s) => s.displayChannels);
  const setDisplayChannel = useGatingStore((s) => s.setDisplayChannel);
  const config = useGatingStore((s) => s.config);

  if (!config) {
    return (
      <Panel>
        <Title>Image channels</Title>
        <p>Load a dataset to adjust display channels.</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <Title>Image channels (max {MAX_DISPLAY_CHANNELS})</Title>
      {displayChannels.map((ch, i) => (
        <Row key={ch.id}>
          <label>
            <input
              type="checkbox"
              checked={ch.visible}
              onChange={(e) =>
                setDisplayChannel(i, { visible: e.target.checked })
              }
            />{" "}
            {ch.name}
          </label>
          <input
            type="color"
            value={`#${ch.rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`}
            onChange={(e) => {
              const hex = e.target.value;
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              setDisplayChannel(i, { rgb: [r, g, b] });
            }}
          />
          <label>
            Low
            <input
              type="range"
              min={0}
              max={65535}
              value={ch.lowerLimit}
              onChange={(e) =>
                setDisplayChannel(i, {
                  lowerLimit: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            High
            <input
              type="range"
              min={0}
              max={65535}
              value={ch.upperLimit}
              onChange={(e) =>
                setDisplayChannel(i, {
                  upperLimit: Number(e.target.value),
                })
              }
            />
          </label>
        </Row>
      ))}
    </Panel>
  );
}
