import * as React from "react";
import styled from "styled-components";
import { useHash, useSetHash } from "../../lib/hashUtil";
import { getWaypoints } from "../../lib/waypoint";

const WrapRows = styled.div`
  grid-auto-rows: auto;
  display: grid;
  gap: 0.25em;
`;

const GroupName = styled.div`
  grid-area: name;
`;

const ToWaypoint = styled.a`
  grid-area: waypoint;
  text-decoration: underline;
`;

const WrapGroup = styled.div`
  display: grid;
  grid-template-areas:
    "name ."
    "name waypoint";
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  background-color: ${({ color }) => color};
  cursor: pointer;
  border-radius: 4px;
  padding: 0.5em;
`;

const GroupRow = ({ group, stories }) => {
  const { name, g } = group;
  const hash = useHash();

  const active = hash.g === g;
  const color = active ? "#007bff" : "none";

  const setHash = useSetHash();
  const toGroup = setHash.bind(null, { g });

  const wrapGroupProps = { color };
  const waypoints = getWaypoints(stories, hash.s);
  const sameGroup = (wp) => wp.g === g;
  const w = waypoints.indexOf(waypoints.find(sameGroup));
  const toWaypoint = w < 0 ? null : () => setHash({ w, g });
  const toWaypointText = w < 0 ? "" : `WP #${w + 1}`;

  return (
    <>
      <WrapGroup {...wrapGroupProps}>
        <GroupName onClick={toGroup}>{name}</GroupName>
        <ToWaypoint onClick={toWaypoint}>{toWaypointText}</ToWaypoint>
      </WrapGroup>
    </>
  );
};

const Groups = (props) => {
  const { groups, stories } = props;
  const rows = groups.map((group, k) => {
    return <GroupRow key={k} {...{ group, stories }} />;
  });
  return <WrapRows>{rows}</WrapRows>;
};

export { Groups };
