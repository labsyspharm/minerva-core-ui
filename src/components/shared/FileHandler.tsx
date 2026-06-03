import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureFileHandlePermission,
  findFile,
  isPersistableFileHandle,
  toFile,
} from "@/lib/imaging/filesystem";
import { getFileHandle, putFileHandle } from "@/lib/persistence/fileHandles";

export type FileHandlerProps = {
  handleKeys: string[];
  /**
   * Restore the last saved file handle from IndexedDB on mount (same as “Use recent Image”),
   * then call `onRestoredHandles` when permission is granted and the file still exists.
   */
  autoRestoreOnMount?: boolean;
  /**
   * After a successful restore: mount auto-restore, “Use recent Image” (`onRecall`), or PWA
   * `launchQueue`. Use this to reconnect the image pipeline (loaders, channels) without the
   * upload form.
   *
   * **Do not** clear persisted document state here (Dexie story: waypoints, shapes, channel
   * groups, etc.) — story bootstrap has already run; wiping the store will autosave empty data.
   */
  onRestoredHandles?: (handles: Handle.File[]) => void | Promise<void>;
  /** Register `window.launchQueue` (PWA file handling). Requires manifest `file_handlers`. */
  useLaunchQueue?: boolean;
  children: (props: {
    handles: Handle.File[];
    onAllow: () => Promise<Handle.File[]>;
    onRecall: (options?: {
      notifyRestored?: boolean;
    }) => Promise<Handle.File[]>;
    /** True when a recent file handle is persisted for `handleKeys[0]`. */
    hasRecent: boolean;
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
  const [hasRecent, setHasRecent] = useState(false);
  const storageKey = handleKeys[0];
  const onRestoredHandlesRef = useRef(onRestoredHandles);
  onRestoredHandlesRef.current = onRestoredHandles;

  /** Refresh `hasRecent` from IndexedDB; safe to call any time. */
  const refreshHasRecent = useCallback(async () => {
    if (!storageKey) {
      setHasRecent(false);
      return;
    }
    try {
      const h = await getFileHandle(storageKey);
      setHasRecent(Boolean(h));
    } catch {
      setHasRecent(false);
    }
  }, [storageKey]);

  useEffect(() => {
    void refreshHasRecent();
  }, [refreshHasRecent]);

  const applyRestoredHandle = useCallback(
    async (
      newHandle: Handle.File,
      signal?: AbortSignal,
      options?: { notifyRestored?: boolean },
    ): Promise<Handle.File[]> => {
      if (!storageKey) return [];
      const aborted = () => signal?.aborted ?? false;
      if (aborted()) return [];
      if (!(await ensureFileHandlePermission(newHandle))) return [];
      if (aborted()) return [];
      if (!(await findFile({ handle: newHandle }))) return [];
      if (aborted()) return [];
      setHandles([newHandle]);
      if (isPersistableFileHandle(newHandle)) {
        await putFileHandle(storageKey, newHandle);
        setHasRecent(true);
      }
      if (aborted()) return [];
      if (options?.notifyRestored !== false) {
        await onRestoredHandlesRef.current?.([newHandle]);
      }
      return [newHandle];
    },
    [storageKey],
  );

  const onAllow = async (): Promise<Handle.File[]> => {
    const newHandles = await toFile();
    if (newHandles.length > 0) {
      setHandles(newHandles);
      if (isPersistableFileHandle(newHandles[0])) {
        await putFileHandle(storageKey, newHandles[0]);
        setHasRecent(true);
      }
    }
    return newHandles;
  };

  const onRecall = async (options?: {
    notifyRestored?: boolean;
  }): Promise<Handle.File[]> => {
    const newHandle = await getFileHandle(storageKey);
    if (!newHandle) {
      setHasRecent(false);
      return [];
    }
    try {
      return await applyRestoredHandle(newHandle, undefined, options);
    } catch {
      /* stale handle or permission denied */
    }
    return [];
  };

  useEffect(() => {
    if (!autoRestoreOnMount || !storageKey) return;
    const ac = new AbortController();
    void (async () => {
      const newHandle = await getFileHandle(storageKey);
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

  return <>{children({ handles, onAllow, onRecall, hasRecent })}</>;
};
