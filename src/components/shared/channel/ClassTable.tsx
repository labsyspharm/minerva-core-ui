import { fileOpen } from "browser-fs-access";
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
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import {
  attachClassTable,
  classNameVisible,
  detachClassTable,
  getClassTableIngestEpoch,
  pageClassTable,
  peekClassCsv,
  setAllClassesVisible,
  setClassColor,
  subscribeClassTableIngest,
  toggleClassVisible,
} from "@/lib/classTable";
import {
  type ClassVisibility,
  defaultClassColor,
} from "@/lib/imaging/maskLayers";
import { rgbToHex } from "@/lib/imaging/sourceChannelStyle";
import { useAppStore } from "@/lib/stores/appStore";
import type { ClassTable, Color } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import styles from "./ClassTable.module.css";

const ROW_H = 22;
const WINDOW = 80;

type ClassTableRow = {
  name: string;
  color: Color;
  visible: boolean;
};

function mergeClassTableRows(
  classTable: ClassTable,
  vis: ClassVisibility | undefined,
  colorSeed: number,
  rows: readonly { name: string }[],
): ClassTableRow[] {
  const colors = new Map(classTable.nameColors.map((o) => [o.name, o.color]));
  return rows.map((row) => {
    return {
      name: row.name,
      color: colors.get(row.name) ?? defaultClassColor(1, colorSeed),
      visible: classNameVisible(vis, row.name),
    };
  });
}

const EDGE = 10;

function useClassTableList(classTableId: string) {
  const [filter, setFilter] = useState("");
  const [raw, setRaw] = useState<{ name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedOffset, setLoadedOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const vis = useAppStore((s) => s.classTableVisibilities[classTableId]);
  const classTable = useDocumentStore((s) =>
    s.classTables.find((c) => c.id === classTableId),
  );
  const digest = classTable?.digest;
  const ingestEpoch = useSyncExternalStore(
    subscribeClassTableIngest,
    getClassTableIngestEpoch,
    getClassTableIngestEpoch,
  );
  const viz = useDocumentStore((s) => {
    const sourceId = classTable?.sourceChannelId;
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
  const seed = viz?.colorSeed ?? 0;
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
      void pageClassTable(classTableId, query, offset, WINDOW)
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
    [classTableId],
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

  const rows = useMemo<ClassTableRow[]>(() => {
    if (!classTable) return [];
    return mergeClassTableRows(classTable, vis, seed, raw);
  }, [classTable, vis, seed, raw]);

  return {
    rows,
    total,
    filter,
    loadedOffset,
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

export function ClassCsvColumnPick(props: {
  headers: string[];
  id: string;
  name: string;
  onId: (value: string) => void;
  onName: (value: string) => void;
}) {
  return (
    <div className={styles.colPick}>
      <label>
        ID
        <select
          className={styles.filter}
          value={props.id}
          aria-label="ID column"
          onChange={(e) => props.onId(e.target.value)}
        >
          {props.headers.map((h) => (
            <option key={`id-${h}`} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <label>
        Name
        <select
          className={styles.filter}
          value={props.name}
          aria-label="Name column"
          onChange={(e) => props.onName(e.target.value)}
        >
          {props.headers.map((h) => (
            <option key={`name-${h}`} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function classTableRowExtras(
  sourceChannelId: string,
  classTables: { id?: string; sourceChannelId?: string }[],
) {
  const classTableId = classTables.find(
    (c) => c.sourceChannelId === sourceChannelId,
  )?.id;
  return {
    classColors: classTableId != null,
    maskFooter: (
      <ClassTableFooter
        sourceChannelId={sourceChannelId}
        classTableId={classTableId}
      />
    ),
  };
}

function ClassTableFooter(props: {
  sourceChannelId: string;
  classTableId: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const attached = props.classTableId != null;
  return (
    <>
      {props.classTableId ? (
        <ClassTableListBody
          key={props.classTableId}
          classTableId={props.classTableId}
        />
      ) : busy ? (
        <div className={styles.scroller} style={{ minHeight: 44 }}>
          <div className={styles.loading}>
            <div className={minervaTheme.spinnerSm} />
          </div>
        </div>
      ) : null}
      <ClassTableControls
        sourceChannelId={props.sourceChannelId}
        attached={attached}
        busy={busy}
        setBusy={setBusy}
      />
    </>
  );
}

function ClassTableControls(props: {
  sourceChannelId: string;
  attached: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const { sourceChannelId, attached, busy, setBusy } = props;
  const [pendingCsv, setPendingCsv] = useState<{
    file: File;
    headers: string[];
    id: string;
    name: string;
  } | null>(null);

  const attachFile = async (
    file: File,
    columns?: { id: string; name: string },
  ) => {
    setBusy(true);
    try {
      const result = await attachClassTable({
        sourceChannelId,
        file,
        columns,
      });
      if (result.ok === false) window.alert(result.error);
    } finally {
      setBusy(false);
    }
  };

  const pickAndAttach = async () => {
    let file: File;
    try {
      file = await fileOpen({
        description: "Class table CSV",
        mimeTypes: ["text/csv"],
        extensions: [".csv"],
        multiple: false,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      throw e;
    }
    const peek = await peekClassCsv(file);
    if (!peek) {
      await attachFile(file);
      return;
    }
    setPendingCsv({ file, ...peek });
  };

  if (pendingCsv) {
    return (
      <div className={styles.actions}>
        <ClassCsvColumnPick
          headers={pendingCsv.headers}
          id={pendingCsv.id}
          name={pendingCsv.name}
          onId={(id) => setPendingCsv({ ...pendingCsv, id })}
          onName={(name) => setPendingCsv({ ...pendingCsv, name })}
        />
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.toolBtn}`}
          disabled={busy}
          onClick={() => {
            void attachFile(pendingCsv.file, {
              id: pendingCsv.id,
              name: pendingCsv.name,
            }).then(() => setPendingCsv(null));
          }}
        >
          Attach
        </button>
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.toolBtn}`}
          disabled={busy}
          onClick={() => setPendingCsv(null)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${minervaTheme.focusRing} ${styles.toolBtn}`}
        disabled={busy}
        onClick={() => void pickAndAttach()}
      >
        {attached ? "Replace class table…" : "Attach class table…"}
      </button>
      {attached ? (
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.toolBtn}`}
          disabled={busy}
          onClick={() => void detachClassTable(sourceChannelId)}
        >
          Remove table
        </button>
      ) : null}
    </div>
  );
}

function ClassTableListBody(props: { classTableId: string }) {
  const { classTableId } = props;
  const list = useClassTableList(classTableId);
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

  useEffect(() => {
    if (fadeColors) setPicker(null);
  }, [fadeColors]);

  return (
    <div className={styles.root} data-channel-drag-ignore="">
      <div className={styles.toolbar}>
        <input
          className={styles.filter}
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
          className={`${minervaTheme.focusRing} ${styles.toolBtn}`}
          onClick={() => setAllClassesVisible(classTableId, true)}
        >
          Show all
        </button>
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.toolBtn}`}
          onClick={() => setAllClassesVisible(classTableId, false)}
        >
          Hide all
        </button>
      </div>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        onScroll={() => {
          const el = scrollerRef.current;
          if (!el) return;
          list.onScroll(el.scrollTop, el.clientHeight);
        }}
      >
        {showBusy ? (
          <div className={styles.loading}>
            <div className={minervaTheme.spinnerSm} />
          </div>
        ) : null}
        <div
          style={{
            height: Math.max(list.total, showBusy ? 2 : 1) * ROW_H,
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
                onClick={() => toggleClassVisible(classTableId, row.name)}
              />
              <button
                type="button"
                className={`${minervaTheme.focusRing} ${styles.swatch}${
                  fadeColors ? ` ${styles.swatchFaded}` : ""
                }`}
                style={{ backgroundColor: `#${rgbToHex(row.color)}` }}
                aria-label={`Color for ${row.name}`}
                disabled={fadeColors}
                onClick={(e) => {
                  const pos = colorPickerAnchorPosition(
                    e.currentTarget.getBoundingClientRect(),
                  );
                  setPicker({
                    name: row.name,
                    hex: rgbToHex(row.color),
                    ...pos,
                  });
                }}
              />
              <button
                type="button"
                className={`${minervaTheme.focusRing} ${styles.name}`}
                title={row.visible ? `Hide ${row.name}` : `Show ${row.name}`}
                aria-pressed={row.visible}
                onClick={() => toggleClassVisible(classTableId, row.name)}
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
            if (pending) setClassColor(classTableId, name, pending);
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
