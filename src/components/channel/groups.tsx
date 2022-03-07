import * as React from "react";
import styled from "styled-components";
import { getWaypoints, getWaypoint } from "../../lib/waypoint";
import { UpdateGroup, PopUpdateGroup } from "../editable/groups";
import { Editor } from "../editable/common";
import { Status } from "../editable/status";

const WrapRows = styled.div`
  grid-auto-rows: auto;
  display: grid;
  gap: 0.25em;
`;

const GroupName = styled.div`
  grid-area: name;
`;

const Corner = styled.a`
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
  background-color: ${({ color }) => color};
  cursor: pointer;
  border-radius: 4px;
  padding: 0.5em;
  gap: 1em;
`;

const GroupRow = (props) => {
  const { group, stories, hash, setHash } = props;
  const { editable } = props;
  const { name } = group;

  const active = group.g === hash.g;
  const color = active ? "#007bff" : "none";

  const toGroup = setHash.bind(null, { g: group.g });

  const wrapGroupProps = { color };
  const waypoints = getWaypoints(stories, hash.s);
  const sameGroup = (wp) => wp.g === group.g;
  const w = waypoints.indexOf(waypoints.find(sameGroup));
  const toWaypoint = w < 0 ? null : () => setHash({ w, g: group.g });
  const toWaypointText = w < 0 ? "" : `@${w + 1}`;
  const { updateGroup, updateWaypoint } = props;
  const onPop = () => {
    if (hash.g >= group.g) {
      setHash({ g: Math.max(hash.g - 1, 0) });
    }
    props.popGroup({ g: group.g });
  };

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

  const waypoint = getWaypoint(stories, hash.s, hash.w);
  const selected = waypoint.g === group.g;
  const updateWaypointGroup = () => {
    const { s, w } = hash;
    toGroup();
    updateWaypoint({ ...waypoint, g: group.g }, { s, w });
  };
  const selectSwitch = [
    ["a", { onClick: toWaypoint, children: toWaypointText }],
    [UpdateGroup, { onUpdate: () => null }],
  ];
  const selectClick = props.editable ? updateWaypointGroup : toGroup;
  const coreUI = (
    <WrapGroup {...wrapGroupProps}>
      <GroupName onClick={selectClick}>
        <Status {...statusProps}>{name}</Status>
      </GroupName>
      <Corner>
        <Editor
          {...{ ...props, editable: selected, editSwitch: selectSwitch }}
        />
      </Corner>
    </WrapGroup>
  );
  const editSwitch = [
    [React.Fragment, { children: coreUI }],
    [PopUpdateGroup, { onPop, children: coreUI }],
  ];

  const canPop = props.editable && props.total > 1;
  const extraUI = <Editor {...{ ...props, editable: canPop, editSwitch }} />;

  return <>{extraUI}</>;
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
