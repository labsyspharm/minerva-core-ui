import * as React from "react";
import {
  minervaThemeControlOutlinedClassName,
  minervaThemeMenuClassName,
  minervaThemeMenuItemClassName,
  minervaThemeRootClassName,
  STORY_CLOTH,
} from "@/components/shared/minervaTheme";
import { hasDirectoryPickerAccess } from "@/lib/imaging/filesystem";
import { getDemoDocumentTitle } from "@/lib/persistence/demo";
import { listStorySummaries } from "@/lib/persistence/storyPersistence";
import type { StorySummary } from "@/lib/persistence/types";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  importStoryFolderFromPicker,
  importStoryJsonFromPicker,
} from "@/lib/storyExport/importStoryFolder";
import { rootRouteApi } from "@/router/appRouter";
import styles from "./MinervaLibraryPage.module.css";

const APP_TAB_TITLE_PREFIX = getDemoDocumentTitle();

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
      opacity: number;
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
        color:
          STORY_CLOTH[Math.floor(rand() * STORY_CLOTH.length)] ??
          STORY_CLOTH[0],
        opacity: 0.72 + rand() * 0.28,
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
            opacity: b.opacity,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Reference SVG: 7 interior lines → 8 tiers. Always show at least this many bays
 * so empty shelves appear below real stories.
 */
const TARGET_BAYS = 8;

type BaySlot =
  | { kind: "catalog" }
  | { kind: "loading" }
  | { kind: "story"; story: StorySummary }
  | { kind: "empty" };

function buildBays(summaries: StorySummary[] | null): BaySlot[] {
  const rest: BaySlot[] =
    summaries === null
      ? [
          { kind: "loading" },
          ...Array.from({ length: TARGET_BAYS - 2 }, () => ({
            kind: "empty" as const,
          })),
        ]
      : (() => {
          const count = Math.max(TARGET_BAYS - 1, summaries.length);
          const out: BaySlot[] = [];
          for (let i = 0; i < count; i++) {
            const story = i < summaries.length ? summaries[i] : undefined;
            if (story !== undefined) {
              out.push({ kind: "story", story });
            } else {
              out.push({ kind: "empty" });
            }
          }
          return out;
        })();
  return [{ kind: "catalog" }, ...rest];
}

export function MinervaLibraryPage() {
  const navigate = rootRouteApi.useNavigate();
  const switchStory = useDocumentStore((s) => s.switchStory);
  const createStory = useDocumentStore((s) => s.createStory);
  const deleteStory = useDocumentStore((s) => s.deleteStory);

  const [summaries, setSummaries] = React.useState<StorySummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const importMenuRef = React.useRef<HTMLDetailsElement>(null);
  const canImportFolder = hasDirectoryPickerAccess();

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

  const openStory = React.useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        useAppStore.getState().resetStoryViewerSession();
        await switchStory(id);
        navigate({
          search: (prev: { storyid?: string }) => ({
            ...prev,
            storyid: id,
          }),
          replace: true,
        } as never);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not open story");
      } finally {
        setBusyId(null);
      }
    },
    [navigate, switchStory],
  );

  const handleNew = React.useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      useAppStore.getState().resetStoryViewerSession();
      const id = await createStory();
      navigate({
        search: (prev: { storyid?: string }) => ({
          ...prev,
          storyid: id,
        }),
        replace: true,
      } as never);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create story");
    } finally {
      setCreating(false);
    }
  }, [createStory, navigate]);

  const handleImport = React.useCallback(
    async (kind: "json" | "folder") => {
      importMenuRef.current?.removeAttribute("open");
      setImporting(true);
      setError(null);
      try {
        useAppStore.getState().resetStoryViewerSession();
        const id =
          kind === "json"
            ? await importStoryJsonFromPicker()
            : await importStoryFolderFromPicker();
        navigate({
          search: (prev: { storyid?: string }) => ({
            ...prev,
            storyid: id,
          }),
          replace: true,
        } as never);
      } catch (e: unknown) {
        // AbortError = user cancelled the picker; finally still clears `importing`.
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Could not import story");
        }
      } finally {
        setImporting(false);
      }
    },
    [navigate],
  );

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

  return (
    <div className={`${styles.root} ${minervaThemeRootClassName}`}>
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.shelfToolbar}>
        <h1 className={styles.wordmark}>Minerva Library</h1>
      </div>

      <section className={styles.bookcase} aria-label="Bookshelf">
        <div className={styles.bookcaseInner}>
          {bays.map((bay, index) => {
            const key =
              bay.kind === "story"
                ? bay.story.id
                : bay.kind === "catalog"
                  ? "catalog"
                  : `bay-${index}`;
            return (
              <div key={key} className={styles.shelfBay}>
                <div
                  className={
                    bay.kind === "empty"
                      ? `${styles.bayContent} ${styles.bayContentEmpty}`
                      : bay.kind === "catalog"
                        ? `${styles.bayContent} ${styles.catalogBay}`
                        : styles.bayContent
                  }
                  aria-hidden={bay.kind === "empty" ? true : undefined}
                >
                  {bay.kind === "catalog" ? (
                    <div className={styles.catalogRow}>
                      <button
                        type="button"
                        className={`${minervaThemeControlOutlinedClassName} ${styles.catalogAction}`}
                        disabled={creating || importing}
                        onClick={() => void handleNew()}
                      >
                        {creating ? "…" : "New story"}
                      </button>
                      <details
                        ref={importMenuRef}
                        className={styles.importMenu}
                      >
                        <summary
                          className={`${minervaThemeControlOutlinedClassName} ${styles.catalogAction} ${importing || creating ? styles.disabledAction : ""}`}
                          aria-label="Import a story"
                        >
                          {importing ? "…" : "Import"}
                        </summary>
                        <div
                          className={`${minervaThemeMenuClassName} ${styles.importMenuPanel}`}
                        >
                          <button
                            type="button"
                            className={minervaThemeMenuItemClassName}
                            disabled={importing || creating}
                            onClick={() => void handleImport("json")}
                          >
                            JSON file
                          </button>
                          {canImportFolder ? (
                            <button
                              type="button"
                              className={minervaThemeMenuItemClassName}
                              disabled={importing || creating}
                              onClick={() => void handleImport("folder")}
                            >
                              Story folder
                            </button>
                          ) : null}
                        </div>
                      </details>
                    </div>
                  ) : null}
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
                        className={styles.rowOpen}
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
                        className={styles.scrap}
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
    </div>
  );
}
