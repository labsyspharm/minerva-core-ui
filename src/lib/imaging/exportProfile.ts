import type { RandomAccessSink } from "tiffwriter";

/**
 * Export diagnostics. While an export runs, every 10 s this logs where tile
 * time goes (stage latencies, how busy each pool is, main-thread stalls) and
 * the remaining time shown; at the end, how the shown times compared with
 * what happened. Per-second samples stay on `globalThis.__minervaExportTrace`
 * (`copy(JSON.stringify(__minervaExportTrace))` in DevTools copies them).
 *
 * It only observes. One export runs at a time, so this is module state, and
 * every call is a no-op when no export is running (the decode pool also
 * serves the viewer).
 */

export type ExportStage =
  /** One export tile's pixels, read and assembled; bytes are the source blocks under it. */
  | "read"
  /** A merged read of source bytes. */
  | "fetch"
  /** One source block through the decode pool. */
  | "decode"
  /** One tile through the JPEG pool; workers also report their busy time. */
  | "encode"
  /** Worker time inside MozJPEG only (the rest of "encode" work is pixel conversion). */
  | "mozjpeg"
  /** One mask tile's zlib. */
  | "deflate"
  /** A tile waiting for room in the write queue. */
  | "queue"
  /** A tile appended by the TIFF writer, from queueing to written. */
  | "write"
  /** One write to the file. */
  | "disk";

const STAGES: ExportStage[] = [
  "read",
  "fetch",
  "decode",
  "encode",
  "mozjpeg",
  "deflate",
  "queue",
  "write",
  "disk",
];

type Trace = {
  startedAt: string;
  env: Record<string, unknown>;
  /** [seconds, text] */
  events: [number, string][];
  /**
   * Each second: [seconds, tiles written, tile reads (three per planar RGB
   * tile), source bytes read, output bytes written, remaining seconds shown
   * (null while estimating)].
   */
  samples: (number | null)[][];
  /** The 10-second reports, as data. */
  reports: Record<string, unknown>[];
};

const REPORT_MS = 10_000;
const SAMPLE_MS = 1_000;
const HEARTBEAT_MS = 100;
const LOG = "[minerva export]";

type Totals = {
  count: number;
  ms: number;
  maxMs: number;
  bytes: number;
  workMs: number;
};

const noTotals = (): Totals => ({
  count: 0,
  ms: 0,
  maxMs: 0,
  bytes: 0,
  workMs: 0,
});

function addTo(t: Totals, ms: number, bytes: number) {
  t.count += 1;
  t.ms += ms;
  t.maxMs = Math.max(t.maxMs, ms);
  t.bytes += bytes;
}

/** Latencies of one stage, and how many were outstanding over time. */
class StageMeter {
  interval = noTotals();
  readonly total = noTotals();
  private open = 0;
  private openMs = 0;
  private openSince: number;

  constructor(now: number) {
    this.openSince = now;
  }

  private settle(now: number) {
    this.openMs += this.open * (now - this.openSince);
    this.openSince = now;
  }

  begin(now: number) {
    this.settle(now);
    this.open += 1;
  }

  end(now: number, ms: number, bytes: number) {
    this.settle(now);
    this.open -= 1;
    addTo(this.interval, ms, bytes);
    addTo(this.total, ms, bytes);
  }

  work(ms: number) {
    this.interval.workMs += ms;
    this.total.workMs += ms;
  }

  /** Mean number outstanding since the last call. */
  takeOpen(now: number, spanMs: number): number {
    this.settle(now);
    const mean = spanMs > 0 ? this.openMs / spanMs : 0;
    this.openMs = 0;
    return mean;
  }

  takeInterval(): Totals {
    const t = this.interval;
    this.interval = noTotals();
    return t;
  }
}

export function formatSpan(ms: number): string {
  if (!Number.isFinite(ms)) return "?";
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(Math.floor(s % 60)).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e3).toFixed(0)} KB`;
}

const round = (n: number, digits = 1) => Number(n.toFixed(digits));

const average = (t: Totals, of: number) => (t.count ? of / t.count : 0);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function heapBytes(): number | null {
  const memory = (performance as { memory?: { usedJSHeapSize?: number } })
    .memory;
  return memory?.usedJSHeapSize ?? null;
}

function visibility(): string {
  return typeof document === "undefined" ? "n/a" : document.visibilityState;
}

class Profile {
  readonly t0 = performance.now();
  private readonly meters = new Map<ExportStage, StageMeter>();
  private tilesDone = 0;
  private tilesTotal = 0;
  private shownMs: number | null = null;
  private firstTileAt: number | null = null;
  private lastReportAt = this.t0;
  private lastReportTiles = 0;
  private lagSum = 0;
  private lagCount = 0;
  private lagMax = 0;
  private longTaskMs = 0;
  private readonly timers: number[] = [];
  private heartbeat = 0;
  private longTasks: PerformanceObserver | null = null;
  private readonly onVisibility = () =>
    this.event(`tab ${visibility()} (Chrome deprioritizes hidden tabs)`);
  readonly trace: Trace;

  constructor(label: string, env: Record<string, unknown>) {
    for (const stage of STAGES) this.meters.set(stage, new StageMeter(this.t0));
    this.trace = {
      startedAt: new Date().toISOString(),
      env: { label, ...env },
      events: [],
      samples: [],
      reports: [],
    };
    this.timers.push(
      window.setInterval(() => this.report(), REPORT_MS),
      window.setInterval(() => this.sample(), SAMPLE_MS),
    );
    let expected = this.t0 + HEARTBEAT_MS;
    const beat = () => {
      const now = performance.now();
      const lag = Math.max(0, now - expected);
      this.lagSum += lag;
      this.lagCount += 1;
      this.lagMax = Math.max(this.lagMax, lag);
      expected = now + HEARTBEAT_MS;
      this.heartbeat = window.setTimeout(beat, HEARTBEAT_MS);
    };
    this.heartbeat = window.setTimeout(beat, HEARTBEAT_MS);
    if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      this.longTasks = new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          this.longTaskMs += entry.duration;
      });
      this.longTasks.observe({ type: "longtask" });
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    console.log(
      `${LOG} start ${label} · ${Object.entries(env)
        .map(([k, v]) => `${k} ${v}`)
        .join(" · ")}`,
    );
  }

  meter(stage: ExportStage): StageMeter {
    return this.meters.get(stage) as StageMeter;
  }

  event(text: string) {
    const now = performance.now();
    this.trace.events.push([round((now - this.t0) / 1000), text]);
    console.log(`${LOG} +${formatSpan(now - this.t0)} ${text}`);
  }

  noteProgress(tilesDone: number, tilesTotal: number) {
    if (tilesDone > 0 && this.firstTileAt === null) {
      this.firstTileAt = performance.now();
    }
    this.tilesDone = tilesDone;
    this.tilesTotal = tilesTotal;
  }

  noteEta(shownMs: number | null) {
    this.shownMs = shownMs;
  }

  private sample() {
    const now = performance.now();
    const read = this.meter("read").total;
    this.trace.samples.push([
      round((now - this.t0) / 1000),
      this.tilesDone,
      read.count,
      read.bytes,
      this.meter("write").total.bytes,
      this.shownMs === null ? null : round(this.shownMs / 1000, 0),
    ]);
  }

  private report() {
    const now = performance.now();
    const span = now - this.lastReportAt;
    if (span <= 0) return;
    const perSec = (n: number) => n / (span / 1000);
    const stages = new Map(
      STAGES.map((stage) => {
        const meter = this.meter(stage);
        return [
          stage,
          { ...meter.takeInterval(), open: meter.takeOpen(now, span) },
        ] as const;
      }),
    );
    const s = (stage: ExportStage) =>
      stages.get(stage) as Totals & { open: number };
    const runMs = this.firstTileAt === null ? 0 : now - this.firstTileAt;
    const tileRate = perSec(this.tilesDone - this.lastReportTiles);
    const avgRate = runMs > 0 ? this.tilesDone / (runMs / 1000) : 0;
    const percent =
      this.tilesTotal > 0 ? (100 * this.tilesDone) / this.tilesTotal : 0;
    const encode = s("encode");
    const encodeWorkers = Number(this.trace.env.encodeWorkers) || 1;
    const heap = heapBytes();

    const latency = STAGES.flatMap((stage) => {
      const t = s(stage);
      if (!t.count) return [];
      const mean = t.ms / t.count;
      return [
        `${stage} ${mean.toFixed(mean < 10 ? 1 : 0)}/${t.maxMs.toFixed(0)}`,
      ];
    });
    const lines = [
      `${LOG} +${formatSpan(now - this.t0)} · tiles ${this.tilesDone}/${this.tilesTotal} (${percent.toFixed(1)}%) · ` +
        `${tileRate.toFixed(1)}/s now, ${avgRate.toFixed(1)}/s avg · ` +
        `remaining shown ${this.shownMs === null ? "-" : formatSpan(this.shownMs)}`,
      `  per tile: source ${formatBytes(average(s("read"), s("read").bytes))} · ` +
        `jpeg ${formatBytes(average(s("write"), s("write").bytes))} · ` +
        `encode work ${average(encode, encode.workMs).toFixed(0)} ms ` +
        `(MozJPEG ${average(encode, s("mozjpeg").workMs).toFixed(0)}, pixel conversion ${average(encode, encode.workMs - s("mozjpeg").workMs).toFixed(0)})`,
      `  stage ms avg/max: ${latency.join(" · ") || "-"}`,
      `  load: ${s("read").open.toFixed(1)} tiles reading · ` +
        `decode ${s("decode").open.toFixed(1)} open of ${this.trace.env.decodeWorkers} workers · ` +
        `encode ${encode.open.toFixed(1)} open of ${encodeWorkers} workers, ${((100 * encode.workMs) / (span * encodeWorkers)).toFixed(0)}% busy · ` +
        `disk ${((100 * s("disk").ms) / span).toFixed(0)}% busy (${s("disk").count} writes) · ` +
        `reads ${formatBytes(perSec(s("fetch").bytes))}/s`,
      `  main: lag avg ${(this.lagCount ? this.lagSum / this.lagCount : 0).toFixed(0)} ms, max ${this.lagMax.toFixed(0)} ms · ` +
        `long tasks ${(this.longTaskMs / 1000).toFixed(1)}s · heap ${heap === null ? "n/a" : formatBytes(heap)} · tab ${visibility()}`,
    ];
    console.log(lines.join("\n"));
    this.trace.reports.push({
      s: round((now - this.t0) / 1000),
      tiles: this.tilesDone,
      tileRate: round(tileRate),
      stages: Object.fromEntries(
        STAGES.map((stage) => {
          const t = s(stage);
          return [
            stage,
            {
              n: t.count,
              ms: round(t.ms),
              max: round(t.maxMs),
              bytes: t.bytes,
              work: round(t.workMs),
              open: round(t.open, 2),
            },
          ];
        }),
      ),
      lagMax: round(this.lagMax),
      longTaskMs: round(this.longTaskMs),
      heap,
      visible: visibility(),
    });
    this.lastReportAt = now;
    this.lastReportTiles = this.tilesDone;
    this.lagSum = 0;
    this.lagCount = 0;
    this.lagMax = 0;
    this.longTaskMs = 0;
  }

  /** The remaining time shown against what was left, at each tenth of the tiles. */
  private etaByTenth(endS: number): string {
    const { samples } = this.trace;
    if (this.tilesTotal <= 0) return "-";
    const checks: string[] = [];
    for (let tenth = 1; tenth <= 9; tenth++) {
      const row = samples.find(
        (r) => (r[1] as number) >= (this.tilesTotal * tenth) / 10,
      );
      if (!row) break;
      const actual = endS - (row[0] as number);
      const shown = row[5] as number | null;
      const off =
        shown === null || actual <= 0
          ? ""
          : ` (${shown >= actual ? "+" : ""}${Math.round((100 * (shown - actual)) / actual)}%)`;
      checks.push(
        `${tenth * 10}% ${shown === null ? "-" : formatSpan(shown * 1000)} vs ${formatSpan(actual * 1000)}${off}`,
      );
    }
    return checks.join(" · ") || "-";
  }

  /**
   * How far the shown time strays from a steady countdown: over each 10 s it
   * should fall by 10 s. Median and 90th percentile of the miss, in seconds.
   */
  private etaJitter(): string {
    const shown = this.trace.samples.filter((r) => r[5] !== null);
    const misses: number[] = [];
    for (let i = 0; i + 10 < shown.length; i += 10) {
      const [t0, , , , , eta0] = shown[i] as number[];
      const [t1, , , , , eta1] = shown[i + 10] as number[];
      misses.push(Math.abs(eta1 - eta0 + (t1 - t0)));
    }
    if (misses.length === 0) return "-";
    return `median ${formatSpan(1000 * percentile(misses, 0.5))}, 90th percentile ${formatSpan(1000 * percentile(misses, 0.9))} per 10 s (a steady countdown misses by 0)`;
  }

  finish(outcome: string) {
    this.report();
    this.sample();
    for (const id of this.timers) window.clearInterval(id);
    window.clearTimeout(this.heartbeat);
    this.longTasks?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);

    const now = performance.now();
    const total = (stage: ExportStage) => this.meter(stage).total;
    const runS =
      this.firstTileAt === null ? 0 : (now - this.firstTileAt) / 1000;
    const means = STAGES.flatMap((stage) => {
      const t = total(stage);
      if (!t.count) return [];
      const mozJpeg =
        stage === "encode"
          ? `, ${(total("mozjpeg").workMs / t.count).toFixed(0)} in MozJPEG`
          : "";
      const work = t.workMs
        ? ` (${(t.workMs / t.count).toFixed(0)} work${mozJpeg})`
        : "";
      return [`${stage} ${(t.ms / t.count).toFixed(1)}${work}`];
    });
    console.log(
      [
        `${LOG} ${outcome} after ${formatSpan(now - this.t0)} (first tile at ${this.firstTileAt === null ? "-" : formatSpan(this.firstTileAt - this.t0)}) · ` +
          `${this.tilesDone} tiles · ${runS > 0 ? (this.tilesDone / runS).toFixed(1) : "-"}/s · ` +
          `source read ${formatBytes(total("fetch").bytes)} in ${total("fetch").count} reads · jpeg ${formatBytes(total("write").bytes)}`,
        `  mean ms: ${means.join(" · ") || "-"}`,
        `  remaining shown vs actual, at each tenth of the tiles: ${this.etaByTenth((now - this.t0) / 1000)}`,
        `  remaining-time jitter: ${this.etaJitter()}`,
        `  per-second samples: copy(JSON.stringify(__minervaExportTrace))`,
      ].join("\n"),
    );
  }
}

let active: Profile | null = null;

const noop = () => {};

/** Begin logging an export; `env` is printed once and kept in the trace. */
export function startExportProfile(
  label: string,
  env: Record<string, unknown>,
): void {
  active?.finish("replaced");
  active = new Profile(label, {
    cores: navigator.hardwareConcurrency,
    memoryGB: (navigator as { deviceMemory?: number }).deviceMemory ?? "n/a",
    ...env,
  });
  (globalThis as { __minervaExportTrace?: Trace }).__minervaExportTrace =
    active.trace;
}

/** Final report; `outcome` is e.g. "done", "failed", "cancelled". */
export function endExportProfile(outcome: string): void {
  active?.finish(outcome);
  active = null;
}

/** Start timing one `stage` item; call the result when it is done. */
export function exportSpan(stage: ExportStage): (bytes?: number) => void {
  const profile = active;
  if (!profile) return noop;
  const meter = profile.meter(stage);
  const start = performance.now();
  meter.begin(start);
  return (bytes = 0) => {
    const now = performance.now();
    meter.end(now, now - start, bytes);
  };
}

/** Run `work` as one timed `stage` item; `bytes` sizes its result. */
export async function timed<T>(
  stage: ExportStage,
  work: () => Promise<T>,
  bytes?: (result: T) => number,
): Promise<T> {
  const done = exportSpan(stage);
  let size = 0;
  try {
    const result = await work();
    size = bytes?.(result) ?? 0;
    return result;
  } finally {
    done(size);
  }
}

/** Busy time a worker reported for one `stage` item. */
export function exportWork(stage: ExportStage, ms: number): void {
  active?.meter(stage).work(ms);
}

/** A one-off line: a file starting, a file closing. */
export function exportEvent(text: string): void {
  active?.event(text);
}

export function noteExportProgress(tilesDone: number, tilesTotal: number) {
  active?.noteProgress(tilesDone, tilesTotal);
}

/** The remaining time the progress bar shows (null while estimating). */
export function noteExportEta(shownMs: number | null): void {
  active?.noteEta(shownMs);
}

/** `sink` with each write timed as "disk"; it writes exactly as before. */
export function timedSink(sink: RandomAccessSink): RandomAccessSink {
  return {
    async writeAt(offset, data) {
      const done = exportSpan("disk");
      try {
        await sink.writeAt(offset, data);
      } finally {
        done(data.byteLength);
      }
    },
    truncate: sink.truncate ? (size) => sink.truncate(size) : undefined,
    close: sink.close ? () => sink.close() : undefined,
    abort: sink.abort ? (reason) => sink.abort(reason) : undefined,
  };
}
