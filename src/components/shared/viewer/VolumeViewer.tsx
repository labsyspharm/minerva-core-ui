/**
 * 3D viewer for volume images (Imaris `.ims` over HTTP), rendered by
 * kiln-render with WebGPU. Mirrors what ImageViewer does for 2D:
 *
 * - channel groups, visibility and live contrast/colour edits drive the
 *   volume's channels (at most six composited at once; a group outside the
 *   streamed set re-opens the volume with that group's channels);
 * - waypoint navigation (`targetWaypointCamera`) flies the orbit camera,
 *   clip box, render mode and density to the waypoint's `view3d`;
 * - waypoint authoring reads the live view through `registerVolumeView` and
 *   thumbnails through `setSquareViewportThumbnailCapture`;
 * - when story export trained splats for the active channel group, they can
 *   be shown instead of the streamed volume (the player starts with them).
 */
import type {
  GaussianCloud,
  ImarisDataProvider,
  KilnViewer,
} from "kiln-render";
import * as React from "react";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image, View3d } from "@/lib/stores/documentSchema";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { loadKiln } from "@/lib/volume/imsVolume";
import {
  documentSplatsFor,
  hasSplatsFor,
  type SplatLook,
  splatCloudsFor,
  splatKey,
  splatsVersion,
  subscribeSplats,
} from "@/lib/volume/splatCache";
import {
  DEFAULT_DENSITY,
  easeInOutCubic,
  interpolateView3d,
  isClipped,
  RENDER_MODE_LABELS,
  type Vec3,
  WAYPOINT_FLY_MS,
} from "@/lib/volume/view3d";
import {
  channelsToLoad,
  limitsToWindow,
  type VolumeChannelLayer,
  volumeChannelLayers,
} from "@/lib/volume/volumeChannels";
import {
  type ChannelSplats,
  registerVolumeView,
} from "@/lib/volume/volumeViewerBridge";
import {
  WAYPOINT_THUMBNAIL_JPEG_QUALITY,
  WAYPOINT_THUMBNAIL_PIXEL_SIZE,
} from "@/lib/waypoints/waypointThumbnail";
import minervaTheme from "../minervaTheme.module.css";
import styles from "./VolumeViewer.module.css";

type RenderSettings = Omit<View3d, "camera">;

const DEFAULT_SETTINGS: RenderSettings = {
  clipMin: [0, 0, 0],
  clipMax: [1, 1, 1],
  renderMode: "dvr",
  density: DEFAULT_DENSITY,
  depthCue: 0,
};

const AXES = ["X", "Y", "Z"] as const;

/** Splats are built from the whole volume, not the author's clip box. */
const WHOLE_VOLUME = { min: [0, 0, 0], max: [1, 1, 1] } as {
  min: Vec3;
  max: Vec3;
};

/** Render at device resolution (capped): CSS-pixel canvases look soft on HiDPI. */
const PIXEL_RATIO_CAP = 2;

/** kiln clamps a forced pyramid level to its coarsest one. */
const COARSEST_LOD = Number.MAX_SAFE_INTEGER;

type Status = "loading" | "ready" | { error: string };

type Live = {
  viewer: KilnViewer;
  provider: ImarisDataProvider;
};

function readView(v: KilnViewer): View3d {
  const r = v.renderer;
  const mode = r.volumeRenderMode;
  return {
    camera: v.camera.getOrbitState(),
    clipMin: [r.clipMin[0] ?? 0, r.clipMin[1] ?? 0, r.clipMin[2] ?? 0],
    clipMax: [r.clipMax[0] ?? 1, r.clipMax[1] ?? 1, r.clipMax[2] ?? 1],
    renderMode: mode === "mip" || mode === "iso" ? mode : "dvr",
    density: r.densityScale,
    depthCue: v.depthCue,
  };
}

function writeView(v: KilnViewer, view: View3d): void {
  const r = v.renderer;
  v.camera.setOrbitState(view.camera);
  r.clipMin.set(view.clipMin);
  r.clipMax.set(view.clipMax);
  r.densityScale = view.density;
  v.depthCue = view.depthCue;
  if (r.volumeRenderMode !== view.renderMode) v.mode = view.renderMode;
  r.resetAccumulation();
}

function withoutCamera({ camera: _camera, ...settings }: View3d) {
  return settings;
}

function applyChannels(live: Live, layers: VolumeChannelLayer[]): void {
  const { viewer, provider } = live;
  provider.activeChannels.forEach((source, slot) => {
    const layer = layers.find((l) => l.sourceIndex === source);
    const info = provider.allChannels[source];
    if (!layer || !info) {
      viewer.renderer.setChannelColor(slot, 0, 0, 0, 0);
      viewer.streamingManager.setChannelEnabled(slot, false);
      return;
    }
    const [r, g, b] = layer.color;
    viewer.renderer.setChannelColor(slot, r / 255, g / 255, b / 255, 1);
    const w = limitsToWindow(layer.limits, info.range);
    viewer.renderer.setChannelWindow(slot, w.center, w.width);
    viewer.streamingManager.setChannelEnabled(slot, true);
  });
}

type Kiln = Awaited<ReturnType<typeof loadKiln>>;

/**
 * One displayable cloud from a look's clouds. Per-channel clouds are tagged
 * with the slot their channel is loaded in (`slots[i]` for `parts[i]`, -1 when
 * not loaded: left out), so the viewer tints them with the live channel
 * colours and hidden channels drop out.
 */
function composeSplats(
  kiln: Kiln,
  parts: ChannelSplats[],
  slots: readonly number[],
): GaussianCloud | null {
  const whole = parts.find((p) => p.channelId === null);
  if (whole) return whole.cloud;
  const loaded = parts.flatMap(({ cloud }, i) => {
    const slot = slots[i] ?? -1;
    return slot < 0 || !cloud.channelComposite ? [] : [{ cloud, slot }];
  });
  // One copy: merging tags each part with its slot.
  return loaded.length === 0
    ? null
    : kiln.mergeClouds(
        loaded.map((p) => p.cloud),
        loaded.map((p) => p.slot),
        loaded[0]?.cloud.channelComposite,
      );
}

/** The last composed cloud: reused while its parts and slots are the same. */
type Composed = {
  parts: ChannelSplats[];
  slots: string;
  cloud: GaussianCloud | null;
};

const sameClouds = (a: ChannelSplats[], b: ChannelSplats[]) =>
  a.length === b.length && a.every((p, i) => p.cloud === b[i]?.cloud);

/**
 * Waypoint thumbnail: the centred square of the canvas (as the 2D viewer's
 * thumbnail frame). A WebGPU canvas must be read in the task that rendered it.
 */
function captureThumbnail(viewer: KilnViewer, canvas: HTMLCanvasElement) {
  viewer.renderNow();
  const side = Math.floor(Math.min(canvas.width, canvas.height) * 0.9);
  const out = document.createElement("canvas");
  out.width = WAYPOINT_THUMBNAIL_PIXEL_SIZE;
  out.height = WAYPOINT_THUMBNAIL_PIXEL_SIZE;
  const ctx = out.getContext("2d");
  if (side <= 0 || !ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const x = (canvas.width - side) / 2;
  const y = (canvas.height - side) / 2;
  ctx.drawImage(canvas, x, y, side, side, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", WAYPOINT_THUMBNAIL_JPEG_QUALITY);
}

type VolumeViewerProps = {
  image: Image;
  /** Show the render toolbar (authoring); playback only navigates. */
  canEdit: boolean;
  /** Resolves relative splat URLs (the player's document.json). */
  documentUrl?: string;
  /** Start in splat display when the active group has splats (player). */
  preferSplats?: boolean;
};

export const VolumeViewer = React.memo(function VolumeViewer({
  image,
  canEdit,
  documentUrl = window.location.href,
  preferSplats = false,
}: VolumeViewerProps) {
  const url = image.source?.kind === "volume" ? image.source.url : "";
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const liveRef = React.useRef<Live | null>(null);
  /**
   * View to open with: the last one (re-opening with other channels keeps the
   * camera) or a waypoint's, requested before the volume finished opening.
   */
  const viewRef = React.useRef<View3d | null>(null);
  const flightRef = React.useRef(0);
  const [status, setStatus] = React.useState<Status>("loading");
  /** Bumped by "Retry": WebGPU can be briefly unavailable (GPU reset). */
  const [attempt, setAttempt] = React.useState(0);
  const [settings, setSettings] =
    React.useState<RenderSettings>(DEFAULT_SETTINGS);
  const statusRef = React.useRef(status);
  statusRef.current = status;
  /** Forced pyramid level (0 = finest); null = automatic. */
  const [detail, setDetail] = React.useState<number | null>(null);
  const [display, setDisplay] = React.useState<"volume" | "splats">(
    preferSplats ? "splats" : "volume",
  );
  /** Level a viewer opens at: splats need only the coarsest. */
  const openLodRef = React.useRef<number | null>(null);
  openLodRef.current = display === "splats" ? COARSEST_LOD : detail;

  const images = useDocumentStore((s) => s.images);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const channelVisibilities = useAppStore((s) => s.channelVisibilities);
  const channelGroupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const channelRendering = useAppStore((s) => s.channelRendering);
  const layers = React.useMemo(
    () =>
      volumeChannelLayers({
        imageId: image.id,
        sourceChannels: flattenImageChannelsInDocumentOrder(images),
        channelGroups,
        activeChannelGroupId,
        channelVisibilities,
        channelGroupRowVisibilities,
        channelRendering,
      }),
    [
      image.id,
      images,
      channelGroups,
      activeChannelGroupId,
      channelVisibilities,
      channelGroupRowVisibilities,
      channelRendering,
    ],
  );
  const layersRef = React.useRef(layers);
  layersRef.current = layers;
  const [loadSet, setLoadSet] = React.useState<number[]>(() =>
    channelsToLoad(
      layers.map((l) => l.sourceIndex),
      null,
    ),
  );
  React.useEffect(() => {
    const next = channelsToLoad(
      layers.map((l) => l.sourceIndex),
      loadSet,
    );
    if (next.join(",") !== loadSet.join(",")) setLoadSet(next);
    const live = liveRef.current;
    if (live) applyChannels(live, layers);
  }, [layers, loadSet]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    void attempt; // "Retry"
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      try {
        if (!("gpu" in navigator) || !navigator.gpu) {
          throw new Error(
            "3D volumes need WebGPU (a recent Chrome, Edge or Safari).",
          );
        }
        const { ImarisDataProvider, KilnViewer } = await loadKiln();
        if (cancelled) return;
        const provider = new ImarisDataProvider(url, {
          channels: loadSet,
        });
        const start = viewRef.current;
        const viewer = await KilnViewer.create(canvas, provider, {
          ...(start ? { cam: start.camera } : {}),
          pixelRatio: Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP),
          forcedLod: openLodRef.current,
        });
        if (cancelled) {
          viewer.dispose();
          return;
        }
        const live = { viewer, provider };
        liveRef.current = live;
        applyChannels(live, layersRef.current);
        if (start) writeView(viewer, start);
        else writeView(viewer, { ...readView(viewer), ...DEFAULT_SETTINGS });
        setSettings(withoutCamera(readView(viewer)));
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        console.error("[minerva] volume viewer failed", e);
        setStatus({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(flightRef.current);
      const live = liveRef.current;
      liveRef.current = null;
      if (live) {
        viewRef.current = readView(live.viewer);
        live.viewer.dispose();
      }
      useAppStore.getState().setViewerImageLayersLoaded(false);
    };
  }, [url, loadSet, attempt]);

  // Thumbnails wait for this, as for 2D image layers: the coarsest level.
  React.useEffect(() => {
    const live = status === "ready" ? liveRef.current : null;
    if (!live) return;
    const poll = window.setInterval(() => {
      if (liveRef.current !== live) return;
      if (!live.viewer.streamingManager.baseLodLoaded) return;
      window.clearInterval(poll);
      const app = useAppStore.getState();
      const index = app.activeStoryIndex;
      const waypoint =
        index === null
          ? undefined
          : useDocumentStore.getState().waypoints[index];
      // An import's default waypoint exists before the 3D view: give it the
      // opening view.
      if (canEdit && index !== null && waypoint && !waypoint.view3d) {
        app.updateStory(index, { View3d: readView(live.viewer) });
      }
      app.setViewerImageLayersLoaded(true);
    }, 250);
    return () => window.clearInterval(poll);
  }, [status, canEdit]);

  const splatsRev = React.useSyncExternalStore(subscribeSplats, splatsVersion);
  const look = React.useMemo<SplatLook | null>(
    () =>
      activeChannelGroupId
        ? {
            groupId: activeChannelGroupId,
            renderMode: settings.renderMode,
            density: settings.density,
          }
        : null,
    [activeChannelGroupId, settings.renderMode, settings.density],
  );
  // Splats are of the whole volume: a clipped view shows the live volume.
  const clipped = isClipped(settings);
  const splatsAvailable = React.useMemo(() => {
    void splatsRev; // a cloud was trained
    return !clipped && hasSplatsFor(image, look);
  }, [image, look, splatsRev, clipped]);
  const showSplats = display === "splats" && splatsAvailable;

  // Volume vs splats: splats need only the coarsest level streamed.
  React.useEffect(() => {
    const viewer = liveRef.current?.viewer;
    if (status !== "ready" || !viewer) return;
    if (!showSplats && viewer.displayMode !== "volume") {
      viewer.displayMode = "volume";
    }
    const lod = showSplats ? viewer.metadata.maxLod : detail;
    if (viewer.forcedLod !== lod) viewer.forcedLod = lod;
  }, [status, showSplats, detail]);

  // What the shown cloud depends on, as one value rather than the image and
  // look objects: colour edits re-tint the splats live, without a new cloud.
  const splatSource =
    showSplats && look
      ? [
          splatKey(look),
          documentSplatsFor(image, look).map((s) => s.url),
          image.channels.map((c) => `${c.id}:${c.index}`),
          loadSet,
          splatsRev,
        ].join("|")
      : null;
  const splatInputsRef = React.useRef({ image, look });
  splatInputsRef.current = { image, look };
  const composedRef = React.useRef<Composed | null>(null);
  const [splatState, setSplatState] = React.useState<
    "idle" | "loading" | "error"
  >("idle");
  React.useEffect(() => {
    const live = liveRef.current;
    if (status !== "ready" || !live || !splatSource) {
      setSplatState("idle");
      return;
    }
    const inputs = splatInputsRef.current;
    const viewer = live.viewer;
    let cancelled = false;
    setSplatState("loading");
    void (async () => {
      try {
        const parts = await splatCloudsFor(
          inputs.image,
          inputs.look,
          documentUrl,
        );
        const kiln = await loadKiln();
        if (cancelled || liveRef.current !== live || !parts) return;
        const slots = parts.map(({ channelId }) => {
          const index = inputs.image.channels.find(
            (c) => c.id === channelId,
          )?.index;
          return index === undefined
            ? -1
            : live.provider.activeChannels.indexOf(index);
        });
        const slotKey = slots.join(",");
        let composed = composedRef.current;
        if (composed?.slots !== slotKey || !sameClouds(composed.parts, parts)) {
          composed = {
            parts,
            slots: slotKey,
            cloud: composeSplats(kiln, parts, slots),
          };
          composedRef.current = composed;
        }
        // None of its channels loaded yet: the volume is re-opening for them.
        if (!composed.cloud) return;
        if (viewer.splats.cloud !== composed.cloud) {
          viewer.setSplats(composed.cloud);
        }
        viewer.displayMode = "splats";
        setSplatState("idle");
      } catch (e) {
        if (cancelled) return;
        console.error("[minerva] splats failed to load", e);
        setSplatState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, splatSource, documentUrl]);

  React.useEffect(
    () =>
      registerVolumeView({
        capture: () => {
          const live = liveRef.current;
          if (live) return readView(live.viewer);
          return (
            viewRef.current ?? {
              camera: [0, 0, 2.5, 0, 0, 0],
              ...DEFAULT_SETTINGS,
            }
          );
        },
        waitUntilReady: (signal) =>
          new Promise<void>((resolve, reject) => {
            const check = () => {
              if (signal?.aborted) {
                reject(new DOMException("Aborted", "AbortError"));
                return;
              }
              if (typeof statusRef.current === "object") {
                reject(new Error("The volume could not be opened."));
                return;
              }
              const live = liveRef.current;
              const shown = live?.provider.activeChannels ?? [];
              const covered = layersRef.current.every((l) =>
                shown.includes(l.sourceIndex),
              );
              if (
                live &&
                statusRef.current === "ready" &&
                covered &&
                live.viewer.streamingManager.baseLodLoaded
              ) {
                resolve();
              } else {
                window.setTimeout(check, 100);
              }
            };
            window.setTimeout(check, 50);
          }),
        trainSplats: async (opts) => {
          const live = liveRef.current;
          if (!live) throw new Error("The volume is not open.");
          cancelAnimationFrame(flightRef.current);
          const cloud = await live.viewer.generateSplats({
            train: true,
            region: WHOLE_VOLUME,
            perChannel: true,
            ...opts,
          });
          if (!cloud.channelComposite) return [{ channelId: null, cloud }];
          const { splitByChannel } = await loadKiln();
          const parts: ChannelSplats[] = [];
          for (const [slot, part] of splitByChannel(cloud)) {
            const source = live.provider.activeChannels[slot];
            const layer = layersRef.current.find(
              (l) => l.sourceIndex === source,
            );
            if (layer) parts.push({ channelId: layer.channelId, cloud: part });
          }
          return parts;
        },
      }),
    [],
  );
  const setSquareViewportThumbnailCapture = useAppStore(
    (s) => s.setSquareViewportThumbnailCapture,
  );
  React.useEffect(() => {
    setSquareViewportThumbnailCapture(() => {
      const live = liveRef.current;
      const canvas = canvasRef.current;
      return live && canvas ? captureThumbnail(live.viewer, canvas) : null;
    });
    return () => setSquareViewportThumbnailCapture(null);
  }, [setSquareViewportThumbnailCapture]);

  const targetWaypointCamera = useAppStore((s) => s.targetWaypointCamera);
  const clearTargetWaypointCamera = useAppStore(
    (s) => s.clearTargetWaypointCamera,
  );
  React.useEffect(() => {
    if (!targetWaypointCamera) return;
    const to = targetWaypointCamera.View3d;
    clearTargetWaypointCamera();
    if (!to) return; // saved on a 2D image: keep the current view
    const live = liveRef.current;
    if (!live) {
      viewRef.current = to;
      return;
    }
    cancelAnimationFrame(flightRef.current);
    const from = readView(live.viewer);
    const t0 = performance.now();
    const step = () => {
      if (liveRef.current !== live) return;
      const t = Math.min(1, (performance.now() - t0) / WAYPOINT_FLY_MS);
      writeView(live.viewer, interpolateView3d(from, to, easeInOutCubic(t)));
      if (t < 1) {
        flightRef.current = requestAnimationFrame(step);
      } else {
        writeView(live.viewer, to);
        setSettings(withoutCamera(to));
      }
    };
    step();
  }, [targetWaypointCamera, clearTargetWaypointCamera]);

  const update = (patch: Partial<RenderSettings>) => {
    const live = liveRef.current;
    if (!live) return;
    const next = { ...readView(live.viewer), ...patch };
    writeView(live.viewer, next);
    setSettings(withoutCamera(next));
  };
  const setClip = (axis: number, end: "min" | "max", value: number) => {
    const clipMin = [...settings.clipMin] as Vec3;
    const clipMax = [...settings.clipMax] as Vec3;
    if (end === "min") clipMin[axis] = Math.min(value, clipMax[axis] - 0.01);
    else clipMax[axis] = Math.max(value, clipMin[axis] + 0.01);
    update({ clipMin, clipMax });
  };

  const openViewer = status === "ready" ? liveRef.current?.viewer : undefined;
  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {status === "loading" ? (
        <output className={styles.status}>Opening volume…</output>
      ) : null}
      {typeof status === "object" ? (
        <div className={styles.status} role="alert">
          {status.error}{" "}
          <button
            type="button"
            className={styles.chip}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}
      {openViewer ? (
        <ViewPanel
          viewer={openViewer}
          showSplats={showSplats}
          splatState={splatState}
          splatsAvailable={splatsAvailable}
          onDisplay={setDisplay}
          detail={detail}
          onDetail={setDetail}
        />
      ) : null}
      {canEdit && openViewer && !showSplats ? (
        <div
          className={styles.toolbar}
          role="toolbar"
          aria-label="3D view settings"
        >
          <div className={styles.group}>
            {(
              Object.entries(RENDER_MODE_LABELS) as [
                View3d["renderMode"],
                string,
              ][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={styles.chip}
                aria-pressed={settings.renderMode === mode}
                onClick={() => update({ renderMode: mode })}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Density is volume rendering's absorption; MIP and Surface ignore it. */}
          {settings.renderMode === "dvr" ? (
            <label className={styles.group}>
              <span className={styles.prefix}>Density</span>
              <input
                type="range"
                aria-label="Density"
                min={Math.log(0.01)}
                max={Math.log(10)}
                step={0.05}
                value={Math.log(settings.density)}
                onChange={(e) =>
                  update({ density: Math.exp(Number(e.currentTarget.value)) })
                }
              />
            </label>
          ) : null}
          <label className={styles.group}>
            <span className={styles.prefix}>Depth</span>
            <input
              type="range"
              aria-label="Depth fade"
              title="Dim with distance from the camera"
              min={0}
              max={1}
              step={0.01}
              value={settings.depthCue}
              onChange={(e) =>
                update({ depthCue: Number(e.currentTarget.value) })
              }
            />
          </label>
          <div className={styles.group}>
            <span className={styles.prefix}>Clip</span>
            {AXES.map((axis, i) => (
              <span key={axis} className={styles.clipAxis}>
                <span className={styles.axis}>{axis}</span>
                <input
                  type="range"
                  aria-label={`Clip ${axis} start`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.clipMin[i]}
                  onChange={(e) =>
                    setClip(i, "min", Number(e.currentTarget.value))
                  }
                />
                <input
                  type="range"
                  aria-label={`Clip ${axis} end`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.clipMax[i]}
                  onChange={(e) =>
                    setClip(i, "max", Number(e.currentTarget.value))
                  }
                />
              </span>
            ))}
            <button
              type="button"
              className={styles.chip}
              onClick={() =>
                update({
                  clipMin: [0, 0, 0],
                  clipMax: [1, 1, 1],
                })
              }
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

type Streaming = {
  /** Bricks wanted for this view that are not resident yet. */
  pending: number;
  desired: number;
  /** Finest pyramid level currently streamed (0 = full resolution). */
  finestLod: number;
  /** The view needs more bricks than GPU memory holds; the rest stay coarse. */
  stalled: boolean;
};

/**
 * Viewing preferences (not saved in waypoints): loading progress, volume or
 * splats, data detail. Polls streaming progress while the volume is shown;
 * only this panel re-renders with it.
 */
function ViewPanel({
  viewer,
  showSplats,
  splatState,
  splatsAvailable,
  onDisplay,
  detail,
  onDetail,
}: {
  viewer: KilnViewer;
  showSplats: boolean;
  splatState: "idle" | "loading" | "error";
  splatsAvailable: boolean;
  onDisplay: (display: "volume" | "splats") => void;
  detail: number | null;
  onDetail: (lod: number | null) => void;
}) {
  const [streaming, setStreaming] = React.useState<Streaming | null>(null);
  React.useEffect(() => {
    if (showSplats) return;
    const poll = () => {
      const sm = viewer.streamingManager;
      const st = sm.getStats();
      const next: Streaming = {
        pending: st.pendingCount,
        desired: st.desiredCount,
        finestLod: viewer.finestStreamLod,
        stalled: sm.isStalled,
      };
      setStreaming((prev) =>
        prev &&
        prev.pending === next.pending &&
        prev.desired === next.desired &&
        prev.finestLod === next.finestLod &&
        prev.stalled === next.stalled
          ? prev
          : next,
      );
    };
    poll();
    const id = window.setInterval(poll, 250);
    return () => window.clearInterval(id);
  }, [viewer, showSplats]);

  return (
    <div className={styles.viewPanel}>
      {showSplats ? (
        splatState === "loading" ? (
          <output className={styles.loading}>
            <span className={minervaTheme.spinnerSm} aria-hidden />
            Loading splats…
          </output>
        ) : splatState === "error" ? (
          <span role="alert">Splats could not be loaded.</span>
        ) : null
      ) : streaming && streaming.pending > 0 && streaming.stalled ? (
        <span title="This view needs more voxel data than fits in GPU memory; the rest is shown at lower resolution. Zoom in, clip, or lower Detail.">
          GPU memory limit
        </span>
      ) : streaming && streaming.pending > 0 ? (
        <output className={styles.loading} aria-live="polite">
          <span className={minervaTheme.spinnerSm} aria-hidden />
          Loading voxels {Math.max(0, streaming.desired - streaming.pending)}/
          {streaming.desired}
        </output>
      ) : null}
      {splatsAvailable ? (
        <div className={styles.group}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={!showSplats}
            onClick={() => onDisplay("volume")}
          >
            Volume data
          </button>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={showSplats}
            onClick={() => onDisplay("splats")}
          >
            Splats
          </button>
        </div>
      ) : null}
      {!showSplats && streaming ? (
        <DetailControl
          detail={detail}
          autoLod={streaming.finestLod}
          maxLod={viewer.metadata.maxLod}
          onChange={onDetail}
        />
      ) : null}
    </div>
  );
}

/** "Full" at level 0, else the linear downsampling factor. */
function lodLabel(lod: number): string {
  return lod === 0 ? "Full" : `1/${2 ** lod}`;
}

/**
 * Data resolution: Auto follows the screen (finer when zoomed in); a fixed
 * level streams that pyramid level everywhere in view.
 */
function DetailControl({
  detail,
  autoLod,
  maxLod,
  onChange,
}: {
  detail: number | null;
  autoLod: number;
  maxLod: number;
  onChange: (lod: number | null) => void;
}) {
  const lod = detail ?? autoLod;
  return (
    <div className={styles.group}>
      <span className={styles.prefix}>Detail</span>
      <label className={styles.auto}>
        <input
          type="checkbox"
          checked={detail === null}
          onChange={(e) => onChange(e.currentTarget.checked ? null : autoLod)}
        />
        Auto
      </label>
      <input
        type="range"
        aria-label="Detail level"
        className={detail === null ? styles.autoRange : undefined}
        min={0}
        max={maxLod}
        step={1}
        value={maxLod - lod}
        onChange={(e) => onChange(maxLod - Number(e.currentTarget.value))}
      />
      <span className={styles.value}>{lodLabel(lod)}</span>
    </div>
  );
}
