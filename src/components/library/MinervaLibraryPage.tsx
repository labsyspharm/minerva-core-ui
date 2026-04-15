import * as React from "react";
import { listStorySummaries } from "@/lib/persistence/storyPersistence";
import type { StorySummary } from "@/lib/persistence/types";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { rootRouteApi } from "@/router/appRouter";
import styles from "./MinervaLibraryPage.module.css";

const APP_TAB_TITLE_PREFIX =
  import.meta.env.MODE === "demo" ? "Minerva 2.0 Demo" : "Minerva";

/** Left-edge accent per story — muted cloth / leather. */
function rowAccent(id: string): React.CSSProperties {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i) * (i + 1);
  const h = 16 + (n % 42);
  const s = 12 + (n % 14);
  const l = 22 + (n % 10);
  return { ["--row-accent" as string]: `hsl(${h} ${s}% ${l}%)` };
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

/** Muted spine colors — darker ghosts that still read against dark wood */
const GHOST_PALETTE = [
  "hsl(10 20% 30%)",
  "hsl(28 16% 28%)",
  "hsl(45 14% 32%)",
  "hsl(150 12% 26%)",
  "hsl(210 14% 28%)",
  "hsl(30 10% 26%)",
  "hsl(0 10% 30%)",
  "hsl(180 10% 26%)",
  "hsl(260 12% 28%)",
  "hsl(55 12% 28%)",
];

/** Conservative avg spine + gap (px) — one row only; must not exceed shelf width */
const GHOST_SLOT_PX = 12;

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 11) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

function readInnerWidthPx(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const pl = Number.parseFloat(cs.paddingLeft) || 0;
  const pr = Number.parseFloat(cs.paddingRight) || 0;
  return el.clientWidth - pl - pr;
}

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
    const rand = seededRand(bayIndex * 997 + 42);
    const maxSlots =
      innerW > 0 ? Math.max(1, Math.floor(innerW / GHOST_SLOT_PX)) : 0;
    /**
     * Fill 0…1 with variance: mostly mid-to-full, but still hits sparse/empty sometimes.
     * `1 - (1-a)(1-b)` has mean 3/4 (product of two uniforms has mean 1/4).
     */
    const fill = 1 - (1 - rand()) * (1 - rand());
    const count =
      maxSlots <= 0 ? 0 : Math.min(maxSlots, Math.floor(fill * (maxSlots + 1)));

    return Array.from({ length: count }, (_, i) => {
      const width = 6 + Math.floor(rand() * 11);
      const height = 20 + Math.floor(rand() * 18);
      const color =
        GHOST_PALETTE[Math.floor(rand() * GHOST_PALETTE.length)] ??
        GHOST_PALETTE[0];
      const gap = 1 + Math.floor(rand() * 4);
      const opacity = 0.2 + rand() * 0.14;
      const tilt = rand() > 0.88 ? (rand() > 0.5 ? 2 : -2) : 0;
      return { key: i, width, height, color, gap, opacity, tilt };
    });
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
            marginRight: b.gap,
            transform: b.tilt ? `rotate(${b.tilt}deg)` : undefined,
            transformOrigin: "bottom center",
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
  | { kind: "loading" }
  | { kind: "emptyPrompt" }
  | { kind: "story"; story: StorySummary }
  | { kind: "empty" };

function buildBays(summaries: StorySummary[] | null): BaySlot[] {
  if (summaries === null) {
    return [
      { kind: "loading" },
      ...Array.from({ length: TARGET_BAYS - 1 }, () => ({
        kind: "empty" as const,
      })),
    ];
  }
  if (summaries.length === 0) {
    return [
      { kind: "emptyPrompt" },
      ...Array.from({ length: TARGET_BAYS - 1 }, () => ({
        kind: "empty" as const,
      })),
    ];
  }
  const count = Math.max(TARGET_BAYS, summaries.length);
  const out: BaySlot[] = [];
  for (let i = 0; i < count; i++) {
    if (i < summaries.length) {
      out.push({ kind: "story", story: summaries[i]! });
    } else {
      out.push({ kind: "empty" });
    }
  }
  return out;
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
    <div className={styles.root}>
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.shelfToolbar}>
        <h1 className={styles.wordmark}>Minerva Library</h1>
        <button
          type="button"
          className={styles.newVolume}
          disabled={creating}
          onClick={() => void handleNew()}
          aria-label="Add a new story"
        >
          <span className={styles.newGlyph} aria-hidden>
            +
          </span>
          <span className={styles.newLabel}>{creating ? "…" : "New"}</span>
        </button>
      </div>

      <section className={styles.bookcase} aria-label="Bookshelf">
        <div className={styles.bookcaseInner}>
          {bays.map((bay, index) => {
            const key = bay.kind === "story" ? bay.story.id : `bay-${index}`;
            return (
              <div key={key} className={styles.shelfBay}>
                <div
                  className={
                    bay.kind === "empty"
                      ? `${styles.bayContent} ${styles.bayContentEmpty}`
                      : bay.kind === "emptyPrompt"
                        ? `${styles.bayContent} ${styles.bayContentEmptyPrompt}`
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
                  {bay.kind === "emptyPrompt" ? (
                    <p className={styles.emptyLine}>
                      <button
                        type="button"
                        className={styles.inlineLink}
                        onClick={() => void handleNew()}
                        disabled={creating}
                      >
                        Create a new story.
                      </button>
                    </p>
                  ) : null}
                  {bay.kind === "story" ? (
                    <div className={styles.storyRow}>
                      <button
                        type="button"
                        className={styles.rowOpen}
                        style={rowAccent(bay.story.id)}
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
