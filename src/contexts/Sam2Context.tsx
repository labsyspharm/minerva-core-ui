import * as React from "react";
import { useSam2 } from "@/lib/sam2/useSam2";

type Sam2Api = ReturnType<typeof useSam2>;

const Sam2Context = React.createContext<Sam2Api | null>(null);

export function Sam2Provider({ children }: { children: React.ReactNode }) {
  const sam2 = useSam2();
  return <Sam2Context.Provider value={sam2}>{children}</Sam2Context.Provider>;
}

export function useSam2Context(): Sam2Api {
  const ctx = React.useContext(Sam2Context);
  if (!ctx) {
    throw new Error("useSam2Context must be used within <Sam2Provider>");
  }
  return ctx;
}
