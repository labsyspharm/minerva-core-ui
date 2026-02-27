import { get, set } from "idb-keyval";
import type React from "react";
import { useState } from "react";
import { toFile } from "@/lib/filesystem";

export type FileHandlerProps = {
  handleKeys: string[];
  children: (props: {
    handles: Handle.File[];
    onAllow: () => Promise<void>;
    onRecall: () => Promise<void>;
  }) => React.ReactNode;
};

export const FileHandler = ({ handleKeys, children }: FileHandlerProps) => {
  const [handles, setHandles] = useState<Handle.File[]>([]);

  const onAllow = async () => {
    const newHandles = await toFile();
    if (newHandles.length > 0) {
      setHandles(newHandles);
      await set(handleKeys[0], newHandles[0]);
    }
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
      setHandles([newHandle]);
    }
  };

  return <>{children({ handles, onAllow, onRecall })}</>;
};
