/**
 * CDN story-player stub: magic wand / SAM2 is authoring-only.
 * Aliased over `@/lib/sam2/useSam2` in `vite.bundle.config.ts` so the
 * ONNX Runtime worker is never emitted into `bundle/`.
 */

export function useSam2() {
  return {
    session: null,
    startSession: async () => false,
    refineSession: async () => false,
    confirmSession: () => {},
    cancelSession: () => {},
    warmup: async () => {},
    isLoading: false,
    isProcessing: false,
    error: null as string | null,
    isReady: false,
    isAvailable: false,
  };
}
