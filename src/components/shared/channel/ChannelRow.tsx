import {
  type MouseEventHandler,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  ChannelColorSwatchButton,
  ChannelVisibilitySwatch,
} from "@/components/shared/channel/ChannelVisibilitySwatch";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import type { MaskVisualization } from "@/lib/imaging/channelKind";
import { withReseededRandomColors } from "@/lib/imaging/channelKind";
import styles from "./ChannelRow.module.css";

function MaskVizButton(props: {
  active: boolean;
  label: string;
  title?: string;
  onClick: () => void;
  iconClass: string;
}) {
  return (
    <button
      type="button"
      className={`${minervaTheme.focusRing} ${styles.maskVizOption}${
        props.active ? ` ${styles.maskVizOptionActive}` : ""
      }`}
      aria-pressed={props.active}
      title={props.title ?? props.label}
      aria-label={props.label}
      onClick={props.onClick}
    >
      <span className={props.iconClass} aria-hidden />
    </button>
  );
}

function MaskOpacityControl(props: {
  value: MaskVisualization;
  onChange: (viz: MaskVisualization) => void;
  onPreview?: (viz: MaskVisualization | null) => void;
  ariaLabel: string;
}) {
  const { value, onChange, onPreview, ariaLabel } = props;
  const committedPct = Math.round(value.opacity * 100);
  const [pct, setPct] = useState(committedPct);
  const lastCommittedPct = useRef(committedPct);

  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  useEffect(() => {
    setPct(committedPct);
    lastCommittedPct.current = committedPct;
  }, [committedPct]);

  useEffect(() => () => onPreviewRef.current?.(null), []);

  const visualizationAt = (nextPct: number): MaskVisualization => ({
    ...value,
    opacity: nextPct / 100,
  });
  const commit = () => {
    if (pct !== lastCommittedPct.current) {
      lastCommittedPct.current = pct;
      onChange(visualizationAt(pct));
    }
    onPreview?.(null);
  };

  return (
    <label
      className={styles.maskOpacityControl}
      title={`Opacity ${pct}%`}
      style={{ ["--mask-opacity-pct" as string]: `${pct}%` }}
    >
      <span className={styles.maskOpacityInputRow}>
        <input
          type="range"
          className={styles.maskOpacitySlider}
          min={0}
          max={100}
          step={1}
          value={pct}
          aria-label={`${ariaLabel} opacity`}
          onChange={(e) => {
            const nextPct = Number(e.target.value);
            setPct(nextPct);
            onPreview?.(visualizationAt(nextPct));
          }}
          onPointerUp={commit}
          onPointerCancel={() => {
            setPct(committedPct);
            onPreview?.(null);
          }}
          onKeyUp={commit}
          onBlur={commit}
        />
        <span className={styles.maskOpacityValue}>{pct}%</span>
      </span>
      <span className={styles.maskOpacityLabel}>Opacity</span>
    </label>
  );
}

function MaskModeControls(props: {
  value: MaskVisualization;
  onChange: (viz: MaskVisualization) => void;
  onPreview?: (viz: MaskVisualization | null) => void;
  ariaLabel: string;
}) {
  const { value, onChange, ariaLabel } = props;
  const randomActive = value.color === "random";
  return (
    <div className={styles.maskModeControls}>
      <div className={styles.maskModeToggles}>
        <div className={styles.maskModeGroup}>
          <fieldset
            className={styles.maskVizToggle}
            aria-label={`${ariaLabel} fill`}
          >
            <MaskVizButton
              active={value.style === "outline"}
              label="Outline"
              iconClass={styles.maskVizIconOutline}
              onClick={() => onChange({ ...value, style: "outline" })}
            />
            <MaskVizButton
              active={value.style === "full"}
              label="Full"
              iconClass={styles.maskVizIconFull}
              onClick={() => onChange({ ...value, style: "full" })}
            />
          </fieldset>
          <span className={styles.maskModeGroupLabel}>Fill</span>
        </div>
        <div className={styles.maskModeGroup}>
          <fieldset
            className={styles.maskVizToggle}
            aria-label={`${ariaLabel} color`}
          >
            <MaskVizButton
              active={value.color === "white"}
              label="White"
              iconClass={styles.maskVizSwatchWhite}
              onClick={() => onChange({ ...value, color: "white" })}
            />
            <MaskVizButton
              active={randomActive}
              label={randomActive ? "Random colors, re-seed" : "Random colors"}
              title={
                randomActive
                  ? "Random colors (click to re-seed)"
                  : "Random colors"
              }
              iconClass={styles.maskVizSwatchRandom}
              onClick={() => onChange(withReseededRandomColors(value))}
            />
          </fieldset>
          <span className={styles.maskModeGroupLabel}>Color</span>
        </div>
      </div>
      <MaskOpacityControl
        value={value}
        onChange={onChange}
        onPreview={props.onPreview}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}

type ChannelRowNameProps =
  | {
      mode: "label";
      name: string;
      title?: string;
      className: string;
    }
  | {
      mode: "editable";
      name: string;
      meta: string;
      onBlur: (value: string) => void;
    };

type ChannelRowProps = {
  rowClassName: string;
  visible: boolean;
  visibilityTitle: string;
  visibilityAriaLabel: string;
  onToggleVisibility: MouseEventHandler<HTMLButtonElement>;
  name: ChannelRowNameProps;
  imageSubtitle?: string | null;
  /** Visibility + name only (hidden stack rows, RGB display). */
  compact?: boolean;
  trailing?: React.ReactNode;
  isMask?: boolean;
  maskVisualization?: MaskVisualization;
  onMaskVisualizationChange?: (viz: MaskVisualization) => void;
  onMaskVisualizationPreview?: (viz: MaskVisualization | null) => void;
  maskAriaLabel?: string;
  /** Non-interactive swatch when the row has no color picker (e.g. selection mask). */
  fixedColorHex?: string;
  colorHex?: string;
  colorTitle?: string;
  colorAriaLabel?: string;
  onColorClick?: MouseEventHandler<HTMLButtonElement>;
};

function scrollRowNearest(row: HTMLElement | null) {
  row?.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

function EditableChannelRowName(
  props: Extract<ChannelRowNameProps, { mode: "editable" }>,
) {
  const [draft, setDraft] = useState(props.name);
  const cancelCommit = useRef(false);

  useEffect(() => {
    setDraft(props.name);
  }, [props.name]);

  const commit = () => {
    if (cancelCommit.current) {
      cancelCommit.current = false;
      setDraft(props.name);
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed || trimmed === props.name) {
      setDraft(props.name);
      return;
    }
    setDraft(trimmed);
    props.onBlur(trimmed);
  };

  return (
    <input
      className={`${minervaTheme.field} ${styles.channelNameInput}`}
      type="text"
      value={draft}
      title={props.name}
      maxLength={200}
      autoComplete="off"
      spellCheck={false}
      aria-label={`Channel name (${props.meta})`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          cancelCommit.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** Shared channel list row: visibility, name, mask viz or color swatch, optional action. */
export function ChannelRow(props: ChannelRowProps) {
  const {
    rowClassName,
    visible,
    visibilityTitle,
    visibilityAriaLabel,
    onToggleVisibility,
    name,
    imageSubtitle,
    trailing,
    compact,
    isMask,
    maskVisualization,
    onMaskVisualizationChange,
    onMaskVisualizationPreview,
    maskAriaLabel,
    fixedColorHex,
    colorHex,
    colorTitle,
    colorAriaLabel,
    onColorClick,
  } = props;

  const showMask = !compact && isMask && maskVisualization;
  const showColor = !compact && !isMask && colorHex && onColorClick;
  const [maskControlsOpen, setMaskControlsOpen] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const maskControlsId = useId();

  const toggleMaskControls = () => {
    const opening = !maskControlsOpen;
    setMaskControlsOpen(opening);
    if (!opening) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollRowNearest(rowRef.current));
    });
  };

  return (
    <div ref={rowRef} className={rowClassName}>
      <div className={styles.channelRowMain}>
        <ChannelVisibilitySwatch
          visible={visible}
          title={visibilityTitle}
          ariaLabel={visibilityAriaLabel}
          onClick={onToggleVisibility}
        />
        <div className={styles.channelRowTitle}>
          <div className={styles.channelNameSlot}>
            {name.mode === "label" ? (
              <span className={name.className} title={name.title ?? name.name}>
                {name.name}
              </span>
            ) : (
              <EditableChannelRowName {...name} />
            )}
          </div>
          {imageSubtitle ? (
            <span
              className={styles.channelImageSubtitle}
              title={`From ${imageSubtitle}`}
            >
              {imageSubtitle}
            </span>
          ) : null}
        </div>
        {showMask ? (
          <button
            type="button"
            className={`${minervaTheme.focusRing} ${styles.maskDisclosureButton}`}
            aria-label={`${
              maskControlsOpen ? "Hide" : "Show"
            } mask display controls for ${name.name}`}
            aria-expanded={maskControlsOpen}
            aria-controls={maskControlsOpen ? maskControlsId : undefined}
            onClick={toggleMaskControls}
          >
            <ChevronIcon direction={maskControlsOpen ? "down" : "right"} />
          </button>
        ) : null}
        {showMask && fixedColorHex ? (
          <span
            className={styles.channelColorSwatchStatic}
            style={{ backgroundColor: `#${fixedColorHex}` }}
            aria-hidden
          />
        ) : null}
        {showColor ? (
          <ChannelColorSwatchButton
            hex={colorHex}
            title={colorTitle ?? `Pick color`}
            ariaLabel={colorAriaLabel ?? `Pick color`}
            onClick={onColorClick}
          />
        ) : null}
        {trailing ? (
          <div className={styles.channelRowTrailing}>{trailing}</div>
        ) : null}
      </div>
      {showMask && maskControlsOpen && onMaskVisualizationChange ? (
        <div id={maskControlsId} className={styles.maskControlsPanel}>
          <MaskModeControls
            value={maskVisualization}
            ariaLabel={maskAriaLabel ?? name.name}
            onChange={onMaskVisualizationChange}
            onPreview={onMaskVisualizationPreview}
          />
        </div>
      ) : null}
    </div>
  );
}
