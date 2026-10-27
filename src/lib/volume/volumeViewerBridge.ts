import type { GaussianCloud, GenerateSplatsOptions } from "kiln-render";
import type { View3d } from "@/lib/stores/documentSchema";

/**
 * One channel's splats, trained in white and tinted at display; `channelId`
 * null: the whole group in its own colours (single-channel volumes, and
 * stories exported before splats were per channel).
 */
export type ChannelSplats = { channelId: string | null; cloud: GaussianCloud };

/** What waypoint authoring needs from the mounted 3D viewer. */
type VolumeViewHandle = {
  /** Current camera + render settings. */
  capture: () => View3d;
  /**
   * Resolves once the volume shows the active channel group (after any
   * re-open for other channels) and its coarsest level is loaded.
   */
  waitUntilReady: (signal?: AbortSignal) => Promise<void>;
  /**
   * Fit + train splats of the whole volume, one cloud per shown channel
   * (kiln restores the view after).
   */
  trainSplats: (opts: GenerateSplatsOptions) => Promise<ChannelSplats[]>;
};

let active: VolumeViewHandle | null = null;

/** Called by `VolumeViewer` on mount; returns the unregister function. */
export function registerVolumeView(handle: VolumeViewHandle): () => void {
  active = handle;
  return () => {
    if (active === handle) active = null;
  };
}

/** The mounted 3D viewer, or null when the 2D viewer is showing. */
export function getActiveVolumeView(): VolumeViewHandle | null {
  return active;
}
