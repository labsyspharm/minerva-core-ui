import * as React from "react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import type {
  Channel,
  ChannelGroup,
  WaypointLens,
} from "@/lib/stores/documentStore";
import { ChannelGroupDropdown } from "./ChannelGroupDropdown";
import styles from "./WaypointsList.module.css";

/** Minerva Story 1.x's documented `"Rad": 100`. */
const DEFAULT_RADIUS_PX = 100;
const MIN_RADIUS_PX = 40;
const MAX_RADIUS_PX = 300;

/** Waypoint detail: show another channel group inside a circle at the cursor. */
export function WaypointLensSettings(props: {
  lens: WaypointLens | undefined;
  /** The waypoint's own group; a lens on it would show nothing new. */
  baseGroupId: string | undefined;
  groups: ChannelGroup[];
  sourceChannels: Channel[];
  disabled: boolean;
  onChange: (lens: WaypointLens | undefined) => void;
}) {
  const { lens, baseGroupId, groups, sourceChannels, disabled, onChange } =
    props;
  const groupFieldId = React.useId();
  const radiusFieldId = React.useId();
  const choices = groups.filter((group) => group.id !== baseGroupId);

  // Save the radius on release, not per step, so a drag is one undo step.
  const savedRadius = lens?.radius ?? DEFAULT_RADIUS_PX;
  const [radius, setRadius] = React.useState(savedRadius);
  // Release can land in the same render as the last change; save from a ref.
  const radiusRef = React.useRef(savedRadius);
  React.useEffect(() => {
    radiusRef.current = savedRadius;
    setRadius(savedRadius);
  }, [savedRadius]);
  const saveRadius = () => {
    const next = radiusRef.current;
    if (lens && next !== lens.radius) onChange({ ...lens, radius: next });
  };

  return (
    <section
      className={`${minervaTheme.surface} ${styles.detailTitleFieldWrap}`}
      aria-label="Lens"
    >
      <label className={styles.lensHeader}>
        <span className={styles.detailTitleLabel}>Lens</span>
        <input
          type="checkbox"
          checked={lens != null}
          disabled={disabled || (lens == null && choices.length === 0)}
          onChange={() =>
            onChange(
              lens
                ? undefined
                : { groupId: choices[0].id, radius: DEFAULT_RADIUS_PX },
            )
          }
        />
      </label>
      {lens ? (
        <>
          <label className={styles.lensFieldLabel} htmlFor={groupFieldId}>
            Group in the lens
          </label>
          <ChannelGroupDropdown
            id={groupFieldId}
            groups={choices}
            sourceChannels={sourceChannels}
            selectedId={lens.groupId}
            onSelect={(groupId) => onChange({ ...lens, groupId })}
            disabled={disabled}
            ariaLabel="Lens channel group"
          />
          <label className={styles.lensFieldLabel} htmlFor={radiusFieldId}>
            Size
          </label>
          <span className={styles.lensRadiusRow}>
            <input
              id={radiusFieldId}
              type="range"
              className={styles.lensRadiusSlider}
              min={MIN_RADIUS_PX}
              max={Math.max(MAX_RADIUS_PX, savedRadius)}
              step={5}
              value={radius}
              disabled={disabled}
              onChange={(event) => {
                radiusRef.current = Number(event.target.value);
                setRadius(radiusRef.current);
              }}
              onPointerUp={saveRadius}
              onKeyUp={saveRadius}
              onBlur={saveRadius}
            />
            <span className={styles.lensRadiusValue}>{radius} px</span>
          </span>
        </>
      ) : null}
      {choices.length === 0 ? (
        <p className={styles.lensHint}>Needs two channel groups.</p>
      ) : null}
    </section>
  );
}
