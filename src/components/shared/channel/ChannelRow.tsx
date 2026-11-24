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

type ChannelRowNameProps = {
  mode: "editable";
  name: string;
  meta: string;
  onBlur: (value: string) => void;
};

type ChannelRowProps = {
  /** Fills the color swatch (the row has no eye: its chip is that). */
  visible: boolean;
  name: ChannelRowNameProps;
  contrast?: ChannelContrastEditorProps;
  trailing?: ReactNode;
  isMask?: boolean;
  maskVisualization?: MaskVisualization;
  onMaskVisualizationChange?: (viz: MaskVisualization) => void;
  maskFooter?: ReactNode;
  maskAction?: ReactNode;
  maskAriaLabel?: string;
  colorHex?: string;
  colorTitle?: string;
  busy?: boolean;
  fitting?: boolean;
  /**
   * `inline` (Images tab, opened from a chip): a narrow editable name, a
   * larger swatch, quiet limits, a taller plot and `trailing` at the end.
   * `compact`: the same, no taller than a chip (a group's channel lines).
   */
  look?: "inline" | "compact";
  /** Shown in place of the name (e.g. the channel's chip), in a wider slot. */
  label?: ReactNode;
  onColorClick?: MouseEventHandler<HTMLButtonElement>;
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
    name,
    contrast,
    trailing,
    isMask,
    maskVisualization,
    onMaskVisualizationChange,
    maskFooter,
    maskAction,
    maskAriaLabel,
    colorHex,
    colorTitle,
    busy,
    fitting,
    onColorClick,
  } = props;

  const showMask = isMask && maskVisualization;
  const showColor = !isMask && onColorClick;

  return (
    <div
      className={[
        styles.channelRow,
        props.look ? styles.lookInline : null,
        props.look === "compact" ? styles.lookCompact : null,
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
        <div
          className={`${styles.channelRowTitle}${
            props.label ? ` ${styles.labelSlot}` : ""
          }`}
        >
          <div className={styles.channelNameSlot}>
            {props.label ?? <EditableChannelRowName {...name} />}
          </div>
        </div>
        <div className={styles.channelRowMid}>
          {contrast ? (
            <ChannelContrastEditor {...contrast} look={props.look} />
          ) : null}
          {showMask && onMaskVisualizationChange ? (
            <MaskModeControls
              value={maskVisualization}
              ariaLabel={maskAriaLabel ?? name.name}
              classColors={maskFooter != null}
              onChange={onMaskVisualizationChange}
            />
          ) : null}
        </div>
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
        <div className={styles.channelRowTrailing}>{trailing}</div>
        {showMask ? maskAction : null}
      </div>
      {showMask && maskFooter ? (
        <div className={styles.maskControlsPanel}>{maskFooter}</div>
      ) : null}
    </div>
  );
}
