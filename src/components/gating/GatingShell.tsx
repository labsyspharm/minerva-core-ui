import * as React from "react";
import { restoreGatingDataset } from "@/lib/gating/loadGatingDataset";
import { loadGatingDataset as getGatingDatasetRecord } from "@/lib/gating/persistence";
import { Pool } from "@/lib/imaging/workers/Pool";
import { getFileHandle } from "@/lib/persistence/fileHandles";
import { rootRouteApi } from "@/router/appRouter";
import { GatingWorkspace } from "./GatingWorkspace";

type Props = {
  datasetId?: string;
};

export function GatingShell(props: Props) {
  const navigate = rootRouteApi.useNavigate();
  const poolRef = React.useRef<Pool | null>(null);
  const [restoreError, setRestoreError] = React.useState<string | null>(null);

  React.useEffect(() => {
    poolRef.current = new Pool();
    return () => {
      poolRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const id = props.datasetId;
    if (!id) return;
    void (async () => {
      try {
        const record = await getGatingDatasetRecord(id);
        if (!record) return;
        const { config } = record;
        const biomarker = await getFileHandle(config.biomarkerHandleKey);
        const mask = await getFileHandle(config.maskHandleKey);
        const csv = await getFileHandle(config.csvHandleKey);
        if (!biomarker || !mask || !csv) {
          setRestoreError(
            "Saved file handles unavailable in this browser. Re-import the dataset.",
          );
          return;
        }
        await restoreGatingDataset(
          record,
          { biomarker, mask, csv },
          poolRef.current ?? undefined,
        );
      } catch (e) {
        setRestoreError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [props.datasetId]);

  const exit = () => {
    navigate({
      search: (prev: { gating?: string; gatingid?: string }) => {
        const next = { ...prev };
        delete next.gating;
        delete next.gatingid;
        return next;
      },
    } as never);
  };

  return (
    <>
      {restoreError && (
        <div
          style={{
            background: "#330",
            color: "#fb6",
            padding: "6px 12px",
            fontSize: 11,
          }}
        >
          {restoreError}
        </div>
      )}
      <GatingWorkspace onExit={exit} />
    </>
  );
}
