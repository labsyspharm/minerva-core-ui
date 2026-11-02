import { createPortal } from "react-dom";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { useAnchoredMenu } from "@/components/shared/useAnchoredMenu";
import { CONTOUR_LEVELS_MAX } from "@/lib/imaging/contourExtension";
import { refitGroupContrast } from "@/lib/imaging/gmmScheduler";
import { useAppStore } from "@/lib/stores/appStore";
import styles from "./ChannelRow.module.css";

/** Row ⋮ actions a caller opts into; contours follow the row's contrast editor. */
export type ChannelRowMore = {
  /** Offers "Fit contrast" for this source channel. */
  fitContrastId?: string;
  onRemoveFromGroup?: () => void;
};

export function ChannelRowMoreMenu(
  props: ChannelRowMore & {
    channelName: string;
    fitBusy?: boolean;
    /** Offers "Show as contour lines" for this source channel. */
    contourChannelId?: string;
  },
) {
  const {
    fitContrastId,
    onRemoveFromGroup,
    channelName,
    fitBusy,
    contourChannelId,
  } = props;
  const contourOn = useAppStore((s) =>
    contourChannelId ? Boolean(s.contourChannelIds[contourChannelId]) : false,
  );
  const menu = useAnchoredMenu({ align: "end", estimateHeight: 140 });
  if (!fitContrastId && !onRemoveFromGroup && !contourChannelId) return null;
  return (
    <div ref={menu.wrapRef}>
      <button
        type="button"
        className={`${styles.channelActionButton}${contourOn ? ` ${styles.channelActionButtonOn}` : ""}`}
        title={contourOn ? "Drawn as contour lines" : undefined}
        aria-label={`More actions for ${channelName}${contourOn ? " (contour lines on)" : ""}`}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          menu.toggleFromButton(e.currentTarget);
        }}
      >
        ⋮
      </button>
      {menu.open
        ? createPortal(
            <div
              ref={menu.menuRef}
              className={minervaTheme.menuFixed}
              role="menu"
              data-channel-row-menu
              style={menu.menuStyle}
            >
              {fitContrastId ? (
                <button
                  type="button"
                  role="menuitem"
                  className={minervaTheme.menuItem}
                  disabled={fitBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    menu.close();
                    useAppStore.getState().clearChannelRendering();
                    void refitGroupContrast(fitContrastId);
                  }}
                >
                  {fitBusy ? "Fitting contrast…" : "Fit contrast"}
                </button>
              ) : null}
              {contourChannelId ? (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={contourOn}
                  className={`${minervaTheme.menuItem} ${styles.menuCheckItem}`}
                  title="Draw this channel as isolines across its contrast range instead of a color fill"
                  onClick={(e) => {
                    // Stays open so the line count can be set right away.
                    e.stopPropagation();
                    useAppStore
                      .getState()
                      .toggleContourChannel(contourChannelId);
                  }}
                >
                  Show as contour lines
                  <span className={styles.menuCheck} aria-hidden>
                    {contourOn ? "✓" : ""}
                  </span>
                </button>
              ) : null}
              {contourOn ? <ContourControls /> : null}
              {onRemoveFromGroup ? (
                <button
                  type="button"
                  role="menuitem"
                  className={minervaTheme.menuItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    menu.close();
                    onRemoveFromGroup();
                  }}
                >
                  Remove from group
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const CONTOUR_LEVEL_STEPS = Array.from(
  { length: CONTOUR_LEVELS_MAX },
  (_, i) => i + 1,
);

/** ⋮ menu rows for contour settings, shown while contours are on. */
function ContourControls() {
  const levels = useAppStore((s) => s.contourLevels);
  const setContourLevels = useAppStore((s) => s.setContourLevels);
  const smoothing = useAppStore((s) => s.contourSmoothing);
  const setContourSmoothing = useAppStore((s) => s.setContourSmoothing);
  const smoothingSteps = useAppStore((s) => s.contourSmoothingSteps);
  return (
    <>
      <MenuStepper
        label="Lines"
        title="Lines across the contrast range (shared by all contoured channels)"
        decrease="Fewer contour lines"
        increase="More contour lines"
        steps={CONTOUR_LEVEL_STEPS}
        value={levels}
        onChange={setContourLevels}
      />
      <MenuStepper
        label="Smoothing"
        title="Smoothing radius in full-resolution pixels (shared by all contoured channels)"
        decrease="Less contour smoothing"
        increase="More contour smoothing"
        steps={smoothingSteps}
        value={smoothing}
        unit="px"
        onChange={setContourSmoothing}
      />
    </>
  );
}

/** − value + row that steps through `steps`. */
function MenuStepper(props: {
  label: string;
  title: string;
  decrease: string;
  increase: string;
  steps: readonly number[];
  value: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const { steps } = props;
  const at = Math.max(0, steps.indexOf(props.value));
  const step = (delta: number) =>
    props.onChange(steps[Math.min(steps.length - 1, Math.max(0, at + delta))]);
  return (
    <div className={styles.contourLevel} title={props.title}>
      <span>{props.label}</span>
      <span className={styles.contourStepper}>
        <button
          type="button"
          className={minervaTheme.focusRing}
          aria-label={props.decrease}
          disabled={at <= 0}
          onClick={() => step(-1)}
        >
          −
        </button>
        <output aria-live="polite">
          {props.unit ? `${props.value} ${props.unit}` : props.value}
        </output>
        <button
          type="button"
          className={minervaTheme.focusRing}
          aria-label={props.increase}
          disabled={at >= steps.length - 1}
          onClick={() => step(1)}
        >
          +
        </button>
      </span>
    </div>
  );
}
