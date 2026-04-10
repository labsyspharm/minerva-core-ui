import * as React from "react";
import styled from "styled-components";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import { useAppStore } from "@/lib/stores/appStore";
import { useDocumentGroups } from "@/lib/stores/documentStore";

const WrapRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const activeHeaderStyles = `
  box-sizing: border-box;
  width: 100%;
  border-radius: 5px;
  padding: 5px 7px;
  line-height: 1.25;
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-light-contrast-color);
  border: 1px solid color-mix(in srgb, var(--theme-glass-edge) 65%, transparent);
  background: color-mix(in srgb, var(--theme-dark-main-color) 35%, transparent);
`;

const ActiveGroupStatic = styled.div`
  ${activeHeaderStyles}
  cursor: default;
`;

const ActiveGroupTrigger = styled.button`
  all: unset;
  ${activeHeaderStyles}
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  cursor: pointer;
  text-align: left;

  &:hover {
    border-color: color-mix(in srgb, var(--theme-glass-edge) 90%, transparent);
    background: color-mix(in srgb, var(--theme-dark-main-color) 28%, transparent);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-light-focus-color) 75%, transparent);
    outline-offset: 1px;
  }
`;

const ChevronWrap = styled.span<{ expanded: boolean }>`
  display: flex;
  flex-shrink: 0;
  line-height: 0;
  opacity: 0.72;
  transition: transform 0.18s ease;
  transform: rotate(${({ expanded }) => (expanded ? "180deg" : "0deg")});
`;

const ChevronIcon = styled(ChevronDownIcon)`
  width: 12px;
  height: 12px;
`;

const AlternateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 1px;
  padding: 3px;
  border-radius: 5px;
  background: color-mix(in srgb, black 28%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-glass-edge) 40%, transparent);
`;

const GroupAltRow = styled.button`
  all: unset;
  box-sizing: border-box;
  width: 100%;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.3;
  padding: 4px 6px;
  border-radius: 3px;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 88%, transparent);
  text-align: left;

  &:hover {
    background: color-mix(in srgb, white 8%, transparent);
    color: var(--theme-light-contrast-color);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-light-focus-color) 65%, transparent);
    outline-offset: 0;
  }
`;

const GroupRow = (props: { group: { name: string; id: string } }) => {
  const { group } = props;
  const { name } = group;

  const { setActiveChannelGroup } = useAppStore();
  const Groups = useDocumentGroups();
  const row_group = React.useMemo(
    () => Groups.find((grp) => grp.name === name) || Groups[0],
    [Groups, name],
  );

  const toGroup = () => {
    if (row_group) {
      setActiveChannelGroup(row_group.id);
    }
  };

  return (
    <GroupAltRow type="button" onClick={toGroup}>
      {name}
    </GroupAltRow>
  );
};

export const ChannelGroups = (props: {
  groups: { id: string; name: string }[];
}) => {
  const { groups } = props;
  const [expanded, setExpanded] = React.useState(false);

  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const Groups = useDocumentGroups();
  const activeGroup = React.useMemo(
    () => Groups.find(({ id }) => id === activeChannelGroupId) || Groups[0],
    [Groups, activeChannelGroupId],
  );

  const prevGroupId = React.useRef(activeChannelGroupId);
  React.useEffect(() => {
    if (prevGroupId.current !== activeChannelGroupId) {
      prevGroupId.current = activeChannelGroupId;
      setExpanded(false);
    }
  });

  const activeGroupName = activeGroup?.name || "No group";

  if (groups.length <= 1) {
    return (
      <WrapRows>
        <ActiveGroupStatic title={activeGroupName}>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeGroupName}
          </span>
        </ActiveGroupStatic>
      </WrapRows>
    );
  }

  const otherGroups = expanded
    ? groups.filter((g) => g.id !== activeGroup?.id)
    : [];

  return (
    <WrapRows>
      <ActiveGroupTrigger
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {activeGroupName}
        </span>
        <ChevronWrap expanded={expanded} aria-hidden>
          <ChevronIcon />
        </ChevronWrap>
      </ActiveGroupTrigger>
      {otherGroups.length > 0 ? (
        <AlternateList>
          {otherGroups.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </AlternateList>
      ) : null}
    </WrapRows>
  );
};
