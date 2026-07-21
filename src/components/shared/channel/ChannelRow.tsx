import type { MouseEventHandler } from "react";
import {
  ChannelColorSwatchButton,
  ChannelVisibilitySwatch,
} from "@/components/shared/channel/ChannelVisibilitySwatch";
import type { MaskVisualization } from "@/lib/imaging/channelKind";
import styles from "./channelShared.module.css";

export function rgbToHex(color: {
  r?: number;
  g?: number;
  b?: number;
}): string {
  return [color.r ?? 0, color.g ?? 0, color.b ?? 0]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

export function MaskVisualizationToggle(props: {
  value: MaskVisualization;
  onChange: (viz: MaskVisualization) => void;
  ariaLabel: string;
}) {
  const { value, onChange, ariaLabel } = props;
  return (
    <fieldset className={styles.maskVizToggle} aria-label={ariaLabel}>
      <button
        type="button"
        className={
          value === "outline"
            ? `${styles.maskVizOption} ${styles.maskVizOptionActive}`
            : styles.maskVizOption
        }
        aria-pressed={value === "outline"}
        onClick={() => onChange("outline")}
      >
        Outlines
      </button>
      <button
        type="button"
        className={
          value === "randomColors"
            ? `${styles.maskVizOption} ${styles.maskVizOptionActive}`
            : styles.maskVizOption
        }
        aria-pressed={value === "randomColors"}
        onClick={() => onChange("randomColors")}
      >
        Colors
      </button>
    </fieldset>
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
  onToggleVisibility: () => void;
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
  return (
    <input
      className={`${styles.detailTitleInput} ${styles.channelNameInput}`}
      type="text"
      defaultValue={props.name}
      maxLength={200}
      autoComplete="off"
      spellCheck={false}
      aria-label={`Channel name (${props.meta})`}
      onBlur={(e) => props.onBlur(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
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
    compact = false,
    trailing,
  } = props;

  const showTextStack = name.mode === "editable";
  const styleControls = channelRowHasStyleControls(props) ? props : null;

  return (
    <div className={rowClassName}>
      <ChannelVisibilitySwatch
        visible={visible}
        title={visibilityTitle}
        ariaLabel={visibilityAriaLabel}
        onClick={onToggleVisibility}
      />
      {showTextStack ? (
        <div className={styles.channelTextStack}>
          <ChannelRowName {...name} />
          {imageSubtitle ? (
            <span
              className={styles.channelImageSubtitle}
              title={`From ${imageSubtitle}`}
            >
              {imageSubtitle}
            </span>
          ) : null}
        </div>
      ) : (
        <ChannelRowName {...name} />
      )}
      {styleControls?.isMask && styleControls.fixedColorHex ? (
        <span
          className={styles.channelColorSwatch}
          style={{ backgroundColor: `#${styleControls.fixedColorHex}` }}
          aria-hidden
        />
      ) : null}
      {styleControls ? (
        styleControls.isMask ? (
          <MaskVisualizationToggle
            value={styleControls.maskVisualization}
            ariaLabel={styleControls.maskAriaLabel}
            onChange={styleControls.onMaskVisualizationChange}
          />
        ) : isIntensityRowStyle(styleControls) ? (
          <ChannelColorSwatchButton
            hex={styleControls.colorHex}
            title={styleControls.colorTitle}
            ariaLabel={styleControls.colorAriaLabel}
            onClick={styleControls.onColorClick}
          />
        ) : null
      ) : null}
      {trailing}
    </div>
  );
}
