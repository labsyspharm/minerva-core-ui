import styles from "./GlassTabBar.module.css";

export type GlassTabItem<T extends string = string> = {
  id: T;
  label: string;
};

export type GlassTabBarProps<T extends string> = {
  tabs: readonly GlassTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  "aria-label"?: string;
  className?: string;
};

/** Compact underline tab strip for authoring sidebar panels. */
export function GlassTabBar<T extends string>(props: GlassTabBarProps<T>) {
  const { tabs, value, onChange, className, "aria-label": ariaLabel } = props;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[styles.list, className].filter(Boolean).join(" ")}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={[styles.tab, active ? styles.tabActive : null]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
