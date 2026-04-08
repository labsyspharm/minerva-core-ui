import { get, set } from "idb-keyval";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { findFile, toFile } from "@/lib/imaging/filesystem";

const readWrite = { mode: "readwrite" } as const;

async function permissionGranted(handle: Handle.File): Promise<boolean> {
  const ok = (p: PermissionState) => p === "granted";
  return (
    ok(await handle.queryPermission(readWrite)) ||
    ok(await handle.requestPermission(readWrite))
  );
}

export type FileHandlerProps = {
  handleKeys: string[];
  /**
   * Restore the last saved file handle from IndexedDB on mount (same as “Use recent Image”),
   * then call `onRestoredHandles` when permission is granted and the file still exists.
   */
  autoRestoreOnMount?: boolean;
  /** After a successful mount restore or file-handler launch; use to load the image without the upload form. */
  onRestoredHandles?: (handles: Handle.File[]) => void | Promise<void>;
  /** Register `window.launchQueue` (PWA file handling). Requires manifest `file_handlers`. */
  useLaunchQueue?: boolean;
  children: (props: {
    handles: Handle.File[];
    onAllow: () => Promise<void>;
    onRecall: () => Promise<void>;
  }) => React.ReactNode;
};

export const FileHandler = ({
  handleKeys,
  autoRestoreOnMount = true,
  onRestoredHandles,
  useLaunchQueue = false,
  children,
}: FileHandlerProps) => {
  const [handles, setHandles] = useState<Handle.File[]>([]);
  const storageKey = handleKeys[0];
  const onRestoredHandlesRef = useRef(onRestoredHandles);
  onRestoredHandlesRef.current = onRestoredHandles;

  const applyRestoredHandle = useCallback(
    async (newHandle: Handle.File, signal?: AbortSignal) => {
      if (!storageKey) return;
      const aborted = () => signal?.aborted ?? false;
      if (aborted()) return;
      if (!(await permissionGranted(newHandle))) return;
      if (aborted()) return;
      if (!(await findFile({ handle: newHandle }))) return;
      if (aborted()) return;
      setHandles([newHandle]);
      await set(storageKey, newHandle);
      if (aborted()) return;
      await onRestoredHandlesRef.current?.([newHandle]);
    },
    [storageKey],
  );

  const onAllow = async () => {
    const newHandles = await toFile();
    if (newHandles.length > 0) {
      setHandles(newHandles);
      await set(storageKey, newHandles[0]);
    }
  };

  const onRecall = async () => {
    const newHandle = await get(storageKey);
    if (!newHandle) return;
    try {
      await applyRestoredHandle(newHandle);
    } catch {
      /* stale handle or permission denied */
    }
  };

  useEffect(() => {
    if (!autoRestoreOnMount || !storageKey) return;
    const ac = new AbortController();
    void (async () => {
      const newHandle = await get(storageKey);
      if (!newHandle || ac.signal.aborted) return;
      try {
        await applyRestoredHandle(newHandle, ac.signal);
      } catch {
        /* stale handle or permission denied */
      }
    })();
    return () => ac.abort();
  }, [autoRestoreOnMount, storageKey, applyRestoredHandle]);

  useEffect(() => {
    if (!useLaunchQueue) return;
    const w = window as Window & {
      launchQueue?: {
        setConsumer: (
          fn: (launchParams: { files: Promise<Handle.File[]> }) => void,
        ) => void;
      };
    };
    const launchQueue = w.launchQueue;
    if (!launchQueue?.setConsumer) return;
    launchQueue.setConsumer(async (launchParams) => {
      let list: Handle.File[] = [];
      try {
        list = await launchParams.files;
      } catch {
        return;
      }
      const handle = list[0];
      if (!handle) return;
      try {
        await applyRestoredHandle(handle);
      } catch {
        /* denied or missing file */
      }
    });
  }, [useLaunchQueue, applyRestoredHandle]);

  return <>{children({ handles, onAllow, onRecall })}</>;
};
