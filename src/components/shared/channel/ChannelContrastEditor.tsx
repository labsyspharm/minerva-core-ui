import * as React from "react";
import {
  buildContrastScale,
  histogramSparklinePath,
} from "@/lib/imaging/contrastScale";
import { useAppStore } from "@/lib/stores/appStore";
import type { SourceDistributionData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import {
  applyGroupChannelRange,
  patchSourceChannelOnImages,
} from "@/lib/stores/storeUtils";
import styles from "./ChannelContrastEditor.module.css";

export type ChannelContrastEditorProps = {
  groupId: string;
  channelId: string;
  sourceChannelId: string;
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
  const channelGroups = useDocumentStore((s) => s.channelGroups);

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

  React.useEffect(() => {
    if (editingLimitRef.current) return;
    setSliderMin(scale.toSlider(props.lowerLimit));
    setSliderMax(scale.toSlider(props.upperLimit));
    setMinInput(String(Math.round(props.lowerLimit)));
    setMaxInput(String(Math.round(props.upperLimit)));
  }, [props.lowerLimit, props.upperLimit, scale]);

  const previewRange = React.useCallback(
    (lower: number, upper: number) => {
      useAppStore.getState().setChannelRendering({
        kind: "contrast",
        sourceChannelId: props.sourceChannelId,
        lower,
        upper,
      });
    },
    [props.sourceChannelId],
  );

  const commitRange = React.useCallback(
    (lower: number, upper: number) => {
      const lo = Math.round(lower);
      const hi = Math.round(upper);
      if (props.groupId) {
        setChannelGroups(
          applyGroupChannelRange(channelGroups, {
            LowerRange: lo,
            UpperRange: hi,
            group_uuid: props.groupId,
            channel_uuid: props.channelId,
          }),
        );
      } else {
        const doc = useDocumentStore.getState();
        setImages(
          patchSourceChannelOnImages(doc.images, props.sourceChannelId, {
            lowerLimit: lo,
            upperLimit: hi,
          }),
        );
      }
      useAppStore.getState().clearChannelRendering();
    },
    [
      channelGroups,
      props.groupId,
      props.channelId,
      props.sourceChannelId,
      setChannelGroups,
      setImages,
    ],
  );

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
  const handleHalf = 0.375;

  const histPath = histogramSparklinePath(dist.YValues);

  return (
    <div className={styles.wrap}>
      <div className={styles.histogramHost}>
        <svg
          className={styles.histogramSvg}
          viewBox="1.15 0 96.7 11"
          preserveAspectRatio="none"
          role="img"
          aria-label="Channel intensity histogram"
        >
          <path d={histPath} strokeLinejoin="round" />
        </svg>
        <div
          className={[
            styles.histogramLoading,
            props.histogramLoading ? styles.histogramLoadingVisible : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title="Loading histogram"
        >
          <div className={styles.histogramSpinner} />
        </div>
      </div>
      <div
        className={styles.controls}
        style={
          {
            "--slider-background": `rgb(${props.r},${props.g},${props.b})`,
          } as React.CSSProperties
        }
      >
        <div className={styles.sliderRow}>
          <div className={styles.track} />
          <input
            type="range"
            className={styles.rangeInput}
            min={0}
            max={scale.sliderSteps}
            value={sliderMin}
            onChange={onMinSlider}
            onMouseUp={onSliderCommit}
            onTouchEnd={onSliderCommit}
            aria-label="Contrast minimum"
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
            aria-label="Contrast maximum"
          />
        </div>
        <div className={styles.limitsRow}>
          <div
            className={styles.limitField}
            style={{
              left: `clamp(calc(var(--range-input-width) / 2), calc(${handleHalf}rem + ${minFrac} * (100% - ${handleHalf}rem)), calc(100% - var(--range-input-width) / 2))`,
            }}
          >
            <input
              type="number"
              className={styles.limitInput}
              value={minInput}
              aria-label="Contrast minimum value"
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
          </div>
          <div
            className={styles.limitField}
            style={{
              left: `clamp(calc(var(--range-input-width) / 2), calc(${handleHalf}rem + ${maxFrac} * (100% - ${handleHalf}rem)), calc(100% - var(--range-input-width) / 2))`,
              zIndex: 1,
            }}
          >
            <input
              type="number"
              className={styles.limitInput}
              value={maxInput}
              aria-label="Contrast maximum value"
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
        </div>
      </div>
    </div>
  );
}
