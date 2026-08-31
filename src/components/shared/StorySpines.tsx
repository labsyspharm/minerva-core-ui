import styles from "./StorySpines.module.css";

const SPINE_HEIGHTS = [0.72, 1, 0.86] as const;

function clothIndex(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 6;
}

/** Tiny cloth-spine cluster — same motif as the library shelf. */
export function StorySpines({ seed }: { seed: string }) {
  const start = clothIndex(seed || "story");
  return (
    <span className={styles.volume} aria-hidden>
      {SPINE_HEIGHTS.map((frac, i) => (
        <span
          key={frac}
          className={styles.spine}
          style={{
            height: `${frac * 100}%`,
            background: `var(--cloth-${((start + i) % 6) + 1})`,
          }}
        />
      ))}
    </span>
  );
}
