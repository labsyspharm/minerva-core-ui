import { useMemo } from "react";
import { useGatingStore } from "@/lib/stores/gatingStore";
import {
  buildGatingTexturePack,
  type GatingTexturePack,
} from "./gatingTextures";

export function useGatingTextures(): GatingTexturePack | null {
  const config = useGatingStore((s) => s.config);
  const cellTable = useGatingStore((s) => s.cellTable);
  const gates = useGatingStore((s) => s.gates);
  const selectionRowIndices = useGatingStore((s) => s.selectionRowIndices);
  const textureRevision = useGatingStore((s) => s.textureRevision);

  return useMemo(() => {
    void textureRevision;
    if (!config || !cellTable) return null;
    return buildGatingTexturePack(
      cellTable,
      gates,
      config.xCoordinate,
      config.yCoordinate,
      selectionRowIndices,
    );
  }, [config, cellTable, gates, selectionRowIndices, textureRevision]);
}
