import {
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChannelContrastEditor,
  type ChannelContrastEditorProps,
} from "@/components/shared/channel/ChannelContrastEditor";
import {
  type ChannelRowMore,
  ChannelRowMoreMenu,
} from "@/components/shared/channel/ChannelRowMoreMenu";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import type { MaskVisualization } from "@/lib/imaging/channelKind";
import { withReseededRandomColors } from "@/lib/imaging/channelKind";
import styles from "./ChannelRow.module.css";

function ChannelColorSwatchButton(props: {
  hex?: string;
  title: string;
  ariaLabel: string;
  busy?: boolean;
  filled?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  const { hex, title, ariaLabel, busy, filled = true, onClick } = props;
  const fill = Boolean(hex) && filled;
  return (
    <button
      type="button"
      className={[
        minervaTheme.focusRing,
        styles.channelColorSwatch,
        fill ? null : styles.channelColorSwatchUnfilled,
        busy ? minervaTheme.busyOverlay : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        fill
          ? { backgroundColor: `#${hex}` }
          : hex
            ? ({ "--swatch-color": `#${hex}` } as CSSProperties)
            : undefined
      }
      title={busy ? "Optimizing color" : title}
      aria-label={busy ? "Optimizing color" : ariaLabel}
      aria-busy={busy || undefined}
      onClick={onClick}
    />
  );
}

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

/** 0–100% slider over a `0…1` opacity; previews while dragging, commits on release. */
export function OpacitySlider(props: {
  value: number;
  onCommit: (opacity: number) => void;
  onPreview?: (opacity: number | null) => void;
  ariaLabel: string;
  className?: string;
}) {
  const { value, onCommit, onPreview, ariaLabel, className } = props;
  const committedPct = Math.round(value * 100);
  const [pct, setPct] = useState(committedPct);
  // Release can land in the same render as the last change; commit from the ref.
  const pctRef = useRef(committedPct);
  const lastCommittedPct = useRef(committedPct);

  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  useEffect(() => {
    pctRef.current = committedPct;
    setPct(committedPct);
    lastCommittedPct.current = committedPct;
  }, [committedPct]);

  useEffect(() => () => onPreviewRef.current?.(null), []);

  const show = (nextPct: number) => {
    pctRef.current = nextPct;
    setPct(nextPct);
  };
  const commit = () => {
    const nextPct = pctRef.current;
    if (nextPct !== lastCommittedPct.current) {
      lastCommittedPct.current = nextPct;
      onCommit(nextPct / 100);
    }
    onPreview?.(null);
  };

  return (
    <label
      className={[styles.maskOpacityControl, className]
        .filter(Boolean)
        .join(" ")}
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
            show(nextPct);
            onPreview?.(nextPct / 100);
          }}
          onPointerUp={commit}
          onPointerCancel={() => {
            show(committedPct);
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
  ariaLabel: string;
  classColors?: boolean;
}) {
  const { value, onChange, ariaLabel, classColors } = props;
  const colored = value.color === "random";
  let colorLabel = "Random colors";
  let colorTitle = "Random colors";
  if (classColors) {
    colorLabel = "Colored";
    colorTitle = "Class colors";
  } else if (colored) {
    colorLabel = "Random colors, re-seed";
    colorTitle = "Random colors (click to re-seed)";
  }
  return (
    <div className={styles.maskModeControls}>
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
            active={colored}
            label={colorLabel}
            title={colorTitle}
            iconClass={styles.maskVizSwatchRandom}
            onClick={() =>
              onChange(
                classColors
                  ? { ...value, color: "random" }
                  : withReseededRandomColors(value),
              )
            }
          />
        </fieldset>
        <span className={styles.maskModeGroupLabel}>Color</span>
      </div>
    </div>
  );
}

function toggleOptionClass(active: boolean): string {
  return [
    minervaTheme.focusRing,
    styles.maskVizOption,
    styles.modeToggleOption,
    active ? styles.maskVizOptionActive : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** A choice of text options, in the same segmented chrome as the mask fill toggle. */
export function SegmentedToggle<T extends string>(props: {
  ariaLabel: string;
  value: T;
  options: readonly { value: T; label: string; title: string }[];
  onChange: (value: T) => void;
}) {
  const { ariaLabel, value, options, onChange } = props;
  return (
    <fieldset className={styles.maskVizToggle} aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={toggleOptionClass(option.value === value)}
          aria-pressed={option.value === value}
          title={option.title}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

/** Stain deconvolution on or off for a packed RGB H&E row. */
function SeparateStainsToggle(props: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const { on, onChange } = props;
  return (
    <span className={styles.maskVizToggle}>
      <button
        type="button"
        className={toggleOptionClass(on)}
        aria-pressed={on}
        title={
          on
            ? "Show the scanned RGB image again"
            : "Color deconvolution: hematoxylin and eosin as their own channels, fitted to this slide"
        }
        onClick={() => onChange(!on)}
      >
        Separate stains
      </button>
    </span>
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
  visible: boolean;
  visibilityTitle: string;
  visibilityAriaLabel: string;
  onToggleVisibility: MouseEventHandler<HTMLButtonElement>;
  name: ChannelRowNameProps;
  imageSubtitle?: string | null;
  contrast?: ChannelContrastEditorProps;
  trailing?: ReactNode;
  locked?: boolean;
  isMask?: boolean;
  maskVisualization?: MaskVisualization;
  onMaskVisualizationChange?: (viz: MaskVisualization) => void;
  maskFooter?: ReactNode;
  maskAction?: ReactNode;
  maskAriaLabel?: string;
  /** Non-interactive swatch when the row has no color picker (e.g. selection mask). */
  fixedColorHex?: string;
  colorHex?: string;
  colorTitle?: string;
  busy?: boolean;
  fitting?: boolean;
  visibilityBlocked?: boolean;
  onColorClick?: MouseEventHandler<HTMLButtonElement>;
  more?: ChannelRowMore;
  /** Packed RGB (H&E) row: shows the Separate stains switch. */
  heSplit?: boolean;
  onHeSplitChange?: (split: boolean) => void;
};

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

/** One-row channel editor: visibility, name, histogram, swatch, optional action. */
export function ChannelRow(props: ChannelRowProps) {
  const {
    visible,
    visibilityTitle,
    visibilityAriaLabel,
    onToggleVisibility,
    name,
    imageSubtitle,
    contrast,
    trailing,
    locked,
    isMask,
    maskVisualization,
    onMaskVisualizationChange,
    maskFooter,
    maskAction,
    maskAriaLabel,
    fixedColorHex,
    colorHex,
    colorTitle,
    busy,
    fitting,
    visibilityBlocked,
    onColorClick,
    more,
    heSplit,
    onHeSplitChange,
  } = props;

  const showMask = isMask && maskVisualization;
  const showColor = !isMask && onColorClick;

  return (
    <div
      className={[
        styles.channelRow,
        locked ? styles.detailChannelRowLocked : null,
        fitting ? minervaTheme.busyOverlay : null,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={fitting || undefined}
      title={fitting ? "Fitting contrast…" : undefined}
    >
      <div
        className={`${styles.channelRowMain}${
          showMask ? ` ${styles.channelRowMainMask}` : ""
        }`}
      >
        <ChannelVisibilitySwatch
          visible={visible}
          title={visibilityTitle}
          ariaLabel={visibilityAriaLabel}
          blocked={visibilityBlocked}
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
        <div className={styles.channelRowMid}>
          {contrast ? <ChannelContrastEditor {...contrast} /> : null}
          {showMask && onMaskVisualizationChange ? (
            <MaskModeControls
              value={maskVisualization}
              ariaLabel={maskAriaLabel ?? name.name}
              classColors={maskFooter != null}
              onChange={onMaskVisualizationChange}
            />
          ) : null}
          {onHeSplitChange ? (
            <SeparateStainsToggle
              on={Boolean(heSplit)}
              onChange={onHeSplitChange}
            />
          ) : null}
        </div>
        {fixedColorHex && !showColor ? (
          <span
            className={styles.channelColorSwatchStatic}
            style={{ backgroundColor: `#${fixedColorHex}` }}
            aria-hidden
          />
        ) : null}
        {showColor ? (
          <ChannelColorSwatchButton
            hex={colorHex}
            busy={busy}
            filled={visible}
            title={colorTitle ?? `Pick color`}
            ariaLabel={colorTitle ?? `Pick color`}
            onClick={onColorClick}
          />
        ) : null}
        <div className={styles.channelRowTrailing}>
          {trailing}
          {/* Draw modes are offered wherever a channel's contrast editor is
              shown; an H&E stain row is part of its RGB channel instead. */}
          {more || (contrast && !contrast.heComponent) ? (
            <ChannelRowMoreMenu
              channelName={name.name}
              fitBusy={fitting}
              drawChannelId={
                contrast?.heComponent ? undefined : contrast?.sourceChannelId
              }
              drawRowId={contrast?.groupId ? contrast.channelId : undefined}
              {...more}
            />
          ) : null}
        </div>
        {showMask ? maskAction : null}
      </div>
      {showMask && maskFooter ? (
        <div className={styles.maskControlsPanel}>{maskFooter}</div>
      ) : null}
    </div>
  );
}
