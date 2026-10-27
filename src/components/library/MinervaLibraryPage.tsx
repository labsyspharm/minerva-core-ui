import * as React from "react";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import type {
  OmeImportRequest,
  OmeImportResult,
} from "@/components/shared/Upload";
import { Upload } from "@/components/shared/Upload";
import { useClickOutside } from "@/components/shared/useClickOutside";
import { hasDirectoryPickerAccess, toFile } from "@/lib/imaging/filesystem";
import { getDemoDocumentTitle } from "@/lib/persistence/demo";
import { listStorySummaries } from "@/lib/persistence/storyPersistence";
import type { StorySummary } from "@/lib/persistence/types";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  importStoryFolderFromPicker,
  importStoryFromUrl,
  importStoryJsonFile,
  importStoryJsonFromPicker,
} from "@/lib/storyExport/importStoryFolder";
import { buildStamp } from "@/lib/version/buildStamp";
import { classifyViewerLaunchUrl } from "@/lib/viewer/launchUrl";
import { rootRouteApi } from "@/router/appRouter";
import styles from "./MinervaLibraryPage.module.css";

const APP_TAB_TITLE_PREFIX = getDemoDocumentTitle();
const BUILD_STAMP = buildStamp();

/**
 * s3://lsp-private-data/Minerva/CRC01/document.json
 * HTTPS so `?src=` fetches it like any other story config.
 */
const DEMO_STORY_URL =
  "https://lsp-private-data.s3.amazonaws.com/Minerva/CRC01/document.json";

/** One-shot handoff: library stash → story page consumes after navigate. */
type PendingLibraryImport =
  | ({ kind: "ome" } & Omit<OmeImportRequest, "append">)
  | { kind: "dicomWeb"; url: string };

let pendingLibraryImport: PendingLibraryImport | null = null;
/** Stays set across the story mount so the demo effect does not also download. */
let libraryImportTookAutoload = false;
/**
 * One open per `?src=` value. Cleared when that param leaves, so View example
 * can be opened again. React Strict Mode remounts the library effect.
 */
let claimedLaunchUrl: string | null = null;

export function hasPendingLibraryImport(): boolean {
  return pendingLibraryImport != null;
}

export function libraryImportSuppressesDemo(): boolean {
  return libraryImportTookAutoload;
}

/** Runs once on story mount when the library stashed an image import. */
export function ConsumePendingLibraryImport({
  importOme,
  importDicomWeb,
  onSettled,
}: {
  importOme: (req: OmeImportRequest) => Promise<OmeImportResult>;
  importDicomWeb: (req: { url: string }) => Promise<OmeImportResult>;
  onSettled: () => void;
}) {
  const importOmeRef = React.useRef(importOme);
  importOmeRef.current = importOme;
  const importDicomWebRef = React.useRef(importDicomWeb);
  importDicomWebRef.current = importDicomWeb;

  React.useEffect(() => {
    const pending = pendingLibraryImport;
    pendingLibraryImport = null;
    // Empty take must not call onSettled (clearImageLoading) — that would
    // invalidate hydrate / eager-GMM epochs on every story open.
    if (!pending) return;

    const imported =
      pending.kind === "dicomWeb"
        ? importDicomWebRef.current({ url: pending.url })
        : importOmeRef.current({
            role: pending.role,
            append: false,
            rgbDisplay: pending.rgbDisplay,
            channelNames: pending.channelNames,
            source: pending.source,
          });
    // Always settle — Strict Mode remounts this effect after pending is already
    // taken; skipping onSettled leaves the story "Loading…" overlay stuck.
    void imported
      .then((result) => {
        if (result.ok === false) window.alert(result.error);
      })
      .finally(onSettled);
  }, [onSettled]);

  return null;
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

function ShelfBoard() {
  return <div className={styles.shelfBoard} aria-hidden />;
}

function seededRand(seed: number): () => number {
  // Mix small integer seeds so adjacent bays don't all start near 0.
  let s = Math.imul(seed, 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const GHOST_GAP_PX = 2;
const GHOST_MIN_W = 7;
const GHOST_MAX_W = 14;

function readInnerWidthPx(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const pl = Number.parseFloat(cs.paddingLeft) || 0;
  const pr = Number.parseFloat(cs.paddingRight) || 0;
  return el.clientWidth - pl - pr;
}

/** Empty-shelf decoration only — never rendered on story / prompt rows. */
function GhostBooks({ bayIndex }: { bayIndex: number }) {
  const shelfRef = React.useRef<HTMLDivElement>(null);
  const [innerW, setInnerW] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = shelfRef.current;
    if (!el) return;

    const measure = () => {
      setInnerW(readInnerWidthPx(el));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const books = React.useMemo(() => {
    if (innerW <= 0) return [];
    const rand = seededRand(bayIndex * 997 + 42);
    // Pack to a share of the measured bay. Mild bias toward full, wide leftover.
    const fill = 0.38 + 0.62 * rand() ** 0.7;
    const target = innerW * fill;

    const out: {
      key: number;
      width: number;
      height: number;
      color: string;
    }[] = [];
    let used = 0;
    let i = 0;
    while (used < target) {
      const spaceLeft = innerW - used - (out.length > 0 ? GHOST_GAP_PX : 0);
      if (spaceLeft < GHOST_MIN_W) break;
      const maxForThis = Math.min(GHOST_MAX_W, spaceLeft);
      const width =
        GHOST_MIN_W + Math.floor(rand() * (maxForThis - GHOST_MIN_W + 1));
      used += (out.length > 0 ? GHOST_GAP_PX : 0) + width;
      out.push({
        key: i,
        width,
        height: 22 + Math.floor(rand() * 16),
        color: `var(--cloth-${1 + Math.floor(rand() * 6)})`,
      });
      i += 1;
      if (i > 400) break;
    }
    return out;
  }, [bayIndex, innerW]);

  return (
    <div ref={shelfRef} className={styles.ghostShelf} aria-hidden>
      {books.map((b) => (
        <div
          key={b.key}
          className={styles.ghostBook}
          style={{
            width: b.width,
            height: b.height,
            background: b.color,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Intake row is its own shelf above. Pad story bays to this many so the
 * bookcase still reads as a full stack when few stories exist (7 + intake = 8).
 */
const STORY_BAYS = 7;

type BaySlot =
  | { kind: "story"; story: StorySummary }
  | { kind: "empty" }
  | { kind: "loading" };

function buildBays(summaries: StorySummary[] | null): BaySlot[] {
  if (summaries === null) {
    return [
      { kind: "loading" },
      ...Array.from({ length: STORY_BAYS - 1 }, () => ({
        kind: "empty" as const,
      })),
    ];
  }
  const count = Math.max(STORY_BAYS, summaries.length);
  const out: BaySlot[] = [];
  for (let i = 0; i < count; i++) {
    const story = summaries[i];
    if (story !== undefined) {
      out.push({ kind: "story", story });
    } else {
      out.push({ kind: "empty" });
    }
  }
  return out;
}

function LibraryBuildInfo() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useClickOutside(open, () => setOpen(false), [ref]);
  if (!BUILD_STAMP) return null;
  return (
    <div className={styles.buildInfo} ref={ref}>
      {open ? (
        <div className={styles.buildInfoStamp} title={BUILD_STAMP.title}>
          {BUILD_STAMP.text}
        </div>
      ) : null}
      <button
        type="button"
        className={`${minervaTheme.focusRing} ${styles.buildInfoButton}`}
        aria-label="Build information"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <circle cx="8" cy="8" r="6.25" strokeWidth="1.25" />
            <path d="M8 7.2v4.2M8 4.6v.6" strokeWidth="1.4" />
          </g>
        </svg>
      </button>
    </div>
  );
}

export function MinervaLibraryPage() {
  const navigate = rootRouteApi.useNavigate();
  const launchUrl = rootRouteApi.useSearch().src;
  const switchStory = useDocumentStore((s) => s.switchStory);
  const createStory = useDocumentStore((s) => s.createStory);
  const deleteStory = useDocumentStore((s) => s.deleteStory);

  const [summaries, setSummaries] = React.useState<StorySummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [shelfBusy, setShelfBusy] = React.useState(false);
  const addRef = React.useRef<HTMLDivElement>(null);

  const refresh = React.useCallback(() => {
    setError(null);
    void listStorySummaries()
      .then(setSummaries)
      .catch((e: unknown) => {
        setSummaries([]);
        setError(e instanceof Error ? e.message : "Failed to load stories");
      });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    document.title = `${APP_TAB_TITLE_PREFIX} | Minerva Library`;
  }, []);

  useClickOutside(addOpen, () => setAddOpen(false), [addRef]);

  const goToStory = React.useCallback(
    (id: string) => {
      navigate({
        search: (prev: { storyid?: string; src?: string }) => {
          const next = { ...prev, storyid: id };
          delete next.src;
          return next;
        },
        replace: true,
      } as never);
    },
    [navigate],
  );

  const openStory = React.useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        libraryImportTookAutoload = false;
        useAppStore.getState().resetStoryViewerSession();
        await switchStory(id);
        goToStory(id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not open story");
      } finally {
        setBusyId(null);
      }
    },
    [goToStory, switchStory],
  );

  const openNewStory = React.useCallback(async () => {
    useAppStore.getState().resetStoryViewerSession();
    return createStory();
  }, [createStory]);

  const handleNew = React.useCallback(async () => {
    setAddOpen(false);
    setShelfBusy(true);
    setError(null);
    libraryImportTookAutoload = false;
    try {
      goToStory(await openNewStory());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create story");
    } finally {
      setShelfBusy(false);
    }
  }, [goToStory, openNewStory]);

  const startStoryWithPendingImport = React.useCallback(
    async (pending: PendingLibraryImport): Promise<OmeImportResult> => {
      setError(null);
      try {
        const id = await openNewStory();
        pendingLibraryImport = pending;
        libraryImportTookAutoload = true;
        goToStory(id);
        return { ok: true };
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : "Could not create story";
        setError(error);
        return { ok: false, error };
      }
    },
    [goToStory, openNewStory],
  );

  const handleImport = React.useCallback(
    async (importStory: () => Promise<string>) => {
      setAddOpen(false);
      setShelfBusy(true);
      setError(null);
      libraryImportTookAutoload = false;
      try {
        useAppStore.getState().resetStoryViewerSession();
        goToStory(await importStory());
      } catch (e: unknown) {
        // AbortError = user cancelled the picker; finally still clears busy.
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Could not import story");
        }
      } finally {
        setShelfBusy(false);
      }
    },
    [goToStory],
  );

  React.useEffect(() => {
    if (!launchUrl) {
      claimedLaunchUrl = null;
      return;
    }
    if (claimedLaunchUrl === launchUrl) return;
    claimedLaunchUrl = launchUrl;
    const launch = classifyViewerLaunchUrl(launchUrl);
    if (!launch) return;
    if (launch.kind === "story") {
      void (async () => {
        try {
          libraryImportTookAutoload = true;
          useAppStore.getState().resetStoryViewerSession();
          goToStory(await importStoryFromUrl(launch.url));
        } catch (e: unknown) {
          libraryImportTookAutoload = false;
          setError(
            e instanceof Error ? e.message : "Could not open config.json",
          );
        }
      })();
      return;
    }
    void startStoryWithPendingImport(
      launch.kind === "dicomWeb"
        ? { kind: "dicomWeb", url: launch.url }
        : {
            kind: "ome",
            role: "intensity",
            source: { kind: "url", url: launch.url },
          },
    );
  }, [launchUrl, goToStory, startStoryWithPendingImport]);

  const handleDelete = React.useCallback(
    (id: string, title: string) => {
      if (!window.confirm(`Remove “${title}” from the shelf?`)) return;
      setBusyId(id);
      setError(null);
      void (async () => {
        try {
          await deleteStory(id);
          refresh();
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "Could not delete");
        } finally {
          setBusyId(null);
        }
      })();
    },
    [deleteStory, refresh],
  );

  const bays = React.useMemo(() => buildBays(summaries), [summaries]);
  const openingLaunch = Boolean(launchUrl) && error === null;

  return (
    <div className={styles.root}>
      {error ? <p className={styles.error}>{error}</p> : null}

      {openingLaunch ? null : (
        <header className={styles.masthead}>
          <h1
            className={`${minervaTheme.wordmark} ${minervaTheme.wordmarkDisplay}`}
          >
            Minerva
          </h1>
          <p className={styles.tagline}>a microscopy viewer for non-experts</p>
          <a
            className={`${minervaTheme.focusRing} ${styles.exampleLink}`}
            href={`?src=${encodeURIComponent(DEMO_STORY_URL)}`}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              navigate({
                search: () => ({ src: DEMO_STORY_URL }),
              } as never);
            }}
          >
            View example
          </a>
        </header>
      )}
      <section
        className={styles.bookcase}
        aria-label="Library"
        hidden={openingLaunch}
      >
        <div className={styles.bookcaseInner}>
          <div className={styles.shelfBay}>
            <div className={styles.bayContent}>
              <div className={styles.intakeRow}>
                <div className={styles.addWrap} ref={addRef}>
                  <button
                    type="button"
                    className={`${minervaTheme.focusRing} ${styles.addTrigger}`}
                    disabled={shelfBusy}
                    aria-label="Add story"
                    title="New or import story"
                    aria-expanded={addOpen}
                    aria-haspopup="menu"
                    onClick={() => setAddOpen((v) => !v)}
                  >
                    <PlusIcon />
                  </button>
                  {addOpen ? (
                    <div
                      className={`${minervaTheme.menu} ${styles.addMenu}`}
                      role="menu"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className={minervaTheme.menuItem}
                        disabled={shelfBusy}
                        onClick={() => void handleNew()}
                      >
                        New story
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={minervaTheme.menuItem}
                        disabled={shelfBusy}
                        onClick={() =>
                          void handleImport(importStoryJsonFromPicker)
                        }
                      >
                        Import story
                      </button>
                      {hasDirectoryPickerAccess() ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={minervaTheme.menuItem}
                          disabled={shelfBusy}
                          onClick={() =>
                            void handleImport(importStoryFolderFromPicker)
                          }
                        >
                          Import folder
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Upload
                  row
                  onAllow={toFile}
                  disabled={shelfBusy}
                  onImportStory={(file) =>
                    handleImport(() => importStoryJsonFile(file))
                  }
                  onImportOme={(req) =>
                    startStoryWithPendingImport({ ...req, kind: "ome" })
                  }
                  onImportDicomWeb={(req) =>
                    startStoryWithPendingImport({
                      kind: "dicomWeb",
                      url: req.url,
                    })
                  }
                />
              </div>
            </div>
            <ShelfBoard />
          </div>
          {bays.map((bay, index) => {
            const key = bay.kind === "story" ? bay.story.id : `bay-${index}`;
            return (
              <div key={key} className={styles.shelfBay}>
                <div
                  className={
                    bay.kind === "empty"
                      ? `${styles.bayContent} ${styles.bayContentEmpty}`
                      : styles.bayContent
                  }
                  aria-hidden={bay.kind === "empty" ? true : undefined}
                >
                  {bay.kind === "empty" ? (
                    <GhostBooks bayIndex={index} />
                  ) : null}
                  {bay.kind === "loading" ? (
                    <p className={styles.whisper}>Opening the stacks…</p>
                  ) : null}
                  {bay.kind === "story" ? (
                    <div className={styles.storyRow}>
                      <button
                        type="button"
                        className={`${minervaTheme.focusRing} ${styles.rowOpen}`}
                        disabled={busyId === bay.story.id}
                        onClick={() => void openStory(bay.story.id)}
                      >
                        <span className={styles.rowThumb} aria-hidden>
                          {bay.story.thumbnail ? (
                            <img
                              src={bay.story.thumbnail}
                              alt=""
                              className={styles.rowThumbImg}
                            />
                          ) : (
                            <span className={styles.rowThumbBlank} />
                          )}
                        </span>
                        <span className={styles.rowText}>
                          <span className={styles.rowTitle}>
                            {bay.story.title}
                          </span>
                          <span className={styles.rowDate}>
                            {formatShortDate(bay.story.modifiedAt)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${minervaTheme.focusRing} ${styles.scrap}`}
                        disabled={busyId === bay.story.id}
                        aria-label={`Remove ${bay.story.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(bay.story.id, bay.story.title);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>
                <ShelfBoard />
              </div>
            );
          })}
        </div>
      </section>
      <LibraryBuildInfo />
    </div>
  );
}
