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
  gap: 3px;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0.5em 0.35em;
  border: 1px solid
    ${({ $active }) =>
      $active
        ? "color-mix(in srgb, var(--theme-glass-edge, rgba(255, 255, 255, 0.5)) 70%, transparent)"
        : "transparent"};
  border-radius: 5px 5px 0 0;
  background: ${({ $active }) =>
    $active
      ? "color-mix(in xyz, var(--theme-dim-gray-color, black), transparent 40%)"
      : "color-mix(in xyz, var(--theme-dark-main-color, navy), transparent 60%)"};
  color: ${({ $active }) =>
    $active
      ? "var(--theme-light-focus-color, white)"
      : "color-mix(in srgb, var(--theme-light-contrast-color, white) 78%, transparent)"};
  font: inherit;
  font-size: inherit;
  line-height: 1.25;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;

  ${({ $active }) =>
    $active
      ? `
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14);
    text-shadow: 0 0 4px var(--theme-dark-focus-color, black);
  `
      : ""}

  &:hover {
    color: var(--theme-light-focus-color, white);
    background: color-mix(
      in xyz,
      var(--theme-dim-gray-color, black),
      transparent 52%
    );
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: 1px;
  }
`;

/** Author-style glass tab strip (ported from legacy minerva-author-ui nav). */
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
