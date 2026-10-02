import * as React from "react";
import AxisBreakIcon from "@/components/shared/icons/axis-break.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { sourceDtypeMax } from "@/lib/imaging/channelKind";
import { channelFloatRange } from "@/lib/imaging/floatRange";
import { resolveHistogramChartView } from "@/lib/imaging/histogramChartView";
import { type ChannelRendering, useAppStore } from "@/lib/stores/appStore";
import type { SourceDistributionData } from "@/lib/stores/documentSchema";
import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";
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
  dtypeMin: number;
  dtypeMax: number;
};

type ContrastScale = {
  fromSlider: (value: number) => number;
  toSlider: (value: number) => number;
  sliderSteps: number;
  dtypeMin: number;
  dtypeMax: number;
};

function snapContrastLimit(value: number, fractional: boolean): number {
  if (!fractional) return Math.round(value);
  return Number(value.toPrecision(6));
}

/**
 * Decimal places so the field resolves about a thousandth of the float span.
 * 0–1 shows thousandths; a span of 1000 shows whole numbers. Drop digits, then
 * scientific notation, when the text would no longer fit the box.
 */
function formatContrastLimit(
  value: number,
  range: { min: number; max: number } | null,
): string {
  if (!Number.isFinite(value)) return "";
  if (!range) return String(Math.round(value));
  const span = range.max - range.min;
  const exp = Math.floor(Math.log10(span));
  const wanted = Number.isFinite(exp) ? Math.max(0, 3 - exp) : 3;
  for (let decimals = Math.min(wanted, 6); decimals >= 0; decimals--) {
    const text = value.toFixed(decimals);
    if (text.length <= 6 && (Number(text) !== 0 || value === 0)) return text;
  }
  return value.toExponential(2);
}

const EMPTY_DIST: SourceDistributionData = {
  id: "",
  YValues: [],
  XScale: "log",
  YScale: "linear",
  LowerRange: 0,
  UpperRange: 16,
};

/** Map slider steps ↔ intensity values (linear or log axis). Ported from range-editor-element.js */
function buildContrastScale(input: ContrastScaleInput): ContrastScale {
  const { dtypeMin, dtypeMax } = input;
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
  values: readonly number[],
  width = 100,
  height = 11,
): { linePath: string; fillPath: string } {
  const line = [0, ...values, 0];
  const flat = line.slice(1, -1).every((v) => v === line[1]);
  const max = Math.max(1, ...(flat ? [2 * line[1]] : line));
  const len = Math.max(2, line.length);
  const linePath = line.reduce((d, v, index) => {
    const i = Math.min(Math.max(index, 1), len - 2) - 1;
    const x = Math.min(Math.max(i / (len - 3), 0), 1);
    const y = Math.min(Math.max(1 - v / max, 0), 1);
    const action = d.length ? "L" : "M";
    return `${d} ${action} ${width * x} ${height * y}`;
  }, "");
  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  return { linePath, fillPath };
}

export type ChannelContrastEditorProps = {
  groupId: string;
  channelId: string;
  sourceChannelId: string;
  channelLabel: string;
  r?: number;
  g?: number;
  b?: number;
  lowerLimit: number;
  upperLimit: number;
  histogramLoading?: boolean;
  distribution?: SourceDistributionData | null;
  sourceDataTypeId?: string;
  /** Finite sample span for a float plane. Absent for integer dtypes. */
  floatRange?: { min: number; max: number } | null;
};

export function renderingForSource<K extends ChannelRendering["kind"]>(
  live: ChannelRendering | null,
  sourceChannelId: string,
  kind: K,
): Extract<ChannelRendering, { kind: K }> | null {
  if (live?.kind === kind && live.sourceChannelId === sourceChannelId) {
    return live as Extract<ChannelRendering, { kind: K }>;
  }
  return null;
}

export function contrastEditorPropsForSource(
  channelRendering: ChannelRendering | null,
  sc: Channel,
  color: { r?: number; g?: number; b?: number },
  limits: [number, number],
): ChannelContrastEditorProps {
  const liveColor = renderingForSource(channelRendering, sc.id, "color");
  const c = liveColor ?? (sc.color ? color : undefined);
  const liveContrast = renderingForSource(channelRendering, sc.id, "contrast");
  return {
    groupId: "",
    channelId: sc.id,
    sourceChannelId: sc.id,
    channelLabel: sc.name,
    r: c?.r,
    g: c?.g,
    b: c?.b,
    lowerLimit: liveContrast ? liveContrast.lower : limits[0],
    upperLimit: liveContrast ? liveContrast.upper : limits[1],
    distribution: sc.sourceDistribution ?? null,
    sourceDataTypeId: sc.sourceDataTypeId,
    floatRange: channelFloatRange(sc),
  };
}

export function contrastEditorPropsForGroupRow(
  channelRendering: ChannelRendering | null,
  groupId: string,
  gc: ChannelGroupChannel,
  sc: Channel | undefined,
): ChannelContrastEditorProps {
  const sourceId = sc?.id ?? gc.channelId;
  const liveColor = renderingForSource(channelRendering, sourceId, "color");
  const c = liveColor ?? gc.color;
  const liveContrast = renderingForSource(
    channelRendering,
    sourceId,
    "contrast",
  );
  return {
    groupId,
    channelId: gc.id,
    sourceChannelId: sourceId,
    channelLabel: sc?.name ?? "Channel",
    r: c.r ?? 0,
    g: c.g ?? 0,
    b: c.b ?? 0,
    lowerLimit: liveContrast ? liveContrast.lower : gc.lowerLimit,
    upperLimit: liveContrast ? liveContrast.upper : gc.upperLimit,
    distribution: sc?.sourceDistribution ?? null,
    sourceDataTypeId: sc?.sourceDataTypeId,
    floatRange: sc ? channelFloatRange(sc) : null,
  };
}

export function ChannelContrastEditor(props: ChannelContrastEditorProps) {
  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setImages = useDocumentStore((s) => s.setImages);

  const dist = props.distribution ?? EMPTY_DIST;

  const [expanded, setExpanded] = React.useState(false);

  const rangeMin = props.floatRange?.min;
  const rangeMax = props.floatRange?.max;
  const range = React.useMemo(
    () =>
      rangeMin != null && rangeMax != null
        ? { min: rangeMin, max: rangeMax }
        : null,
    [rangeMin, rangeMax],
  );
  const fractional = range != null;
  const dtypeMax = sourceDtypeMax(props.sourceDataTypeId);
  const chart = React.useMemo(
    () =>
      resolveHistogramChartView(dist, {
        floatRange: range,
        dtypeMax,
        expanded,
        lowerLimit: props.lowerLimit,
      }),
    [dist, expanded, range, dtypeMax, props.lowerLimit],
  );
  const scale = React.useMemo(
    () => buildContrastScale(chart.scaleInput),
    [chart.scaleInput],
  );

  const [sliderMin, setSliderMin] = React.useState(() =>
    scale.toSlider(props.lowerLimit),
  );
  const [sliderMax, setSliderMax] = React.useState(() =>
    scale.toSlider(props.upperLimit),
  );
  const sliderMinRef = React.useRef(sliderMin);
  const sliderMaxRef = React.useRef(sliderMax);
  const editingLimitRef = React.useRef(false);
  const scaleRef = React.useRef(scale);
  if (scaleRef.current !== scale) {
    scaleRef.current = scale;
    if (!editingLimitRef.current) {
      const lo = scale.toSlider(props.lowerLimit);
      const hi = scale.toSlider(props.upperLimit);
      sliderMinRef.current = lo;
      sliderMaxRef.current = hi;
      if (lo !== sliderMin) setSliderMin(lo);
      if (hi !== sliderMax) setSliderMax(hi);
    }
  }
  const [minInput, setMinInput] = React.useState(() =>
    formatContrastLimit(props.lowerLimit, range),
  );
  const [maxInput, setMaxInput] = React.useState(() =>
    formatContrastLimit(props.upperLimit, range),
  );
  const lastCommittedRangeRef = React.useRef([
    snapContrastLimit(props.lowerLimit, fractional),
    snapContrastLimit(props.upperLimit, fractional),
  ] as const);

  React.useEffect(() => {
    if (editingLimitRef.current) return;
    const lo = snapContrastLimit(props.lowerLimit, fractional);
    const hi = snapContrastLimit(props.upperLimit, fractional);
    const loStep = scale.toSlider(props.lowerLimit);
    const hiStep = scale.toSlider(props.upperLimit);
    setSliderMin(loStep);
    setSliderMax(hiStep);
    setMinInput(formatContrastLimit(lo, range));
    setMaxInput(formatContrastLimit(hi, range));
    lastCommittedRangeRef.current = [lo, hi];
    sliderMinRef.current = loStep;
    sliderMaxRef.current = hiStep;
  }, [props.lowerLimit, props.upperLimit, scale, fractional, range]);

  const previewRange = (lower: number, upper: number) => {
    useAppStore.getState().setChannelRendering({
      kind: "contrast",
      sourceChannelId: props.sourceChannelId,
      lower,
      upper,
    });
  };

  const commitRange = (lower: number, upper: number) => {
    const lo = snapContrastLimit(lower, fractional);
    const hi = snapContrastLimit(upper, fractional);
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
    const lo = snapContrastLimit(scale.fromSlider(loStep), fractional);
    const hi = snapContrastLimit(scale.fromSlider(hiStep), fractional);
    setMinInput(formatContrastLimit(lo, range));
    setMaxInput(formatContrastLimit(hi, range));
    if (commit) {
      commitRange(lo, hi);
    } else {
      previewRange(lo, hi);
    }
  };

  const onMinSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    editingLimitRef.current = true;
    const v = Math.min(Number(e.target.value), sliderMaxRef.current);
    sliderMinRef.current = v;
    setSliderMin(v);
    syncFromSliders(v, sliderMaxRef.current, false);
  };

  const onMaxSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    editingLimitRef.current = true;
    const v = Math.max(Number(e.target.value), sliderMinRef.current);
    sliderMaxRef.current = v;
    setSliderMax(v);
    syncFromSliders(sliderMinRef.current, v, false);
  };

  const onSliderCommit = () => {
    editingLimitRef.current = false;
    syncFromSliders(sliderMinRef.current, sliderMaxRef.current, true);
  };

  const commitFromInputs = () => {
    const preciseLo = snapContrastLimit(
      scale.fromSlider(sliderMinRef.current),
      fractional,
    );
    const preciseHi = snapContrastLimit(
      scale.fromSlider(sliderMaxRef.current),
      fractional,
    );
    let lo =
      minInput === formatContrastLimit(preciseLo, range)
        ? preciseLo
        : Number.parseFloat(minInput);
    let hi =
      maxInput === formatContrastLimit(preciseHi, range)
        ? preciseHi
        : Number.parseFloat(maxInput);
    if (!Number.isFinite(lo)) lo = scale.dtypeMin;
    if (!Number.isFinite(hi)) hi = scale.dtypeMax;
    lo = snapContrastLimit(
      Math.max(scale.dtypeMin, Math.min(scale.dtypeMax, lo)),
      fractional,
    );
    hi = snapContrastLimit(
      Math.max(scale.dtypeMin, Math.min(scale.dtypeMax, hi)),
      fractional,
    );
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    setSliderMin(scale.toSlider(lo));
    setSliderMax(scale.toSlider(hi));
    setMinInput(formatContrastLimit(lo, range));
    setMaxInput(formatContrastLimit(hi, range));
    commitRange(lo, hi);
  };

  const minFrac = sliderMin / scale.sliderSteps;
  const maxFrac = sliderMax / scale.sliderSteps;

  const { linePath: histLinePath, fillPath: histFillPath } =
    histogramSparklinePaths(chart.yValues);
  const histogramClipId = React.useId();
  const histogramViewX = 1.15;
  const histogramViewWidth = 96.7;
  const histogramClipX = histogramViewX + minFrac * histogramViewWidth;
  const histogramClipWidth = (maxFrac - minFrac) * histogramViewWidth;
  const trimmed = chart.startBin > 0;

  return (
    <div className={styles.wrap}>
      <input
        type="number"
        className={`${minervaTheme.input} ${styles.limitInput}`}
        value={minInput}
        aria-label={`${props.channelLabel} contrast minimum value`}
        min={scale.dtypeMin}
        max={scale.dtypeMax}
        step={fractional ? "any" : 1}
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
          props.r != null && props.g != null && props.b != null
            ? ({
                "--histogram-color": `rgb(${props.r},${props.g},${props.b})`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div
          className={
            trimmed
              ? `${styles.histogramPlot} ${styles.histogramPlotTrimmed}`
              : styles.histogramPlot
          }
        >
          {trimmed ? (
            <button
              type="button"
              className={`${minervaTheme.focusRing} ${styles.axisBreak}`}
              title="Full range"
              aria-label={`${props.channelLabel} full histogram range`}
              onClick={() => setExpanded(true)}
            >
              <AxisBreakIcon />
            </button>
          ) : null}
          <svg
            className={styles.histogramSvg}
            viewBox="1.15 0 96.7 11"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${props.channelLabel} intensity histogram`}
          >
            <defs>
              <clipPath id={`${histogramClipId}-frame`}>
                <rect
                  x={histogramViewX}
                  y={-1}
                  width={histogramViewWidth}
                  height={13}
                />
              </clipPath>
              <clipPath id={histogramClipId}>
                <rect
                  x={histogramClipX}
                  y={0}
                  width={histogramClipWidth}
                  height={11}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${histogramClipId}-frame)`}>
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
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={`${styles.rangeInput} ${styles.rangeInputMin}`}
              min={0}
              max={scale.sliderSteps}
              value={sliderMin}
              onChange={onMinSlider}
              onMouseUp={onSliderCommit}
              onTouchEnd={onSliderCommit}
              onKeyUp={onSliderCommit}
              onBlur={onSliderCommit}
              aria-label={`${props.channelLabel} contrast minimum`}
              aria-valuetext={`${formatContrastLimit(
                scale.fromSlider(sliderMin),
                range,
              )} intensity`}
            />
            <input
              type="range"
              className={`${styles.rangeInput} ${styles.rangeInputMax}`}
              min={0}
              max={scale.sliderSteps}
              value={sliderMax}
              onChange={onMaxSlider}
              onMouseUp={onSliderCommit}
              onTouchEnd={onSliderCommit}
              onKeyUp={onSliderCommit}
              onBlur={onSliderCommit}
              aria-label={`${props.channelLabel} contrast maximum`}
              aria-valuetext={`${formatContrastLimit(
                scale.fromSlider(sliderMax),
                range,
              )} intensity`}
            />
          </div>
        </div>
      </div>
      <input
        type="number"
        className={`${minervaTheme.input} ${styles.limitInput}`}
        value={maxInput}
        aria-label={`${props.channelLabel} contrast maximum value`}
        min={scale.dtypeMin}
        max={scale.dtypeMax}
        step={fractional ? "any" : 1}
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
