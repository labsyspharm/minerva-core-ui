import * as React from "react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { useAppStore } from "@/lib/stores/appStore";
import type { SourceDistributionData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  applyGroupChannelRange,
  applySourceChannelRange,
} from "@/lib/stores/storeUtils";
import styles from "./ChannelContrastEditor.module.css";

/** Internal slider resolution; not tied to histogram bin count so handles move smoothly. */
const SLIDER_DOMAIN_STEPS = 8192;

type ContrastScaleInput = {
  distScale: string;
  distMin: number;
  distMax: number;
  dtypeMin?: number;
  dtypeMax?: number;
};

type ContrastScale = {
  fromSlider: (value: number) => number;
  toSlider: (value: number) => number;
  sliderSteps: number;
  dtypeMin: number;
  dtypeMax: number;
};

const DEFAULT_DTYPE_MIN = 0;
const DEFAULT_DTYPE_MAX = 65535;

/** Map slider steps ↔ intensity values (linear or log axis). Ported from range-editor-element.js */
function buildContrastScale(input: ContrastScaleInput): ContrastScale {
  const dtypeMin = input.dtypeMin ?? DEFAULT_DTYPE_MIN;
  const dtypeMax = input.dtypeMax ?? DEFAULT_DTYPE_MAX;
  const chart_x_steps = SLIDER_DOMAIN_STEPS;
  const chart_x_max = input.distMax;
  const chart_x_origin = input.distMin;
  const chart_x_range = chart_x_max - chart_x_origin;
  const chart_x_scale = chart_x_steps / chart_x_range;

  const fromSlider = (value: number): number => {
    const v_linear = chart_x_origin + value / chart_x_scale;
    let v = v_linear;
    if (input.distScale === "log") {
      if (v_linear <= chart_x_origin) {
        v = chart_x_origin === 0 ? 0 : 2 ** chart_x_origin;
      } else {
        v = 2 ** v_linear;
      }
    }
    return Math.max(dtypeMin, Math.min(dtypeMax, v));
  };

  const toSlider = (value: number): number => {
    let v = value;
    if (input.distScale === "log") {
      if (chart_x_origin === 0 && v <= 0) {
        v = 0;
      } else {
        const minPositive = chart_x_origin === 0 ? 1 : 2 ** chart_x_origin;
        v = Math.log2(Math.max(minPositive, v));
      }
    }
    return Math.round(
      chart_x_scale * Math.max(0, Math.min(chart_x_range, v - chart_x_origin)),
    );
  };

  return {
    fromSlider,
    toSlider,
    sliderSteps: chart_x_steps,
    dtypeMin,
    dtypeMax,
  };
}

/** Build SVG paths for histogram sparkline (channel-item-element chartTemplate). */
function histogramSparklinePaths(
  values: number[] | undefined,
  width = 100,
  height = 11,
): { linePath: string; fillPath: string } {
  const line = [0, ...(values || []), 0];
  const flat = line.slice(1, -1).every((v) => v === line[1]);
  const max = Math.max(1, ...(flat ? [2 * line[1]] : line));
  const len = Math.max(2, line.length);
  const linePath = line.reduce((d, v, index) => {
    const i = Math.min(Math.max(index, 1), len - 2) - 1;
    const x = Math.min(Math.max(i / (len - 3), 0), 1);
    const y = Math.min(Math.max(1 - v / max, 0), 1);
    const action = d.length ? "L" : "M";
    return `${d} ${action} ${width * x} ${2 + (height - 2) * y}`;
  }, "");
  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  return { linePath, fillPath };
}

export type ChannelContrastEditorProps = {
  groupId: string;
  channelId: string;
  sourceChannelId: string;
  channelLabel: string;
  r: number;
  g: number;
  b: number;
  lowerLimit: number;
  upperLimit: number;
  histogramLoading?: boolean;
  distribution?: SourceDistributionData | null;
};

export function ChannelContrastEditor(props: ChannelContrastEditorProps) {
  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setImages = useDocumentStore((s) => s.setImages);

  const dist = props.distribution ?? {
    id: "",
    YValues: [] as number[],
    XScale: "log",
    YScale: "linear",
    LowerRange: 0,
    UpperRange: 16,
  };

  const scale = React.useMemo(
    () =>
      buildContrastScale({
        distScale: dist.XScale,
        distMin: dist.LowerRange,
        distMax: dist.UpperRange,
      }),
    [dist.XScale, dist.LowerRange, dist.UpperRange],
  );

  const [sliderMin, setSliderMin] = React.useState(() =>
    scale.toSlider(props.lowerLimit),
  );
  const [sliderMax, setSliderMax] = React.useState(() =>
    scale.toSlider(props.upperLimit),
  );
  const [minInput, setMinInput] = React.useState(String(props.lowerLimit));
  const [maxInput, setMaxInput] = React.useState(String(props.upperLimit));
  const editingLimitRef = React.useRef(false);
  const lastCommittedRangeRef = React.useRef([
    Math.round(props.lowerLimit),
    Math.round(props.upperLimit),
  ] as const);

  React.useEffect(() => {
    if (editingLimitRef.current) return;
    setSliderMin(scale.toSlider(props.lowerLimit));
    setSliderMax(scale.toSlider(props.upperLimit));
    setMinInput(String(Math.round(props.lowerLimit)));
    setMaxInput(String(Math.round(props.upperLimit)));
    lastCommittedRangeRef.current = [
      Math.round(props.lowerLimit),
      Math.round(props.upperLimit),
    ];
  }, [props.lowerLimit, props.upperLimit, scale]);

  const previewRange = (lower: number, upper: number) => {
    useAppStore.getState().setChannelRendering({
      kind: "contrast",
      sourceChannelId: props.sourceChannelId,
      lower,
      upper,
    });
  };

  const commitRange = (lower: number, upper: number) => {
    const lo = Math.round(lower);
    const hi = Math.round(upper);
    const [lastLo, lastHi] = lastCommittedRangeRef.current;
    if (lo === lastLo && hi === lastHi) {
      useAppStore.getState().clearChannelRendering();
      return;
    }
    lastCommittedRangeRef.current = [lo, hi];
    // Read document slices at commit time — avoid stale closures from drag start.
    const doc = useDocumentStore.getState();
    if (props.groupId) {
      setChannelGroups(
        applyGroupChannelRange(doc.channelGroups, {
          LowerRange: lo,
          UpperRange: hi,
          group_uuid: props.groupId,
          channel_uuid: props.channelId,
        }),
      );
    } else {
      // Keep gmmContrastLimits in sync: stack/ungrouped display uses
      // effectiveSourceLimits → gmm when present.
      setImages(
        applySourceChannelRange(doc.images, props.sourceChannelId, lo, hi),
      );
    }
    useAppStore.getState().clearChannelRendering();
  };

  React.useEffect(() => {
    return () => {
      const { channelRendering, clearChannelRendering } =
        useAppStore.getState();
      if (
        channelRendering?.kind === "contrast" &&
        channelRendering.sourceChannelId === props.sourceChannelId
      ) {
        clearChannelRendering();
      }
    };
  }, [props.sourceChannelId]);

  const syncFromSliders = (loStep: number, hiStep: number, commit: boolean) => {
    const lo = Math.round(scale.fromSlider(loStep));
    const hi = Math.round(scale.fromSlider(hiStep));
    setMinInput(String(lo));
    setMaxInput(String(hi));
    if (commit) {
      commitRange(lo, hi);
    } else {
      previewRange(lo, hi);
    }
  };

  const onMinSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), sliderMax);
    setSliderMin(v);
    syncFromSliders(v, sliderMax, false);
  };

  const onMaxSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), sliderMin);
    setSliderMax(v);
    syncFromSliders(sliderMin, v, false);
  };

  const onSliderCommit = () => {
    syncFromSliders(sliderMin, sliderMax, true);
  };

  const commitFromInputs = () => {
    let lo = Number.parseFloat(minInput);
    let hi = Number.parseFloat(maxInput);
    if (!Number.isFinite(lo)) lo = scale.dtypeMin;
    if (!Number.isFinite(hi)) hi = scale.dtypeMax;
    lo = Math.round(Math.max(scale.dtypeMin, Math.min(scale.dtypeMax, lo)));
    hi = Math.round(Math.max(scale.dtypeMin, Math.min(scale.dtypeMax, hi)));
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    setSliderMin(scale.toSlider(lo));
    setSliderMax(scale.toSlider(hi));
    setMinInput(String(lo));
    setMaxInput(String(hi));
    commitRange(lo, hi);
  };

  const minFrac = sliderMin / scale.sliderSteps;
  const maxFrac = sliderMax / scale.sliderSteps;
  const sliderRowRef = React.useRef<HTMLDivElement>(null);
  const panDragRef = React.useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startMin: number;
    startMax: number;
  } | null>(null);
  const panMovedRef = React.useRef(false);

  const { linePath: histLinePath, fillPath: histFillPath } =
    histogramSparklinePaths(dist.YValues);
  const histogramClipId = React.useId();
  const histogramViewX = 1.15;
  const histogramViewWidth = 96.7;
  const histogramClipX = histogramViewX + minFrac * histogramViewWidth;
  const histogramClipWidth = (maxFrac - minFrac) * histogramViewWidth;

  const stepFromClientX = (clientX: number) => {
    const row = sliderRowRef.current;
    if (!row) return 0;
    const rect = row.getBoundingClientRect();
    const x = clientX - rect.left;
    const frac = Math.min(1, Math.max(0, x / Math.max(1, rect.width)));
    return Math.round(frac * scale.sliderSteps);
  };

  const onRangePanPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    panMovedRef.current = false;
    panDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startMin: sliderMin,
      startMax: sliderMax,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onRangePanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag?.active || drag.pointerId !== e.pointerId) return;
    if (Math.abs(e.clientX - drag.startX) > 2) {
      panMovedRef.current = true;
    }
    const row = sliderRowRef.current;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const deltaSteps = Math.round(
      ((e.clientX - drag.startX) / Math.max(1, rect.width)) * scale.sliderSteps,
    );
    const span = drag.startMax - drag.startMin;
    let lo = drag.startMin + deltaSteps;
    let hi = drag.startMax + deltaSteps;
    if (lo < 0) {
      lo = 0;
      hi = span;
    }
    if (hi > scale.sliderSteps) {
      hi = scale.sliderSteps;
      lo = scale.sliderSteps - span;
    }
    setSliderMin(lo);
    setSliderMax(hi);
    syncFromSliders(lo, hi, false);
  };

  const endRangePan = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag?.active || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!panMovedRef.current) {
      const step = stepFromClientX(e.clientX);
      const span = drag.startMax - drag.startMin;
      let lo = Math.round(step - span / 2);
      let hi = lo + span;
      if (lo < 0) {
        lo = 0;
        hi = span;
      }
      if (hi > scale.sliderSteps) {
        hi = scale.sliderSteps;
        lo = scale.sliderSteps - span;
      }
      setSliderMin(lo);
      setSliderMax(hi);
      syncFromSliders(lo, hi, true);
    } else {
      onSliderCommit();
    }
    panDragRef.current = null;
    panMovedRef.current = false;
  };

  const panLeft = `${minFrac * 100}%`;
  const panWidth = `${(maxFrac - minFrac) * 100}%`;

  return (
    <div className={styles.wrap}>
      <input
        type="number"
        className={`${minervaTheme.input} ${styles.limitInput}`}
        value={minInput}
        aria-label={`${props.channelLabel} contrast minimum value`}
        min={scale.dtypeMin}
        max={scale.dtypeMax}
        onFocus={() => {
          editingLimitRef.current = true;
        }}
        onChange={(e) => setMinInput(e.target.value)}
        onBlur={() => {
          editingLimitRef.current = false;
          commitFromInputs();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <div
        className={styles.histogramHost}
        style={
          {
            "--histogram-color": `rgb(${props.r},${props.g},${props.b})`,
          } as React.CSSProperties
        }
      >
        <svg
          className={styles.histogramSvg}
          viewBox="1.15 0 96.7 11"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${props.channelLabel} intensity histogram`}
        >
          <defs>
            <clipPath id={histogramClipId}>
              <rect
                x={histogramClipX}
                y={0}
                width={histogramClipWidth}
                height={11}
              />
            </clipPath>
          </defs>
          <path
            className={`${styles.histogramFill} ${styles.histogramOutOfRange}`}
            d={histFillPath}
          />
          <path
            className={`${styles.histogramLine} ${styles.histogramOutOfRange}`}
            d={histLinePath}
          />
          <g clipPath={`url(#${histogramClipId})`}>
            <path className={styles.histogramFill} d={histFillPath} />
            <path className={styles.histogramLine} d={histLinePath} />
          </g>
        </svg>
        <div
          className={`${styles.histogramLoading}${
            props.histogramLoading ? ` ${styles.histogramLoadingVisible}` : ""
          }`}
          title="Loading histogram"
        >
          <div className={minervaTheme.spinnerSm} />
        </div>
        <div ref={sliderRowRef} className={styles.sliderRow}>
          {sliderMax > sliderMin ? (
            <div
              className={styles.rangePan}
              style={{ left: panLeft, width: panWidth }}
              onPointerDown={onRangePanPointerDown}
              onPointerMove={onRangePanPointerMove}
              onPointerUp={endRangePan}
              onPointerCancel={endRangePan}
              aria-hidden
            />
          ) : null}
          <input
            type="range"
            className={styles.rangeInput}
            min={0}
            max={scale.sliderSteps}
            value={sliderMin}
            onChange={onMinSlider}
            onMouseUp={onSliderCommit}
            onTouchEnd={onSliderCommit}
            onKeyUp={onSliderCommit}
            onBlur={onSliderCommit}
            aria-label={`${props.channelLabel} contrast minimum`}
            aria-valuetext={`${Math.round(
              scale.fromSlider(sliderMin),
            )} intensity`}
          />
          <input
            type="range"
            className={styles.rangeInput}
            min={0}
            max={scale.sliderSteps}
            value={sliderMax}
            onChange={onMaxSlider}
            onMouseUp={onSliderCommit}
            onTouchEnd={onSliderCommit}
            onKeyUp={onSliderCommit}
            onBlur={onSliderCommit}
            aria-label={`${props.channelLabel} contrast maximum`}
            aria-valuetext={`${Math.round(
              scale.fromSlider(sliderMax),
            )} intensity`}
          />
        </div>
      </div>
      <input
        type="number"
        className={`${minervaTheme.input} ${styles.limitInput}`}
        value={maxInput}
        aria-label={`${props.channelLabel} contrast maximum value`}
        min={scale.dtypeMin}
        max={scale.dtypeMax}
        onFocus={() => {
          editingLimitRef.current = true;
        }}
        onChange={(e) => setMaxInput(e.target.value)}
        onBlur={() => {
          editingLimitRef.current = false;
          commitFromInputs();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}
