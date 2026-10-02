/**
 * Story-player stub: `psudo` (GMM / palette WASM) is authoring-only.
 * Aliased over `psudo` in `vite.bundle.config.ts` so player builds never
 * bundle or reference it; callers already fall back when it throws.
 */

const unavailable = async (): Promise<never> => {
  throw new Error("psudo is not available in the Minerva story player");
};

export const warmup = async () => {};
export const channel_gmm = unavailable;
export const optimize = unavailable;
