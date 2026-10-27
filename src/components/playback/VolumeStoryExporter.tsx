/**
 * Export for stories on a 3D volume. The volume itself stays at its URL; the
 * export writes document.json + index.html and, optionally, Gaussian splats
 * trained from the volume — for each look the waypoints use (channel group ×
 * render mode, × density in volume rendering), one PLY per channel — so the
 * published story can play back without streaming voxels.
 *
 * Training uses the mounted VolumeViewer (through the volume bridge): each
 * group is shown, its channels streamed, then fit by kiln-render and trained
 * with Brush.
 */
import type { BuildProgress } from "kiln-render";
import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import { paintUngroupedExportColors } from "@/lib/imaging/psudoPalette";
import { writeDirectoryFile } from "@/lib/persistence/directoryFiles";
import { useAppStore } from "@/lib/stores/appStore";
import type { VolumeSplats } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  checkStoryPlayer,
  writeStoryBundleSidecars,
} from "@/lib/storyExport/storyBundle";
import {
  isVolumeImage,
  loadKiln,
  useVolumeImage,
} from "@/lib/volume/imsVolume";
import {
  forgetTrainedSplats,
  looksToTrain,
  rememberTrainedSplats,
  type SplatLook,
  splatFileName,
  storyCameras,
} from "@/lib/volume/splatCache";
import { RENDER_MODE_LABELS } from "@/lib/volume/view3d";
import { getActiveVolumeView } from "@/lib/volume/volumeViewerBridge";
import styles from "./ImageExporter.module.css";

type Handle = FileSystemDirectoryHandle;

/** Gaussians per look (68 bytes each in the PLY). */
const SIZES = [250_000, 500_000, 1_000_000, 2_000_000, 4_000_000];

const sizeLabel = (n: number) =>
  `${n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}k`} (≈${Math.round((n * 68) / 1e6)} MB per look)`;

/**
 * Standard: kiln's "fast" preset on the whole volume (≈33–34 dB held-out
 * PSNR on the melanoma sample). High: the two longest axes split into a 2×2
 * grid of tiles, each fit and trained with its own close-up views at a
 * finer pyramid level, with longer training — about 4× the detail per axis
 * area, and several times the time.
 */
const QUALITY = {
  standard: {
    label: "Standard",
    tileSplits: 0,
    iterations: 1500,
    views: 64,
    resolution: 512,
    size: 500_000,
  },
  high: {
    label: "High (2×2 tiles)",
    tileSplits: 2,
    iterations: 3000,
    views: 96,
    resolution: 768,
    size: 2_000_000,
  },
} as const;
type Quality = keyof typeof QUALITY;

/**
 * Story cameras (waypoints, flights between them) trained on per generated
 * view: 2/3 makes them 40% of the training set.
 */
const STORY_VIEWS_PER_VIEW = 2 / 3;

/** Share of one group's build per stage, for a single progress bar. */
const STAGE_SPAN: Record<string, [number, number]> = {
  fit: [0, 0.1],
  capture: [0.1, 0.4],
  train: [0.5, 0.5],
  done: [1, 0],
};

function lookLabel(groupName: string, look: SplatLook): string {
  return `${groupName} · ${RENDER_MODE_LABELS[look.renderMode]}`;
}

type Phase =
  | { kind: "confirm" }
  | { kind: "running"; group: number; label: string; ratio: number }
  | { kind: "done"; splats: VolumeSplats[] }
  | { kind: "error"; message: string };

export function VolumeStoryExporter(props: {
  directory_handle: Handle;
  stopExport: () => void;
}) {
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const volumeImage = useVolumeImage();
  const waypoints = useDocumentStore((s) => s.waypoints);
  const activeGroupId = useAppStore((s) => s.activeChannelGroupId);
  const looks = useMemo(
    () => looksToTrain(channelGroups, waypoints, activeGroupId),
    [channelGroups, waypoints, activeGroupId],
  );
  const [train, setTrain] = useState(true);
  const [quality, setQuality] = useState<Quality>("standard");
  const [size, setSize] = useState<number>(QUALITY.standard.size);
  const [phase, setPhase] = useState<Phase>({ kind: "confirm" });
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    const abort = new AbortController();
    abortRef.current = abort;
    const prevGroup = useAppStore.getState().activeChannelGroupId;
    const splats: VolumeSplats[] = [];
    try {
      await checkStoryPlayer();
      forgetTrainedSplats();
      if (train) {
        const view = getActiveVolumeView();
        if (!view) throw new Error("Open the story's 3D view, then export.");
        const { writePly } = await loadKiln();
        const preset = QUALITY[quality];
        for (const [i, { group, look }] of looks.entries()) {
          let best = 0;
          let tile = 0;
          let tiles = 1;
          const report = (label: string, ratio: number) => {
            best = Math.max(best, ratio);
            setPhase({
              kind: "running",
              group: i,
              // Builds are channels × tiles.
              label: tiles > 1 ? `Part ${tile + 1}/${tiles} · ${label}` : label,
              ratio: best,
            });
          };
          report(`Showing ${lookLabel(group.name, look)}…`, 0);
          useAppStore.getState().showOnlyChannelGroup(group.id);
          await view.waitUntilReady(abort.signal);
          const psnrs: number[] = [];
          const story = storyCameras(
            look,
            channelGroups,
            waypoints,
            activeGroupId,
            Math.round(preset.views * STORY_VIEWS_PER_VIEW),
          );
          const channelClouds = await view.trainSplats({
            iterations: preset.iterations,
            views: preset.views,
            resolution: preset.resolution,
            evaluateViews: 4,
            tileSplits: preset.tileSplits,
            // Tiled builds (High) leave these out; kiln ignores them there.
            extraViews: story.train,
            evaluateAt: story.evaluate.length > 0 ? story.evaluate : undefined,
            targetCount: size,
            renderMode: look.renderMode,
            density: look.density,
            signal: abort.signal,
            onTile: (index, count) => {
              tile = index;
              tiles = count;
            },
            onProgress: (p: BuildProgress) => {
              if (Number.isFinite(p.psnr)) psnrs.push(p.psnr as number);
              const [start, span] = STAGE_SPAN[p.stage] ?? [0, 0];
              report(p.label, (tile + start + span * p.fraction) / tiles);
            },
          });
          const psnr =
            psnrs.length > 0
              ? psnrs.reduce((a, b) => a + b, 0) / psnrs.length
              : undefined;
          rememberTrainedSplats(look, channelClouds);
          report("Saving splats…", 1);
          const channelIndex = (id: string) =>
            volumeImage?.channels.find((c) => c.id === id)?.index;
          for (const { channelId, cloud } of channelClouds) {
            const url = `splats/${splatFileName(
              look,
              channelId ? channelIndex(channelId) : undefined,
            )}`;
            await writeDirectoryFile(
              props.directory_handle,
              url,
              writePly(cloud) as Uint8Array<ArrayBuffer>,
            );
            splats.push({
              groupId: group.id,
              ...(channelId ? { channelId } : {}),
              renderMode: look.renderMode,
              ...(look.renderMode === "dvr" ? { density: look.density } : {}),
              url,
              count: cloud.count,
              ...(psnr !== undefined ? { psnr } : {}),
            });
          }
        }
      }
      setPhase({
        kind: "running",
        group: looks.length,
        label: "Writing document.json…",
        ratio: 1,
      });
      const doc = useDocumentStore.getState().toDocumentData();
      const images = doc.images.map((im) =>
        isVolumeImage(im)
          ? {
              ...im,
              source: {
                kind: im.source.kind,
                url: im.source.url,
                format: im.source.format,
                ...(splats.length > 0 ? { splats } : {}),
              },
            }
          : im,
      );
      await writeStoryBundleSidecars(
        props.directory_handle,
        {
          ...doc,
          images: await paintUngroupedExportColors(images, doc.channelGroups),
        },
        { mode: "remote-url" },
      );
      setPhase({ kind: "done", splats });
    } catch (e) {
      if (abort.signal.aborted) {
        props.stopExport();
        return;
      }
      console.error("[minerva] 3D story export failed", e);
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      abortRef.current = null;
      if (prevGroup) useAppStore.getState().showOnlyChannelGroup(prevGroup);
    }
  };

  if (phase.kind === "error") {
    return (
      <div className={styles.imageExporter}>
        <div className={styles.exportStatus}>
          <div className={styles.exportMessage}>
            Export failed: {phase.message}
          </div>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={props.stopExport}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "confirm") {
    return (
      <div className={styles.imageExporter}>
        <div className={styles.exportStatus}>
          <div className={styles.exportMessage}>
            <div>Export 3D story</div>
            <div className={styles.exportHint}>
              The volume stays at its URL. Splats let the published story play
              back without streaming voxels, and need no full-resolution data.
            </div>
            <label className={styles.exportOption}>
              <input
                type="checkbox"
                checked={train}
                onChange={(e) => setTrain(e.currentTarget.checked)}
              />{" "}
              Train splats for{" "}
              {looks.length === 1 && looks[0]
                ? `“${lookLabel(looks[0].group.name, looks[0].look)}”`
                : `${looks.length} looks (channel group × render mode)`}{" "}
              ({quality === "high" ? "15–30" : "3–8"} minutes each)
            </label>
            {train ? (
              <>
                <label className={styles.exportOption}>
                  Quality{" "}
                  <select
                    value={quality}
                    onChange={(e) => {
                      const q = e.currentTarget.value as Quality;
                      setQuality(q);
                      setSize(QUALITY[q].size);
                    }}
                  >
                    {Object.entries(QUALITY).map(([key, q]) => (
                      <option key={key} value={key}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.exportOption}>
                  Size{" "}
                  <select
                    value={size}
                    onChange={(e) => setSize(Number(e.currentTarget.value))}
                  >
                    {SIZES.map((n) => (
                      <option key={n} value={n}>
                        {sizeLabel(n)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={() => void run()}
              disabled={train && looks.length === 0}
            >
              Start export
            </button>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={props.stopExport}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const done = phase.kind === "done";
  const n = Math.max(1, looks.length);
  const ratio = done
    ? 1
    : Math.min(1, (phase.group + phase.ratio) / (train ? n : 1));
  return (
    <div className={styles.imageExporter}>
      <div className={styles.exportStatus}>
        <div className={styles.exportMessage}>
          {done
            ? phase.splats.length > 0
              ? `Exported document.json + index.html and ${phase.splats.length} splat file${phase.splats.length === 1 ? "" : "s"}`
              : "Exported document.json + index.html"
            : train && looks[phase.group]
              ? `${lookLabel(looks[phase.group].group.name, looks[phase.group].look)} (${phase.group + 1}/${looks.length}): ${phase.label}`
              : phase.label}
        </div>
        <div
          className={[styles.progressBar, done ? styles.progressBarDone : null]
            .filter(Boolean)
            .join(" ")}
          style={{ "--progress-ratio": ratio } as CSSProperties}
        >
          <div>
            <div></div>
          </div>
          <div> {(ratio * 100).toFixed(0)}% </div>
        </div>
        <button
          type="button"
          className={styles.dismissButton}
          onClick={() => {
            if (done) props.stopExport();
            else abortRef.current?.abort();
          }}
        >
          {done ? "Dismiss" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
