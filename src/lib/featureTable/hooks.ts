import { useSyncExternalStore } from "react";
import {
  getFeatureTableIngestEpoch,
  subscribeFeatureTableIngest,
} from "./client";
import {
  getFeatureTableAccess,
  getFeatureTableLutEpoch,
  subscribeFeatureTableAccess,
  subscribeFeatureTableLut,
} from "./index";

/** Bumps when a table finishes ingesting or is dropped. */
export function useFeatureTableIngestEpoch(): number {
  return useSyncExternalStore(
    subscribeFeatureTableIngest,
    getFeatureTableIngestEpoch,
    getFeatureTableIngestEpoch,
  );
}

/** Bumps when a class index loads or a class color preview changes. */
export function useFeatureTableLutEpoch(): number {
  return useSyncExternalStore(
    subscribeFeatureTableLut,
    getFeatureTableLutEpoch,
    getFeatureTableLutEpoch,
  );
}

export function useFeatureTableAccess() {
  return useSyncExternalStore(
    subscribeFeatureTableAccess,
    getFeatureTableAccess,
    getFeatureTableAccess,
  );
}
