import styles from "./StorySpines.module.css";

const SPINE_HEIGHTS = [0.72, 1, 0.86] as const;

/** Tiny cloth-spine cluster — same motif as the library shelf. */
export function StorySpines() {
  return (
    <span className={styles.volume} aria-hidden>
      {SPINE_HEIGHTS.map((frac, i) => (
        <span
          key={frac}
          className={styles.spine}
          style={{
            height: `${frac * 100}%`,
            background: `var(--cloth-${4 + i})`,
          }}
        />
      ))}
    </span>
  );
}
