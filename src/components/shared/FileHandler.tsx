import type React from "react";
import { useState } from "react";
import { get, set } from "idb-keyval";
import { toDir } from "@/lib/filesystem";

export type FileHandlerProps = {
  handleKeys: string[];
  children: (props: {
    handle: Handle.Dir | null;
    onAllow: () => Promise<void>;
    onRecall: () => Promise<void>;
  }) => React.ReactNode;
};

export const FileHandler = ({ handleKeys, children }: FileHandlerProps) => {
  const [handle, setHandle] = useState<Handle.Dir | null>(null);

  const onAllow = async () => {
    const newHandle = await toDir();
    setHandle(newHandle);
    await set(handleKeys[0], newHandle);
  };

  const onRecall = async () => {
    const newHandle = await get(handleKeys[0]);
    if (!newHandle) return;

    const isGranted = (permission) => permission === "granted";
    const options = { mode: "readwrite" };
    if (
      isGranted(await newHandle.queryPermission(options)) ||
      isGranted(await newHandle.requestPermission(options))
    ) {
      setHandle(newHandle);
    }
  };

  return <>{children({ handle, onAllow, onRecall })}</>;
};
