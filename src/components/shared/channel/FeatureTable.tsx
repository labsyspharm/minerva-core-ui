import { fileOpen } from "browser-fs-access";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ColorPickerPopover,
  colorPickerAnchorPosition,
} from "@/components/shared/ColorPickerPopover";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import { TrashIcon } from "@/components/shared/common/TrashIcon";
import { ImportOverlay } from "@/components/shared/ImportOverlay";
import FolderIcon from "@/components/shared/icons/folder.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import panel from "@/components/shared/panel/panelShared.module.css";
import {
  classColorsFor,
  classNameVisible,
  classViewFor,
  completeFeatureTableIngest,
  detachFeatureTable,
  featureTableHandleKey,
  getFeatureTableAccess,
  getFeatureTableIngestEpoch,
  getFeatureTablePendingSourceIds,
  hasIngestedFeatureTable,
  ingestFeatureCsvFile,
  pageFeatureTable,
  peekClassIndex,
  peekFeatureCsv,
  resetClassView,
  setAllClassesVisible,
  setClassColor,
  subscribeFeatureTableAccess,
  subscribeFeatureTableIngest,
  subscribeFeatureTablePending,
  toggleClassVisible,
} from "@/lib/featureTable";
import {
  effectiveMaskVisualizationForSource,
  rgbToHex,
} from "@/lib/imaging/sourceChannelStyle";
import { useAppStore } from "@/lib/stores/appStore";
import type { Color, Waypoint } from "@/lib/stores/documentSchema";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import styles from "./FeatureTable.module.css";

const ROW_H = 22;
const WINDOW = 80;

type FeatureTableRow = {
  name: string;
  color: Color | undefined;
  visible: boolean;
};

const EDGE = 10;

export async function pickFeatureCsv(): Promise<File | undefined> {
  try {
    return await fileOpen({
      description: "Feature table CSV",
      mimeTypes: ["text/csv"],
      extensions: [".csv"],
      multiple: false,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return undefined;
    throw e;
  }
}

function TableIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
      <title>Table</title>
      <rect
        x="1"
        y="1"
        width="10"
        height="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect x="1" y="1" width="10" height="3" fill="currentColor" />
      <path
        d="M1 7h10M5 4v7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function TableLoading() {
  return (
    <div className={styles.loading}>
      <div className={minervaTheme.spinnerSm} aria-hidden="true" />
      <span>Loading feature table…</span>
    </div>
  );
}

function useFeatureTableList(
  featureTableId: string,
  waypoint: Waypoint | undefined,
) {
  const [filter, setFilter] = useState("");
  const [raw, setRaw] = useState<{ name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedOffset, setLoadedOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const featureTable = useDocumentStore((s) =>
    s.featureTables.find((c) => c.id === featureTableId),
  );
  const view = featureTable
    ? classViewFor(waypoint, featureTable.sourceChannelId)
    : undefined;
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const digest = featureTable?.digest;
  const ingestEpoch = useSyncExternalStore(
    subscribeFeatureTableIngest,
    getFeatureTableIngestEpoch,
    getFeatureTableIngestEpoch,
  );
  // Same lookup as the viewer: the active group's row for this mask first.
  const maskColor = useDocumentStore((s) => {
    const sourceId = featureTable?.sourceChannelId;
    if (!sourceId) return undefined;
    for (const im of s.images) {
      const ch = im.channels.find((c) => c.id === sourceId);
      if (!ch) continue;
      return effectiveMaskVisualizationForSource(
        { ...ch, imageId: im.id },
        s.channelGroups,
        activeChannelGroupId,
      ).color;
    }
    return undefined;
  });
  const fadeColors = (maskColor ?? "white") === "white";

  const seq = useRef(0);
  const windowRef = useRef({ offset: 0, count: 0, total: 0 });
  windowRef.current = {
    offset: loadedOffset,
    count: raw.length,
    total,
  };
  const prevEpoch = useRef(ingestEpoch);

  const fetchPage = useCallback(
    (offset: number, query: string) => {
      const id = ++seq.current;
      setLoading(true);
      void pageFeatureTable(featureTableId, query, offset, WINDOW)
        .then((page) => {
          if (id !== seq.current) return;
          setRaw(page.rows);
          setTotal(page.total);
          setLoadedOffset(offset);
          setLoading(false);
        })
        .catch(() => {
          if (id !== seq.current) return;
          setLoading(false);
        });
    },
    [featureTableId],
  );

  useEffect(() => {
    const epochOnly = prevEpoch.current !== ingestEpoch;
    prevEpoch.current = ingestEpoch;
    if (!digest) {
      seq.current += 1;
      setRaw([]);
      setTotal(0);
      setLoadedOffset(0);
      setLoading(false);
      return;
    }
    if (!epochOnly) {
      setRaw([]);
      setLoadedOffset(0);
    }
    fetchPage(epochOnly ? windowRef.current.offset : 0, filter);
    return () => {
      seq.current += 1;
    };
  }, [digest, filter, ingestEpoch, fetchPage]);

  const rows = useMemo<FeatureTableRow[]>(() => {
    void ingestEpoch;
    if (!featureTable) return [];
    const names =
      raw.length === 0 ? peekClassIndex(featureTableId)?.names : undefined;
    const source =
      names && names.length > 0 ? names.map((name) => ({ name })) : raw;
    const colors = classColorsFor(featureTable, view);
    return source.map((row) => ({
      name: row.name,
      color: colors.get(row.name),
      visible: classNameVisible(view?.visibility, row.name),
    }));
  }, [featureTable, featureTableId, view, raw, ingestEpoch]);
  const usingCache = raw.length === 0 && rows.length > 0;

  return {
    rows,
    total: usingCache ? rows.length : total,
    filter,
    loadedOffset: usingCache ? 0 : loadedOffset,
    loading,
    fadeColors,
    setFilter,
    onScroll: (scrollTop: number, clientHeight: number) => {
      const first = Math.floor(scrollTop / ROW_H);
      const view = Math.max(1, Math.ceil(clientHeight / ROW_H));
      const { offset, count, total: n } = windowRef.current;
      if (count === 0) return;
      const loadedEnd = offset + count;
      const nearTop = first < offset + EDGE && offset > 0;
      const nearBottom = first + view > loadedEnd - EDGE && loadedEnd < n;
      if (!nearTop && !nearBottom) return;
      const next = Math.max(0, first - Math.floor((WINDOW - view) / 2));
      if (next === offset) return;
      fetchPage(next, filter);
    },
  };
}

export function FeatureCsvColumnPick(props: {
  headers: string[];
  id: string;
  name: string;
  onId: (value: string) => void;
  onName: (value: string) => void;
}) {
  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label>
      {label}
      <select
        className={styles.field}
        value={value}
        aria-label={`${label} column`}
        onChange={(e) => onChange(e.target.value)}
      >
        {props.headers.map((h) => (
          <option key={`${label}-${h}`} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className={styles.colPick}>
      {select("ID", props.id, props.onId)}
      {select("Name", props.name, props.onName)}
    </div>
  );
}

export function featureTableRowExtras(
  sourceChannelId: string,
  featureTables: { id?: string; sourceChannelId?: string }[],
) {
  const featureTableId = featureTables.find(
    (c) => c.sourceChannelId === sourceChannelId,
  )?.id;
  return {
    maskAction: featureTableId ? (
      <FeatureTableMaskAction featureTableId={featureTableId} />
    ) : (
      <FeatureTableAttach sourceChannelId={sourceChannelId} />
    ),
    maskFooter: featureTableId ? (
      <FeatureTableListBody featureTableId={featureTableId} />
    ) : undefined,
  };
}

function FeatureTableGlyph(props: {
  wait?: boolean;
  folder?: boolean;
  title?: string;
  ariaLabel: string;
  onClick?: () => void;
}) {
  const { wait, folder, title, ariaLabel, onClick } = props;
  return (
    <div className={styles.attach}>
      <button
        type="button"
        className={`${minervaTheme.focusRing} ${styles.attachBtn}${
          wait ? ` ${minervaTheme.busyOverlay}` : ""
        }`}
        disabled={wait || onClick == null}
        title={title}
        aria-label={ariaLabel}
        aria-busy={wait || undefined}
        onClick={onClick}
      >
        {folder ? (
          <FolderIcon width={12} height={12} aria-hidden />
        ) : (
          <TableIcon />
        )}
      </button>
      <span className={styles.attachLabel}>Table</span>
    </div>
  );
}

function FeatureTableMaskAction(props: { featureTableId: string }) {
  const { featureTableId } = props;
  const ingestEpoch = useSyncExternalStore(
    subscribeFeatureTableIngest,
    getFeatureTableIngestEpoch,
    getFeatureTableIngestEpoch,
  );
  const access = useSyncExternalStore(
    subscribeFeatureTableAccess,
    getFeatureTableAccess,
    getFeatureTableAccess,
  );
  const handleKey = useDocumentStore((s) => {
    const featureTable = s.featureTables.find((c) => c.id === featureTableId);
    return featureTable ? featureTableHandleKey(featureTable) : undefined;
  });
  void ingestEpoch;
  if (hasIngestedFeatureTable(featureTableId)) return null;
  if (handleKey != null && access.missingHandleKeys.includes(handleKey)) {
    return null;
  }
  return (
    <FeatureTableGlyph
      wait
      folder
      title="Loading feature table"
      ariaLabel="Loading feature table"
    />
  );
}

function FeatureTableAttach(props: { sourceChannelId: string }) {
  const pendingIds = useSyncExternalStore(
    subscribeFeatureTablePending,
    getFeatureTablePendingSourceIds,
    getFeatureTablePendingSourceIds,
  );
  const [busy, setBusy] = useState(false);
  const wait = busy || pendingIds.includes(props.sourceChannelId);
  const [pendingCsv, setPendingCsv] = useState<{
    file: File;
    headers: string[];
    id: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closePending = () => {
    setPendingCsv(null);
    setError(null);
  };

  const attachFile = async (
    file: File,
    columns?: { id: string; name: string },
  ) => {
    setPendingCsv(null);
    setError(null);
    setBusy(true);
    try {
      const result = await completeFeatureTableIngest(
        props.sourceChannelId,
        ingestFeatureCsvFile(file, columns),
      );
      if (result.ok === false) setError(result.error);
    } finally {
      setBusy(false);
    }
  };

  const pickAndAttach = async () => {
    const file = await pickFeatureCsv();
    if (!file) return;
    const peek = await peekFeatureCsv(file);
    setError(null);
    setPendingCsv({
      file,
      headers: peek?.headers ?? [],
      id: peek?.id ?? "",
      name: peek?.name ?? "",
    });
  };

  const columns =
    pendingCsv && pendingCsv.headers.length >= 2
      ? { id: pendingCsv.id, name: pendingCsv.name }
      : undefined;

  return (
    <>
      <FeatureTableGlyph
        wait={wait}
        title={error ?? "Attach feature table"}
        ariaLabel={wait ? "Loading feature table" : "Attach feature table"}
        onClick={() => void pickAndAttach()}
      />
      {pendingCsv ? (
        <ImportOverlay
          title={pendingCsv.file.name}
          titleId="feature-table-import-dialog-title"
          onCancel={closePending}
          onImport={() => void attachFile(pendingCsv.file, columns)}
        >
          {pendingCsv.headers.length >= 2 ? (
            <FeatureCsvColumnPick
              headers={pendingCsv.headers}
              id={pendingCsv.id}
              name={pendingCsv.name}
              onId={(id) => setPendingCsv({ ...pendingCsv, id })}
              onName={(name) => setPendingCsv({ ...pendingCsv, name })}
            />
          ) : null}
        </ImportOverlay>
      ) : null}
    </>
  );
}

function useActiveWaypoint(): Waypoint | undefined {
  const activeStoryIndex = useAppStore((s) => s.activeStoryIndex);
  return useDocumentStore((s) =>
    activeStoryIndex == null ? undefined : s.waypoints[activeStoryIndex],
  );
}

/**
 * One table's classes as `waypoint` shows them. Edits write that waypoint's
 * class view; with no waypoint the list is read-only.
 */
function ClassViewList(props: {
  featureTableId: string;
  waypoint: Waypoint | undefined;
  /** Extra controls at the end of the filter row. */
  tools?: ReactNode;
  /** Covers the rows, e.g. a prompt to choose the file again. */
  overlay?: ReactNode;
}) {
  const { featureTableId, waypoint, tools, overlay } = props;
  const list = useFeatureTableList(featureTableId, waypoint);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<{
    name: string;
    hex: string;
    pending?: Color;
    top: number;
    left: number;
  } | null>(null);

  const showBusy = list.loading && list.rows.length === 0;
  const fadeColors = list.fadeColors;
  const waypointId = waypoint?.id;
  const readOnly = waypointId == null;
  const toggle = (name: string) => {
    if (waypointId) toggleClassVisible(waypointId, featureTableId, name);
  };

  useEffect(() => {
    if (fadeColors || readOnly) setPicker(null);
  }, [fadeColors, readOnly]);

  return (
    <>
      <div className={styles.toolbar}>
        <input
          className={styles.field}
          type="text"
          value={list.filter}
          placeholder="Filter classes…"
          aria-label="Filter classes by name"
          onChange={(e) => {
            list.setFilter(e.target.value);
            scrollerRef.current?.scrollTo(0, 0);
          }}
        />
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.textBtn}`}
          disabled={readOnly}
          onClick={() => {
            if (waypointId)
              setAllClassesVisible(waypointId, featureTableId, true);
          }}
        >
          Show all
        </button>
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.textBtn}`}
          disabled={readOnly}
          onClick={() => {
            if (waypointId)
              setAllClassesVisible(waypointId, featureTableId, false);
          }}
        >
          Hide all
        </button>
        {tools}
      </div>
      <div
        ref={scrollerRef}
        className={`${styles.scroller} ${panel.thinScrollbar}`}
        onScroll={() => {
          const el = scrollerRef.current;
          if (!el) return;
          list.onScroll(el.scrollTop, el.clientHeight);
        }}
      >
        {overlay ? <div className={styles.accessPrompt}>{overlay}</div> : null}
        {showBusy && !overlay ? <TableLoading /> : null}
        <div
          style={{
            height: Math.max(list.total, showBusy || overlay ? 2 : 1) * ROW_H,
            position: "relative",
          }}
        >
          {list.rows.map((row, i) => (
            <div
              key={row.name}
              className={styles.row}
              style={{ top: (list.loadedOffset + i) * ROW_H }}
            >
              <ChannelVisibilitySwatch
                visible={row.visible}
                title={row.visible ? `Hide ${row.name}` : `Show ${row.name}`}
                ariaLabel={`Toggle visibility for ${row.name}`}
                onClick={() => toggle(row.name)}
              />
              {row.color ? (
                <button
                  type="button"
                  className={`${minervaTheme.focusRing} ${styles.swatch}`}
                  style={{ backgroundColor: `#${rgbToHex(row.color)}` }}
                  aria-label={`Color for ${row.name}`}
                  disabled={fadeColors || readOnly}
                  onClick={(e) => {
                    const color = row.color;
                    if (!color) return;
                    const pos = colorPickerAnchorPosition(
                      e.currentTarget.getBoundingClientRect(),
                    );
                    setPicker({
                      name: row.name,
                      hex: rgbToHex(color),
                      ...pos,
                    });
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`${styles.swatch} ${styles.swatchPending} ${minervaTheme.busyOverlay}`}
                  aria-label={`Assigning color for ${row.name}`}
                  disabled
                />
              )}
              <button
                type="button"
                className={`${minervaTheme.focusRing} ${styles.name}`}
                title={row.visible ? `Hide ${row.name}` : `Show ${row.name}`}
                aria-pressed={row.visible}
                disabled={readOnly}
                onClick={() => toggle(row.name)}
              >
                {row.name.trim() ? row.name : "Unnamed"}
              </button>
            </div>
          ))}
        </div>
      </div>
      {picker ? (
        <ColorPickerPopover
          position={{ top: picker.top, left: picker.left }}
          onClose={() => {
            const pending = picker.pending;
            const name = picker.name;
            setPicker(null);
            if (pending && waypointId)
              setClassColor(waypointId, featureTableId, name, pending);
          }}
          color={`#${picker.hex}`}
          showAlpha={false}
          onChange={(c) => {
            const raw = c.hex.replace(/^#/, "").slice(0, 6);
            const r = Number.parseInt(raw.slice(0, 2), 16);
            const g = Number.parseInt(raw.slice(2, 4), 16);
            const b = Number.parseInt(raw.slice(4, 6), 16);
            if ([r, g, b].some((n) => Number.isNaN(n))) return;
            setPicker((p) =>
              p ? { ...p, hex: raw, pending: { r, g, b } } : p,
            );
          }}
        />
      ) : null}
    </>
  );
}

function ClassViewReset(props: { featureTableId: string; waypoint: Waypoint }) {
  const { featureTableId, waypoint } = props;
  const hasView = useDocumentStore((s) => {
    const featureTable = s.featureTables.find((c) => c.id === featureTableId);
    return (
      featureTable != null &&
      classViewFor(waypoint, featureTable.sourceChannelId) != null
    );
  });
  return (
    <button
      type="button"
      className={`${minervaTheme.focusRing} ${styles.textBtn}`}
      disabled={!hasView}
      onClick={() => resetClassView(waypoint.id, featureTableId)}
    >
      Reset
    </button>
  );
}

/** Channel panel: the class list under a mask row edits the waypoint on screen. */
function FeatureTableListBody(props: { featureTableId: string }) {
  const { featureTableId } = props;
  const waypoint = useActiveWaypoint();
  const handleKey = useDocumentStore((s) => {
    const featureTable = s.featureTables.find((c) => c.id === featureTableId);
    return featureTable ? featureTableHandleKey(featureTable) : undefined;
  });
  const sourceChannelId = useDocumentStore(
    (s) =>
      s.featureTables.find((c) => c.id === featureTableId)?.sourceChannelId,
  );
  const access = useSyncExternalStore(
    subscribeFeatureTableAccess,
    getFeatureTableAccess,
    getFeatureTableAccess,
  );
  const ingestEpoch = useSyncExternalStore(
    subscribeFeatureTableIngest,
    getFeatureTableIngestEpoch,
    getFeatureTableIngestEpoch,
  );
  const waypointCount = useDocumentStore((s) => s.waypoints.length);
  const needsReselect =
    handleKey != null && access.missingHandleKeys.includes(handleKey);

  const restoreFile = async () => {
    if (!sourceChannelId) return;
    const file = await pickFeatureCsv();
    if (!file) return;
    await completeFeatureTableIngest(
      sourceChannelId,
      ingestFeatureCsvFile(file),
    );
  };

  void ingestEpoch;
  if (!hasIngestedFeatureTable(featureTableId) && !needsReselect) return null;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        {waypoint ? (
          <>
            <span className={styles.viewTitle} title={waypoint.title}>
              {waypoint.title.trim() || "Untitled waypoint"}
            </span>
            <ClassViewReset
              featureTableId={featureTableId}
              waypoint={waypoint}
            />
          </>
        ) : (
          <span className={styles.readOnlyNote}>
            {waypointCount === 0
              ? "Add a waypoint to customize classes"
              : "Select a waypoint to customize classes"}
          </span>
        )}
      </div>
      <ClassViewList
        featureTableId={featureTableId}
        waypoint={waypoint}
        tools={
          <PanelIconButton
            variant="row"
            title="Delete table"
            aria-label="Delete table"
            onClick={() => {
              if (sourceChannelId) void detachFeatureTable(sourceChannelId);
            }}
          >
            <TrashIcon title="Delete table" size={14} />
          </PanelIconButton>
        }
        overlay={
          needsReselect ? (
            <button
              type="button"
              className={`${minervaTheme.focusRing} ${styles.textBtn}`}
              onClick={() => void restoreFile()}
            >
              Choose file again
            </button>
          ) : null
        }
      />
    </div>
  );
}

/**
 * Waypoint detail view: the listed tables as this waypoint shows them.
 * Attaching, deleting, and re-choosing tables stay in the channel panel.
 */
export function WaypointClassViews(props: {
  waypoint: Waypoint;
  /** Tables whose mask is in the waypoint's channel group. */
  featureTableIds: readonly string[];
  readOnly?: boolean;
}) {
  const { waypoint, featureTableIds, readOnly } = props;
  const allTables = useDocumentStore((s) => s.featureTables);
  const featureTables = useMemo(
    () => allTables.filter((c) => featureTableIds.includes(c.id)),
    [allTables, featureTableIds],
  );
  const images = useDocumentStore((s) => s.images);
  const ingestEpoch = useSyncExternalStore(
    subscribeFeatureTableIngest,
    getFeatureTableIngestEpoch,
    getFeatureTableIngestEpoch,
  );
  const maskNames = useMemo(
    () =>
      new Map(
        flattenImageChannelsInDocumentOrder(images).map((sc) => [
          sc.id,
          sc.name,
        ]),
      ),
    [images],
  );
  void ingestEpoch;
  if (featureTables.length === 0) return null;
  return (
    <div className={styles.waypointClasses}>
      {featureTables.map((featureTable) => {
        const label = maskNames.get(featureTable.sourceChannelId) ?? "Mask";
        const loaded = hasIngestedFeatureTable(featureTable.id);
        return (
          <div key={featureTable.id} className={styles.root}>
            <div className={styles.toolbar}>
              <span className={styles.viewTitle} title={label}>
                {label}
              </span>
              {loaded && !readOnly ? (
                <ClassViewReset
                  featureTableId={featureTable.id}
                  waypoint={waypoint}
                />
              ) : null}
            </div>
            {loaded ? (
              <ClassViewList
                featureTableId={featureTable.id}
                waypoint={readOnly ? undefined : waypoint}
              />
            ) : (
              <span className={styles.readOnlyNote}>
                Table not loaded. Choose the file again in the channel panel.
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
