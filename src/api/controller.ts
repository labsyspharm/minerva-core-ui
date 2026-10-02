/**
 * Programmatic handle for a mounted Minerva view (`ref` of `<MinervaStory>`,
 * return value of the CDN `MinervaStory.play()`).
 *
 * - `getState` / `subscribe`: `useSyncExternalStore`-compatible snapshot.
 * - `execute` / `listCommands`: generic, schema-described commands (the
 *   future MCP / agent surface). Never throws.
 * - Typed helpers (`goToWaypoint`, …): thin wrappers over `execute` that
 *   resolve to the new state and reject with {@link MinervaCommandError}.
 */

import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  describeMinervaCommands,
  type MinervaCommandDescriptor,
  MinervaCommandError,
  type MinervaCommandInput,
  type MinervaCommandName,
  type MinervaCommandResult,
  type MinervaHost,
  runMinervaCommand,
} from "./commands";
import {
  type MinervaState,
  type MinervaStatus,
  minervaStateDeps,
  readMinervaState,
} from "./state";

export type MinervaStateListener = (state: MinervaState) => void;

export type MinervaHandle = {
  getState: () => MinervaState;
  subscribe: (listener: MinervaStateListener) => () => void;
  /** Resolves once a document is shown; rejects if loading fails. */
  whenReady: () => Promise<MinervaState>;

  listCommands: () => MinervaCommandDescriptor[];
  /** Validated at runtime, so agents may pass any name / JSON input. */
  execute: (
    name: MinervaCommandName | (string & {}),
    input?: unknown,
  ) => Promise<MinervaCommandResult>;

  loadDocument: (document: string | object) => Promise<MinervaState>;
  /** Index, waypoint id, or title. */
  goToWaypoint: (waypoint: number | string) => Promise<MinervaState>;
  nextWaypoint: () => Promise<MinervaState>;
  previousWaypoint: () => Promise<MinervaState>;
  /** Group id or name. */
  setChannelGroup: (group: string) => Promise<MinervaState>;
  setChannelVisibility: (
    channel: string,
    visible: boolean,
    group?: string,
  ) => Promise<MinervaState>;
  setView: (view: MinervaCommandInput<"setView">) => Promise<MinervaState>;
  resetView: () => Promise<MinervaState>;
};

/** The view-side half: what the mounting component uses to drive the handle. */
export type MinervaController = {
  handle: MinervaHandle;
  /** Capabilities of the mounted view; commands read it at call time. */
  host: MinervaHost;
  /** Report load progress (drives `state.status` and `whenReady`). */
  setStatus: (status: MinervaStatus, error?: string | null) => void;
  /** Drop all listeners (and with them the store subscriptions). */
  dispose: () => void;
};

const depsEqual = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

export function createMinervaController(): MinervaController {
  const host: MinervaHost = {};
  let status: MinervaStatus = "idle";
  let error: string | null = null;
  let deps: readonly unknown[] = [];
  let snapshot: MinervaState | null = null;
  let lastNotified: MinervaState | null = null;
  const listeners = new Set<MinervaStateListener>();
  let notifyQueued = false;
  let unsubscribeStores: (() => void) | null = null;

  const getState = (): MinervaState => {
    const nextDeps = [...minervaStateDeps(), status, error];
    if (snapshot && depsEqual(deps, nextDeps)) return snapshot;
    deps = nextDeps;
    snapshot = readMinervaState(status, error);
    return snapshot;
  };

  /** Coalesce store bursts (one command often sets several slices). */
  const scheduleNotify = () => {
    if (notifyQueued || listeners.size === 0) return;
    notifyQueued = true;
    queueMicrotask(() => {
      notifyQueued = false;
      const next = getState();
      if (next === lastNotified) return;
      lastNotified = next;
      for (const l of [...listeners]) l(next);
    });
  };

  const ensureStoreSubscription = () => {
    if (unsubscribeStores) return;
    const a = useDocumentStore.subscribe(scheduleNotify);
    const b = useAppStore.subscribe(scheduleNotify);
    unsubscribeStores = () => {
      a();
      b();
    };
  };

  const releaseStores = () => {
    unsubscribeStores?.();
    unsubscribeStores = null;
  };

  const subscribe = (listener: MinervaStateListener) => {
    listeners.add(listener);
    ensureStoreSubscription();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) releaseStores();
    };
  };

  const whenReady = () =>
    new Promise<MinervaState>((resolve, reject) => {
      const check = (s: MinervaState) => {
        if (s.status === "ready") {
          off();
          resolve(s);
        } else if (s.status === "error") {
          off();
          reject(new MinervaCommandError("failed", s.error ?? "Load failed"));
        }
      };
      const off = subscribe(check);
      check(getState());
    });

  const execute: MinervaHandle["execute"] = (name, input) =>
    runMinervaCommand(name, input, { host, getState });

  const call = async <N extends MinervaCommandName>(
    name: N,
    input?: MinervaCommandInput<N>,
  ) => {
    const result = await execute(name, input);
    if (result.ok === false) {
      throw new MinervaCommandError(result.code, result.error);
    }
    return result.state;
  };

  const handle: MinervaHandle = {
    getState,
    subscribe,
    whenReady,
    listCommands: describeMinervaCommands,
    execute,
    loadDocument: (document) =>
      call(
        "loadDocument",
        typeof document === "string"
          ? { url: document }
          : { document: document as Record<string, unknown> },
      ),
    goToWaypoint: (waypoint) => call("goToWaypoint", { waypoint }),
    nextWaypoint: () => call("nextWaypoint"),
    previousWaypoint: () => call("previousWaypoint"),
    setChannelGroup: (group) => call("setChannelGroup", { group }),
    setChannelVisibility: (channel, visible, group) =>
      call("setChannelVisibility", { channel, visible, group }),
    setView: (view) => call("setView", view),
    resetView: () => call("resetView"),
  };

  return {
    handle,
    host,
    setStatus: (nextStatus, nextError = null) => {
      status = nextStatus;
      error = nextError;
      scheduleNotify();
    },
    dispose: () => {
      listeners.clear();
      releaseStores();
    },
  };
}
