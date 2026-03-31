import * as React from "react";
import styled from "styled-components";
import { useOverlayStore } from "@/lib/stores";

const WrapRows = styled.div`
  grid-auto-rows: auto;
  display: grid;
  gap: 0.25em;
`;

const GroupName = styled.div`
  outline: 1px solid ${({ outline }) => outline};
  background-color: ${({ color }) => color};
  cursor: pointer;
  border-radius: 2px;
  margin-bottom: 0.15em;
  padding: 2px 2px 2px 21px;
  text-indent: -1em;
  line-height: 1.2em;

  :hover {
    text-decoration: underline;
  }
`;

const ActiveGroupName = styled.div`
  cursor: pointer;
  border-radius: 2px;
  padding: 4px 8px;
  line-height: 1.2em;
  margin-bottom: 0.5em;
  outline: 1px solid var(--theme-glass-edge);
  background-color: var(--theme-dark-main-color);
  display: flex;
  align-items: center;
  justify-content: space-between;

  :hover {
    text-decoration: underline;
  }
`;

const Arrow = styled.span`
  font-size: 0.7em;
  margin-right: 4px;
  transition: transform 0.2s ease;
  transform: rotate(${({ expanded }) => (expanded ? "180deg" : "0deg")});
`;

const GroupRow = (props) => {
  const { group } = props;
  const { name } = group;

  const { setActiveChannelGroup, activeChannelGroupId, Groups } =
    useOverlayStore();
  const row_group = React.useMemo(
    () => Groups.find(({ Name }) => Name === name) || Groups[0],
    [Groups, name],
  );

  const toGroup = () => {
    if (row_group) {
      setActiveChannelGroup(row_group.UUID);
    }
  };

  const nameProps = { color: "none", outline: "none" };

  return (
    <GroupName {...nameProps} onClick={toGroup}>
      {name}
    </GroupName>
  );
};

export const ChannelGroups = (props) => {
  const { groups } = props;
  const [expanded, setExpanded] = React.useState(false);

  const { activeChannelGroupId, Groups } = useOverlayStore();
  const activeGroup = React.useMemo(
    () => Groups.find(({ UUID }) => UUID === activeChannelGroupId) || Groups[0],
    [Groups, activeChannelGroupId],
  );

  // Collapse dropdown when active group changes (e.g. waypoint navigation)
  const prevGroupId = React.useRef(activeChannelGroupId);
  React.useEffect(() => {
    if (prevGroupId.current !== activeChannelGroupId) {
      prevGroupId.current = activeChannelGroupId;
      setExpanded(false);
    }
  });

  const activeGroupName = activeGroup?.Name || "No group";

  // Only one group — just show the name, no dropdown
  if (groups.length <= 1) {
    return (
      <WrapRows>
        <ActiveGroupName>
          <span>{activeGroupName}</span>
        </ActiveGroupName>
      </WrapRows>
    );
  }

  const otherGroups = expanded
    ? groups.filter((g) => g.UUID !== activeGroup?.UUID)
    : [];

  return (
    <WrapRows>
      <ActiveGroupName onClick={() => setExpanded(!expanded)}>
        <span>{activeGroupName}</span>
        <Arrow expanded={expanded}>▼</Arrow>
      </ActiveGroupName>
      {otherGroups.map((group) => {
        const groupProps = { ...props, group };
        return <GroupRow key={group.name} {...groupProps} />;
      })}
    </WrapRows>
  );
};
