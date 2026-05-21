import * as React from "react";
import styled from "styled-components";
import { useGatingStore } from "@/lib/stores/gatingStore";
import { GatingChannelPanel } from "./GatingChannelPanel";
import { GatingImport } from "./GatingImport";
import { GatingPanel } from "./GatingPanel";
import { GatingViewer } from "./GatingViewer";

const Shell = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: minmax(200px, 280px) 1fr minmax(220px, 300px);
  height: calc(100vh - 0px);
  width: 100%;
  background: #000;
  color: #e6edf3;
`;

const Column = styled.div`
  min-width: 0;
  min-height: 0;
  border-right: 1px solid #333;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  &:last-child {
    border-right: none;
    border-left: 1px solid #333;
  }
`;

const Header = styled.header`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  background: #0d1117;
`;

const HeaderBtn = styled.button`
  background: #2a2a2a;
  border: 1px solid #444;
  color: #e6edf3;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
  &:hover {
    background: #333;
  }
`;

type Props = {
  onExit: () => void;
};

export function GatingWorkspace(props: Props) {
  const config = useGatingStore((s) => s.config);
  const clearDataset = useGatingStore((s) => s.clearDataset);
  const [showImport, setShowImport] = React.useState(!config);

  React.useEffect(() => {
    if (config) setShowImport(false);
  }, [config]);

  return (
    <Shell>
      <Header>
        <div>
          <strong style={{ fontSize: 13 }}>Cellular gating</strong>
          {config ? (
            <span style={{ marginLeft: 8, color: "#8899aa", fontSize: 11 }}>
              {config.name}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {config && !showImport ? (
            <HeaderBtn
              type="button"
              onClick={() => {
                clearDataset();
                setShowImport(true);
              }}
            >
              New import
            </HeaderBtn>
          ) : null}
          <HeaderBtn type="button" onClick={props.onExit}>
            Back to library
          </HeaderBtn>
        </div>
      </Header>
      {showImport || !config ? (
        <div style={{ gridColumn: "1 / -1", overflow: "auto" }}>
          <GatingImport onImported={() => setShowImport(false)} />
        </div>
      ) : (
        <>
          <Column>
            <GatingChannelPanel />
          </Column>
          <Column style={{ borderRight: "none" }}>
            <GatingViewer />
          </Column>
          <Column>
            <GatingPanel />
          </Column>
        </>
      )}
    </Shell>
  );
}
