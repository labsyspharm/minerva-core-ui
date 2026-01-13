import * as React from "react";
import styled from "styled-components";
import { useOverlayStore } from "../../lib/stores";

const WrapRows = styled.div`
  grid-auto-rows: auto;
  display: grid;
  gap: 0.25em;
`;

const GroupName = styled.div`
  grid-area: name;
`;

const Corner = styled.div`
  grid-area: waypoint;
  text-decoration: underline;
`;

const WrapGroup = styled.div`
  display: grid;
  grid-template-areas:
    "name ."
    "name waypoint";
  grid-template-columns: 80% auto;
  grid-template-rows: auto auto;
  outline: 1px solid ${({ outline }) => outline};
  background-color: ${({ color }) => color};
  cursor: pointer;
  border-radius: 4px;
  padding: 0.5em;
  gap: 1em;
`;

const GroupRow = (props) => {
  const { group, stories } = props;
  const { editable } = props;
  const { name } = group;

  const { Groups } = props.config.ItemRegistry;
  const {
    setActiveChannelGroup, activeChannelGroupId
  } = useOverlayStore();
  const active_group = React.useMemo(
    () => (
      Groups.find(
        ({ UUID }) => UUID === activeChannelGroupId 
      ) || Groups[0]
    ),
    [Groups, activeChannelGroupId]
  )
  const row_group = React.useMemo(
    () => (
      Groups.find(
        ({ Properties }) => Properties?.Name === name 
      ) || Groups[0]
    ),
    [Groups]
  )

  const active = active_group.UUID === row_group.UUID;
  const outline = active ? "var(--theme-glass-edge)" : "none";
  const color = active ? "var(--theme-dark-main-color)" : "none";

  const toGroup = () => {
    if (row_group) {
      setActiveChannelGroup(row_group.UUID);
    }
  }

  const ref = React.useRef(null);
  const wrapGroupProps = { color, outline, ref };
  const { updateGroup } = props;

  React.useEffect(() => {
    if (active && ref.current !== null) {
      window.requestAnimationFrame(() => {
        ref.current.scrollIntoView({behavior: "smooth", block: "nearest"});
      });
    }
  }, [active]);

  const setInput = (t) => {
    props.updateGroup({ ...group, name: t }, { g: group.g });
  };
  const uuid = `group/name/${group.g}`;
  const statusProps = {
    ...props,
    md: false,
    setInput,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  const coreUI = (
    <WrapGroup {...wrapGroupProps}>
      <GroupName onClick={toGroup}>
        {name}
      </GroupName>
    </WrapGroup>
  );
  return <>{coreUI}</>;
};

const Groups = (props) => {
  const { groups } = props;
  const rows = groups.map((group, k) => {
    const groupProps = { ...props, group };
    return <GroupRow key={k} {...groupProps} />;
  });
  return <WrapRows>{rows}</WrapRows>;
};

export { Groups };
