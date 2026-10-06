import {
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
  classNameVisible,
  completeFeatureTableIngest,
  detachFeatureTable,
  getFeatureTableAccess,
  getFeatureTableIngestEpoch,
  getFeatureTablePendingSourceIds,
  hasIngestedFeatureTable,
  ingestFeatureCsvFile,
  pageFeatureTable,
  peekClassIndex,
  peekFeatureCsv,
  requestFeatureTableFileAccess,
  setAllClassesVisible,
  setClassColor,
  subscribeFeatureTableAccess,
  subscribeFeatureTableIngest,
  subscribeFeatureTablePending,
  toggleClassVisible,
} from "@/lib/featureTable";
import { pickFile } from "@/lib/imaging/filesystem";
import { rgbToHex } from "@/lib/imaging/sourceChannelStyle";
import { useAppStore } from "@/lib/stores/appStore";
import type { Color } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import styles from "./FeatureTable.module.css";

const ROW_H = 22;
const WINDOW = 80;

type FeatureTableRow = {
  name: string;
  color: Color | undefined;
  visible: boolean;
};

const EDGE = 10;

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

function useFeatureTableList(featureTableId: string) {
  const [filter, setFilter] = useState("");
  const [raw, setRaw] = useState<{ name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedOffset, setLoadedOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const vis = useAppStore((s) => s.featureTableVisibilities[featureTableId]);
  const featureTable = useDocumentStore((s) =>
    s.featureTables.find((c) => c.id === featureTableId),
  );
  const digest = featureTable?.digest;
  const ingestEpoch = useSyncExternalStore(
    subscribeFeatureTableIngest,
    getFeatureTableIngestEpoch,
    getFeatureTableIngestEpoch,
  );
  const viz = useDocumentStore((s) => {
    const sourceId = featureTable?.sourceChannelId;
    if (!sourceId) return undefined;
    for (const g of s.channelGroups) {
      const row = g.channels.find((gc) => gc.channelId === sourceId);
      if (row?.maskVisualization) return row.maskVisualization;
    }
    for (const im of s.images) {
      for (const ch of im.channels) {
        if (ch.id === sourceId) return ch.maskVisualization;
      }
    }
    return undefined;
  });
  const fadeColors = (viz?.color ?? "white") === "white";

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
    const colors = new Map(
      featureTable.nameColors.map((o) => [o.name, o.color]),
    );
    return source.map((row) => ({
      name: row.name,
      color: colors.get(row.name),
      visible: classNameVisible(vis, row.name),
    }));
  }, [featureTable, featureTableId, vis, raw, ingestEpoch]);
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
  const handleKey = useDocumentStore(
    (s) =>
      s.featureTables.find((c) => c.id === featureTableId)?.source.handleKey,
  );
  void ingestEpoch;
  if (hasIngestedFeatureTable(featureTableId)) return null;
  if (
    handleKey != null &&
    (access.deniedHandleKeys.includes(handleKey) ||
      access.missingHandleKeys.includes(handleKey))
  ) {
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
  const [file, setFile] = useState<File | null>(null);
  const wait = pendingIds.includes(props.sourceChannelId);

  return (
    <>
      <FeatureTableGlyph
        wait={wait}
        title="Attach feature table"
        ariaLabel={wait ? "Loading feature table" : "Attach feature table"}
        onClick={() =>
          void pickFile(["featureTable"]).then((f) => f && setFile(f))
        }
      />
      {file ? (
        <FeatureCsvAttachDialog
          file={file}
          masks={[{ id: props.sourceChannelId }]}
          onClose={() => setFile(null)}
        />
      ) : null}
    </>
  );
}

/** Attach a feature-table CSV to a mask: pick the mask (if several) and columns. */
export function FeatureCsvAttachDialog(props: {
  file: File;
  masks: { id?: string; name?: string }[];
  onClose: () => void;
  onAttached?: () => void;
}) {
  const { file, masks, onClose, onAttached } = props;
  const [maskId, setMaskId] = useState(masks[0]?.id ?? "");
  const [cols, setCols] = useState<{
    headers: string[];
    id: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void peekFeatureCsv(file).then(setCols);
  }, [file]);

  const pickCols = cols != null && cols.headers.length >= 2;

  const attach = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await completeFeatureTableIngest(
        maskId,
        ingestFeatureCsvFile(
          file,
          pickCols ? { id: cols.id, name: cols.name } : undefined,
        ),
      );
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      onAttached?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImportOverlay
      title={file.name}
      titleId="feature-table-import-dialog-title"
      error={error}
      busy={busy}
      busyLabel="Loading feature table…"
      cancelDisabled={busy}
      importDisabled={busy}
      onCancel={onClose}
      onImport={() => void attach()}
    >
      {masks.length > 1 || pickCols ? (
        <>
          {masks.length > 1 ? (
            <div className={styles.colPick}>
              <label>
                Mask
                <select
                  className={styles.field}
                  value={maskId}
                  aria-label="Mask"
                  onChange={(e) => setMaskId(e.target.value)}
                >
                  {masks.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || "Mask"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {pickCols ? (
            <FeatureCsvColumnPick
              headers={cols.headers}
              id={cols.id}
              name={cols.name}
              onId={(id) => setCols({ ...cols, id })}
              onName={(name) => setCols({ ...cols, name })}
            />
          ) : null}
        </>
      ) : null}
    </ImportOverlay>
  );
}

function FeatureTableListBody(props: { featureTableId: string }) {
  const { featureTableId } = props;
  const list = useFeatureTableList(featureTableId);
  const handleKey = useDocumentStore(
    (s) =>
      s.featureTables.find((c) => c.id === featureTableId)?.source.handleKey,
  );
  const sourceChannelId = useDocumentStore(
    (s) =>
      s.featureTables.find((c) => c.id === featureTableId)?.sourceChannelId,
  );
  const access = useSyncExternalStore(
    subscribeFeatureTableAccess,
    getFeatureTableAccess,
    getFeatureTableAccess,
  );
  const needsPermission =
    handleKey != null && access.deniedHandleKeys.includes(handleKey);
  const needsReselect =
    handleKey != null && access.missingHandleKeys.includes(handleKey);
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
  const showAccess = needsPermission || needsReselect;

  const restoreFile = async () => {
    if (needsReselect) {
      if (!sourceChannelId) return;
      const file = await pickFile(["featureTable"]);
      if (!file) return;
      await completeFeatureTableIngest(
        sourceChannelId,
        ingestFeatureCsvFile(file),
      );
      return;
    }
    await requestFeatureTableFileAccess();
  };

  useEffect(() => {
    if (fadeColors) setPicker(null);
  }, [fadeColors]);

  if (!hasIngestedFeatureTable(featureTableId) && !showAccess) return null;

  return (
    <div className={styles.root}>
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
          onClick={() => setAllClassesVisible(featureTableId, true)}
        >
          Show all
        </button>
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.textBtn}`}
          onClick={() => setAllClassesVisible(featureTableId, false)}
        >
          Hide all
        </button>
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
        {showAccess ? (
          <div className={styles.accessPrompt}>
            <button
              type="button"
              className={`${minervaTheme.focusRing} ${styles.textBtn}`}
              onClick={() => void restoreFile()}
            >
              {needsReselect ? "Choose file again" : "Allow file access"}
            </button>
          </div>
        ) : null}
        {showBusy && !showAccess ? <TableLoading /> : null}
        <div
          style={{
            height:
              Math.max(list.total, showBusy || showAccess ? 2 : 1) * ROW_H,
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
                onClick={() => toggleClassVisible(featureTableId, row.name)}
              />
              {row.color ? (
                <button
                  type="button"
                  className={`${minervaTheme.focusRing} ${styles.swatch}`}
                  style={{ backgroundColor: `#${rgbToHex(row.color)}` }}
                  aria-label={`Color for ${row.name}`}
                  disabled={fadeColors}
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
                onClick={() => toggleClassVisible(featureTableId, row.name)}
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
            if (pending) setClassColor(featureTableId, name, pending);
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
    </div>
  );
}
