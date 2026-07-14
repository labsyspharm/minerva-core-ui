import styled from "styled-components";

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

const List = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: stretch;
  gap: 0;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0.65em 0.5em 0.55em;
  border: none;
  border-bottom: 2px solid
    ${({ $active }) =>
      $active ? "var(--panel-accent, #58a6ff)" : "transparent"};
  border-radius: 0;
  background: transparent;
  color: ${({ $active }) =>
    $active
      ? "var(--theme-light-focus-color, #fff)"
      : "color-mix(in srgb, var(--theme-light-contrast-color, white) 62%, transparent)"};
  font: inherit;
  font-size: inherit;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  letter-spacing: 0.01em;
  line-height: 1.2;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    color: var(--theme-light-focus-color, #fff);
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: -2px;
  }
`;

/** Compact underline tab strip for authoring sidebar panels. */
export function GlassTabBar<T extends string>(props: GlassTabBarProps<T>) {
  const { tabs, value, onChange, className, "aria-label": ariaLabel } = props;

  return (
    <List role="tablist" aria-label={ariaLabel} className={className}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <Tab
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            $active={active}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </Tab>
        );
      })}
    </List>
  );
}
