import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./CompactHeader.module.css";

type StripSlot = {
  node: HTMLElement | null;
  setNode: (el: HTMLElement | null) => void;
};

const SidebarStripSlotContext = createContext<StripSlot | null>(null);

/** Lets Images / Channels / Story actions sit on the tab strip. */
export function SidebarStripSlotProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ node, setNode }), [node]);
  return (
    <SidebarStripSlotContext.Provider value={value}>
      {children}
    </SidebarStripSlotContext.Provider>
  );
}

export function SidebarStripSlot({ className }: { className?: string }) {
  const slot = useContext(SidebarStripSlotContext);
  return <div ref={slot?.setNode} className={className} />;
}

export type CompactHeaderProps = {
  title?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** List heading (Layers), or icon actions on the sidebar tab strip. */
export function CompactHeader({
  title,
  count,
  actions,
  className,
}: CompactHeaderProps) {
  const showTitle = title != null && title !== "";
  const slot = useContext(SidebarStripSlotContext);
  const actionsNode =
    actions == null ? null : (
      <div className={styles.headerActions}>{actions}</div>
    );

  // Untitled headers in the sidebar portal onto the tab strip. Titled
  // headers (Layers) stay in-panel even under the same provider.
  if (!showTitle) {
    if (actionsNode == null) return null;
    if (slot) return slot.node ? createPortal(actionsNode, slot.node) : null;
  }

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
      {actionsNode}
    </div>
  );
}
