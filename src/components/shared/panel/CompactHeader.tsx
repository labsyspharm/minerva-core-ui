import type { ReactNode } from "react";
import styles from "./CompactHeader.module.css";

export type CompactHeaderProps = {
  title?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Shared list header for the Images / Channels / Story panels. */
export function CompactHeader({
  title,
  count,
  actions,
  className,
}: CompactHeaderProps) {
  const showTitle = title != null && title !== "";
  return (
    <div
      className={[styles.compactHeader, className].filter(Boolean).join(" ")}
    >
      {showTitle ? (
        <div className={styles.headerTitle}>
          <span>{title}</span>
          {count != null ? (
            <span className={styles.headerCount}>{count}</span>
          ) : null}
        </div>
      ) : null}
      {actions != null ? (
        <div className={styles.headerActions}>{actions}</div>
      ) : null}
    </div>
  );
}
