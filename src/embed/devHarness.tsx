/**
 * Dev harness for `<MinervaStory>` (`story.html`, served by `pnpm dev`).
 * Loads `?document=<url>`, or the CRC demo story by default. The handle is
 * exposed as `window.minerva` for poking at commands from the console:
 * `minerva.listCommands()`, `await minerva.goToWaypoint(3)`, …
 */

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { MinervaHandle } from "@/api/controller";
import type { MinervaState } from "@/api/state";
import { buildDemoCrcDocumentData } from "@/lib/persistence/demo";
import { MinervaStory } from "./MinervaStory";

declare global {
  interface Window {
    minerva?: MinervaHandle;
  }
}

const documentParam = new URLSearchParams(window.location.search).get(
  "document",
);
const storyDocument = documentParam ?? buildDemoCrcDocumentData();

function Harness() {
  const [state, setState] = useState<MinervaState | null>(null);
  const wp = state?.activeWaypoint;
  return (
    <>
      <MinervaStory
        document={storyDocument}
        onReady={(handle) => {
          window.minerva = handle;
        }}
        onStateChange={setState}
      />
      <output
        style={{
          position: "fixed",
          right: 8,
          bottom: 8,
          padding: "4px 8px",
          background: "rgb(0 0 0 / 0.7)",
          color: "#ccc",
          font: "12px monospace",
          pointerEvents: "none",
        }}
      >
        {state?.status ?? "idle"}
        {wp ? ` · waypoint ${wp.index}` : ""}
        {state?.view
          ? ` · view ${state.view.target.map(Math.round).join(",")} z${state.view.zoom.toFixed(2)}`
          : ""}
      </output>
    </>
  );
}

createRoot(document.getElementById("story") as HTMLElement).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
