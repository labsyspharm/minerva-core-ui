import {
  type ContrastLimits,
  fitChannelGmmContrastFromUint16,
} from "@/lib/imaging/autoContrast";
import { isImageChannel } from "@/lib/imaging/channelKind";
import {
  fetchPlaneRaster,
  rasterToUint16Array,
} from "@/lib/imaging/maskChannelRaster";
import { looksLikeImportDefaultLimits } from "@/lib/imaging/sourceChannelStyle";
import type { Loader } from "@/lib/imaging/viv";
import type { Channel } from "@/lib/stores/documentStore";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { applySourceChannelsToImages } from "@/lib/stores/storeUtils";

const GMM_VISIBLE_PAINT_BUDGET_MS = 800;
const FETCH_CONCURRENCY = 4;
const FIT_CONCURRENCY = 1;

type Lane = "now" | "idle";

type WriteGuard =
  | { kind: "still-missing" }
  | { kind: "unchanged"; expected: ContrastLimits };

type Job = {
  rasterKey: string;
  loader: Loader;
  sourceImageId: string;
  index: number;
  lane: Lane;
  channelIds: Set<string>;
  guards: Map<string, WriteGuard>;
};

type FitOutcome =
  | { kind: "fitted"; window: ContrastLimits }
  | { kind: "failed" };

type GmmFitSnapshot = {
  activeChannelIds: readonly string[];
  blockedChannelIds: readonly string[];
};

const emptySnapshot: GmmFitSnapshot = {
  activeChannelIds: [],
  blockedChannelIds: [],
};

let generation = 0;
const loadersByImageId = new Map<string, Loader>();
const jobsByKey = new Map<string, Job>();
const nowOrder: string[] = [];
const idleOrder: string[] = [];
const inFlight = new Map<string, Promise<FitOutcome>>();
const failedKeys = new Set<string>();
const blockedIds = new Set<string>();
const paintReleasedIds = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: GmmFitSnapshot = emptySnapshot;
let budgetTimer: ReturnType<typeof setTimeout> | null = null;
const fetchWaiters: (() => void)[] = [];
const fitNowWaiters: (() => void)[] = [];
const fitIdleWaiters: (() => void)[] = [];
const fetchUsedBox = { n: 0 };
const fitUsedBox = { n: 0 };

function rasterKey(sourceImageId: string, index: number): string {
  return `${sourceImageId}\0${index}`;
}

function limitsEqual(
  a: { lower?: number; upper?: number } | undefined,
  b: ContrastLimits,
): boolean {
  return a != null && a.lower === b.lower && a.upper === b.upper;
}

function asWindow(
  limits: { lower?: number; upper?: number } | undefined,
): ContrastLimits | undefined {
  if (limits?.lower == null || limits.upper == null) return undefined;
  return { lower: limits.lower, upper: limits.upper };
}

function isEligible(sc: Channel): boolean {
  return isImageChannel(sc) && sc.samples !== 3;
}

function acquire(used: { n: number }, waiters: (() => void)[], max: number) {
  return new Promise<void>((resolve) => {
    if (used.n < max) {
      used.n++;
      resolve();
      return;
    }
    waiters.push(() => {
      used.n++;
      resolve();
    });
  });
}

function releaseFetch() {
  fetchUsedBox.n = Math.max(0, fetchUsedBox.n - 1);
  fetchWaiters.shift()?.();
}

function acquireFit(lane: Lane) {
  return new Promise<void>((resolve) => {
    if (fitUsedBox.n < FIT_CONCURRENCY) {
      fitUsedBox.n++;
      resolve();
      return;
    }
    (lane === "now" ? fitNowWaiters : fitIdleWaiters).push(resolve);
  });
}

function releaseFit() {
  fitUsedBox.n = Math.max(0, fitUsedBox.n - 1);
  const next = fitNowWaiters.shift() ?? fitIdleWaiters.shift();
  if (next) {
    fitUsedBox.n++;
    next();
  }
}

function sameIds(ids: readonly string[], set: ReadonlySet<string>): boolean {
  if (ids.length !== set.size) return false;
  return ids.every((id) => set.has(id));
}

function notify() {
  const active = new Set<string>();
  for (const job of jobsByKey.values()) {
    if (!inFlight.has(job.rasterKey)) continue;
    for (const id of job.channelIds) active.add(id);
  }
  if (
    sameIds(snapshot.activeChannelIds, active) &&
    sameIds(snapshot.blockedChannelIds, blockedIds)
  ) {
    return;
  }
  snapshot = {
    activeChannelIds: [...active],
    blockedChannelIds: [...blockedIds],
  };
  for (const listener of listeners) listener();
}

function readChannel(channelId: string): Channel | undefined {
  return flattenImageChannelsInDocumentOrder(
    useDocumentStore.getState().images,
  ).find((sc) => sc.id === channelId);
}

function removeFromQueues(key: string) {
  const nowIdx = nowOrder.indexOf(key);
  if (nowIdx >= 0) nowOrder.splice(nowIdx, 1);
  const idleIdx = idleOrder.indexOf(key);
  if (idleIdx >= 0) idleOrder.splice(idleIdx, 1);
}

function enqueue(job: Job, lane: Lane) {
  removeFromQueues(job.rasterKey);
  job.lane = lane;
  const order = lane === "now" ? nowOrder : idleOrder;
  if (!order.includes(job.rasterKey)) order.push(job.rasterKey);
}

function dropBlocked(channelId: string) {
  blockedIds.delete(channelId);
  paintReleasedIds.delete(channelId);
}

function finishJob(job: Job, outcome: FitOutcome, gen: number) {
  if (gen !== generation) return;
  for (const id of job.channelIds) {
    if (outcome.kind === "failed") dropBlocked(id);
    else if (readChannel(id)?.gmmContrastLimits) dropBlocked(id);
  }
  jobsByKey.delete(job.rasterKey);
  removeFromQueues(job.rasterKey);
  inFlight.delete(job.rasterKey);
  notify();
}

function commitFitted(job: Job, window: ContrastLimits): void {
  const doc = useDocumentStore.getState();
  const channels = flattenImageChannelsInDocumentOrder(doc.images);
  let changed = false;
  const next = channels.map((sc) => {
    if (!job.channelIds.has(sc.id)) return sc;
    const guard = job.guards.get(sc.id) ?? { kind: "still-missing" as const };
    if (guard.kind === "still-missing") {
      if (sc.gmmContrastLimits) return sc;
    } else if (!limitsEqual(sc.gmmContrastLimits, guard.expected)) {
      return sc;
    }
    changed = true;
    return {
      ...sc,
      gmmContrastLimits: { lower: window.lower, upper: window.upper },
      lowerLimit: window.lower,
      upperLimit: window.upper,
    };
  });
  if (changed) {
    doc.setImages(applySourceChannelsToImages(doc.images, next));
  }

  let groupsChanged = false;
  const nextGroups = doc.channelGroups.map((g) => ({
    ...g,
    channels: g.channels.map((gc) => {
      if (!job.channelIds.has(gc.channelId)) return gc;
      if (!looksLikeImportDefaultLimits(gc.lowerLimit, gc.upperLimit)) {
        return gc;
      }
      groupsChanged = true;
      return {
        ...gc,
        lowerLimit: window.lower,
        upperLimit: window.upper,
      };
    }),
  }));
  if (groupsChanged) doc.setChannelGroups(nextGroups);
}

async function runJob(job: Job, gen: number): Promise<FitOutcome> {
  await acquire(fetchUsedBox, fetchWaiters, FETCH_CONCURRENCY);
  let u16: Uint16Array | null = null;
  try {
    if (gen !== generation) return { kind: "failed" };
    const hit = await fetchPlaneRaster(job.loader, job.index, {
      preferCoarsest: true,
    });
    if (hit?.raster?.data && hit.raster.data.length > 0) {
      u16 = rasterToUint16Array(hit.raster.data);
    }
  } finally {
    releaseFetch();
    pump();
  }

  if (gen !== generation) return { kind: "failed" };
  if (!u16) {
    failedKeys.add(job.rasterKey);
    finishJob(job, { kind: "failed" }, gen);
    pump();
    return { kind: "failed" };
  }

  await acquireFit(job.lane);
  let window: ContrastLimits | null = null;
  try {
    if (gen === generation) {
      window = await fitChannelGmmContrastFromUint16(u16);
    }
  } finally {
    releaseFit();
  }

  if (gen !== generation) return { kind: "failed" };
  if (!window) {
    failedKeys.add(job.rasterKey);
    finishJob(job, { kind: "failed" }, gen);
    pump();
    return { kind: "failed" };
  }

  commitFitted(job, window);
  finishJob(job, { kind: "fitted", window }, gen);
  pump();
  return { kind: "fitted", window };
}

function intern(job: Job): Promise<FitOutcome> {
  const existing = inFlight.get(job.rasterKey);
  if (existing) return existing;
  removeFromQueues(job.rasterKey);
  const gen = generation;
  const promise = runJob(job, gen).catch((error): FitOutcome => {
    if (import.meta.env.DEV) {
      console.warn("[psudo] gmm job failed", error);
    }
    if (gen === generation) {
      failedKeys.add(job.rasterKey);
      finishJob(job, { kind: "failed" }, gen);
      pump();
    }
    return { kind: "failed" };
  });
  inFlight.set(job.rasterKey, promise);
  notify();
  return promise;
}

function pump() {
  for (const key of [...nowOrder]) {
    const job = jobsByKey.get(key);
    if (!job || inFlight.has(key)) continue;
    intern(job);
  }
  const nowPending = nowOrder.some((key) => !inFlight.has(key));
  if (nowPending) return;
  for (const key of [...idleOrder]) {
    const job = jobsByKey.get(key);
    if (!job || inFlight.has(key)) continue;
    intern(job);
  }
}

function armBudget() {
  if (budgetTimer != null || blockedIds.size === 0) return;
  budgetTimer = setTimeout(() => {
    budgetTimer = null;
    for (const id of [...blockedIds]) {
      paintReleasedIds.add(id);
      blockedIds.delete(id);
    }
    notify();
  }, GMM_VISIBLE_PAINT_BUDGET_MS);
}

function attachChannel(job: Job, channelId: string, guard: WriteGuard) {
  job.channelIds.add(channelId);
  const prev = job.guards.get(channelId);
  if (!(prev?.kind === "unchanged" && guard.kind === "still-missing")) {
    job.guards.set(channelId, guard);
  }
}

function upsertJob(args: {
  sc: Channel;
  loader: Loader;
  guard: WriteGuard;
  lane: Lane;
  retryFailed: boolean;
}): Job | null {
  const { sc, loader, guard, lane, retryFailed } = args;
  const key = rasterKey(sc.imageId, sc.index);
  if (failedKeys.has(key)) {
    if (!retryFailed) return null;
    failedKeys.delete(key);
  }
  const existing = jobsByKey.get(key);
  if (existing) {
    attachChannel(existing, sc.id, guard);
    if (lane === "now") existing.lane = "now";
    if (!inFlight.has(key)) enqueue(existing, existing.lane);
    return existing;
  }
  const job: Job = {
    rasterKey: key,
    loader,
    sourceImageId: sc.imageId,
    index: sc.index,
    lane,
    channelIds: new Set([sc.id]),
    guards: new Map([[sc.id, guard]]),
  };
  jobsByKey.set(key, job);
  enqueue(job, lane);
  return job;
}

function targetFor(channelId: string): { sc: Channel; loader: Loader } | null {
  const sc = readChannel(channelId);
  if (!sc || !isEligible(sc)) return null;
  const loader = loadersByImageId.get(sc.imageId);
  if (!loader) return null;
  return { sc, loader };
}

function blockVisible(channelId: string) {
  if (paintReleasedIds.has(channelId) || blockedIds.has(channelId)) return;
  const sc = readChannel(channelId);
  if (!sc || sc.gmmContrastLimits || !isEligible(sc)) return;
  blockedIds.add(channelId);
}

export function reconcileGmm(args: {
  loaderEntries: readonly { loader: Loader; sourceImageId: string }[];
  channels: readonly Channel[];
  visibleChannelIds: ReadonlySet<string>;
}): void {
  const { loaderEntries, channels, visibleChannelIds } = args;
  loadersByImageId.clear();
  for (const entry of loaderEntries) {
    loadersByImageId.set(entry.sourceImageId, entry.loader);
  }
  const liveIds = new Set(loaderEntries.map((e) => e.sourceImageId));
  for (const [key, job] of [...jobsByKey]) {
    if (liveIds.has(job.sourceImageId)) continue;
    if (!inFlight.has(key)) {
      jobsByKey.delete(key);
      removeFromQueues(key);
    }
  }

  for (const sc of channels) {
    if (!isEligible(sc) || !loadersByImageId.has(sc.imageId)) continue;
    if (sc.gmmContrastLimits) continue;
    const loader = loadersByImageId.get(sc.imageId);
    if (!loader) continue;
    const visible = visibleChannelIds.has(sc.id);
    const job = upsertJob({
      sc,
      loader,
      guard: { kind: "still-missing" },
      lane: visible ? "now" : "idle",
      retryFailed: false,
    });
    if (!job) continue;
    if (visible) blockVisible(sc.id);
  }

  armBudget();
  notify();
  pump();
}

export async function ensureGmm(
  channelIds: readonly string[],
): Promise<Map<string, ContrastLimits>> {
  const result = new Map<string, ContrastLimits>();
  const waits: Promise<void>[] = [];
  for (const channelId of channelIds) {
    const target = targetFor(channelId);
    if (!target) continue;
    const current = asWindow(target.sc.gmmContrastLimits);
    if (current) {
      result.set(channelId, { lower: current.lower, upper: current.upper });
      continue;
    }
    const job = upsertJob({
      sc: target.sc,
      loader: target.loader,
      guard: { kind: "still-missing" },
      lane: "now",
      retryFailed: true,
    });
    if (!job) continue;
    waits.push(
      intern(job).then(() => {
        const sc = readChannel(channelId);
        const limits = asWindow(sc?.gmmContrastLimits);
        if (limits)
          result.set(channelId, { lower: limits.lower, upper: limits.upper });
      }),
    );
  }
  notify();
  pump();
  await Promise.all(waits);
  return result;
}

export async function refitGmm(
  channelId: string,
): Promise<ContrastLimits | null> {
  const target = targetFor(channelId);
  if (!target) return null;
  const key = rasterKey(target.sc.imageId, target.sc.index);
  const running = inFlight.get(key);
  if (running) await running;
  const latest = targetFor(channelId);
  if (!latest) return null;
  const expected = asWindow(latest.sc.gmmContrastLimits);
  const guard: WriteGuard = expected
    ? {
        kind: "unchanged",
        expected: { lower: expected.lower, upper: expected.upper },
      }
    : { kind: "still-missing" };
  const job = upsertJob({
    sc: latest.sc,
    loader: latest.loader,
    guard,
    lane: "now",
    retryFailed: true,
  });
  if (!job) return null;
  notify();
  const outcome = await intern(job);
  if (outcome.kind !== "fitted") return null;
  const sc = readChannel(channelId);
  if (!limitsEqual(sc?.gmmContrastLimits, outcome.window)) return null;
  return { lower: outcome.window.lower, upper: outcome.window.upper };
}

export function subscribeGmmFit(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getGmmFitSnapshot(): GmmFitSnapshot {
  return snapshot;
}

export function clearGmmScheduler(): void {
  generation += 1;
  loadersByImageId.clear();
  jobsByKey.clear();
  nowOrder.length = 0;
  idleOrder.length = 0;
  inFlight.clear();
  failedKeys.clear();
  blockedIds.clear();
  paintReleasedIds.clear();
  if (budgetTimer != null) {
    clearTimeout(budgetTimer);
    budgetTimer = null;
  }
  snapshot = emptySnapshot;
  for (const listener of listeners) listener();
}
