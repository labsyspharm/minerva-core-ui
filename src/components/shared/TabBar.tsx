import minervaTheme from "@/components/shared/minervaTheme.module.css";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
};

export type TabBarProps<T extends string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  "aria-label"?: string;
  className?: string;
};

/** Underline tab strip for authoring sidebar panels. */
export function TabBar<T extends string>(props: TabBarProps<T>) {
  const { tabs, value, onChange, className, "aria-label": ariaLabel } = props;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[minervaTheme.tabList, className].filter(Boolean).join(" ")}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={[
              minervaTheme.tab,
              active ? minervaTheme.tabActive : null,
            ]
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
