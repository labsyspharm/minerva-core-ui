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

const GroupRow = (props) => {
  const { group } = props;
  const { name } = group;

  const { setActiveChannelGroup, activeChannelGroupId, Groups } =
    useOverlayStore();
  const active_group = React.useMemo(
    () => Groups.find(({ UUID }) => UUID === activeChannelGroupId) || Groups[0],
    [Groups, activeChannelGroupId],
  );
  const row_group = React.useMemo(
    () => Groups.find(({ Name }) => Name === name) || Groups[0],
    [Groups, name],
  );

  const active = active_group.UUID === row_group.UUID;
  const outline = active ? "var(--theme-glass-edge)" : "none";
  const color = active ? "var(--theme-dark-main-color)" : "none";

  const toGroup = () => {
    if (row_group) {
      setActiveChannelGroup(row_group.UUID);
    }
  };

  const ref = React.useRef(null);
  const nameProps = { color, outline, ref };
  const { updateGroup } = props;

  React.useEffect(() => {
    if (active && ref.current !== null) {
      window.requestAnimationFrame(() => {
        ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, [active]);

  const setInput = (t) => {
    props.updateGroup({ ...group, name: t }, { g: group.g });
  };
  const uuid = `group/name/${group.g}`;
  const _statusProps = {
    ...props,
    md: false,
    setInput,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  const coreUI = (
    <GroupName {...nameProps} onClick={toGroup}>
      {name}
    </GroupName>
  );
  return <>{coreUI}</>;
};

export const ChannelGroups = (props) => {
  const { groups } = props;
  const rows = groups.map((group, k) => {
    const groupProps = { ...props, group };
    return <GroupRow key={k} {...groupProps} />;
  });
  return <WrapRows>{rows}</WrapRows>;
};
