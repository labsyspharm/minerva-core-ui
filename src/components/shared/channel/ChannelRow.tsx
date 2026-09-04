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
      className={
        props.active
          ? `${minervaTheme.focusRing} ${styles.maskVizOption} ${styles.maskVizOptionActive}`
          : `${minervaTheme.focusRing} ${styles.maskVizOption}`
      }
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

  useEffect(() => {
    setPct(committedPct);
    lastCommittedPct.current = committedPct;
  }, [committedPct]);

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

type MaskRowStyleProps = {
  isMask: true;
  maskVisualization: MaskVisualization;
  onMaskVisualizationChange: (viz: MaskVisualization) => void;
  onMaskVisualizationPreview?: (viz: MaskVisualization | null) => void;
  maskAriaLabel: string;
  /** Non-interactive swatch when the row has no color picker (e.g. selection mask). */
  fixedColorHex?: string;
};

type IntensityRowStyleProps = {
  isMask?: false;
  colorHex: string;
  colorTitle: string;
  colorAriaLabel: string;
  onColorClick: MouseEventHandler<HTMLButtonElement>;
};

type ChannelRowStyleProps = MaskRowStyleProps | IntensityRowStyleProps;

export type ChannelRowProps = {
  rowClassName: string;
  visible: boolean;
  visibilityTitle: string;
  visibilityAriaLabel: string;
  onToggleVisibility: MouseEventHandler<HTMLButtonElement>;
  name: ChannelRowNameProps;
  imageSubtitle?: string | null;
  /** Stack row hidden in All Channels — name + visibility only. */
  compact?: boolean;
  trailing?: React.ReactNode;
} & ({ compact: true } | ({ compact?: false } & ChannelRowStyleProps));

function isIntensityRowStyle(
  props: ChannelRowStyleProps,
): props is IntensityRowStyleProps {
  return !props.isMask;
}

function channelRowHasStyleControls(
  props: ChannelRowProps,
): props is ChannelRowProps & ChannelRowStyleProps & { compact?: false } {
  return !props.compact;
}

function ChannelRowName(props: ChannelRowNameProps) {
  if (props.mode === "label") {
    return (
      <span className={props.className} title={props.title ?? props.name}>
        {props.name}
      </span>
    );
  }
  return <EditableChannelRowName {...props} />;
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
  } = props;

  const styleControls = channelRowHasStyleControls(props) ? props : null;
  const [maskControlsOpen, setMaskControlsOpen] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const maskControlsId = useId();

  const toggleMaskControls = () => {
    const opening = !maskControlsOpen;
    setMaskControlsOpen(opening);
    if (!opening) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rowRef.current?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      });
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
            <ChannelRowName {...name} />
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
        {styleControls?.isMask ? (
          <button
            type="button"
            className={`${minervaTheme.focusRing} ${styles.maskDisclosureButton}`}
            aria-label={`${
              maskControlsOpen ? "Hide" : "Show"
            } mask display controls for ${name.name}`}
            aria-expanded={maskControlsOpen}
            aria-controls={maskControlsId}
            onClick={toggleMaskControls}
          >
            <ChevronIcon direction={maskControlsOpen ? "down" : "right"} />
          </button>
        ) : null}
        {styleControls?.isMask && styleControls.fixedColorHex ? (
          <span
            className={styles.channelColorSwatch}
            style={{ backgroundColor: `#${styleControls.fixedColorHex}` }}
            aria-hidden
          />
        ) : null}
        {styleControls && isIntensityRowStyle(styleControls) ? (
          <ChannelColorSwatchButton
            hex={styleControls.colorHex}
            title={styleControls.colorTitle}
            ariaLabel={styleControls.colorAriaLabel}
            onClick={styleControls.onColorClick}
          />
        ) : null}
        {trailing ? (
          <div className={styles.channelRowTrailing}>{trailing}</div>
        ) : null}
      </div>
      {styleControls?.isMask && maskControlsOpen ? (
        <div id={maskControlsId} className={styles.maskControlsPanel}>
          <MaskModeControls
            value={styleControls.maskVisualization}
            ariaLabel={styleControls.maskAriaLabel}
            onChange={styleControls.onMaskVisualizationChange}
            onPreview={styleControls.onMaskVisualizationPreview}
          />
        </div>
      ) : null}
    </div>
  );
}
