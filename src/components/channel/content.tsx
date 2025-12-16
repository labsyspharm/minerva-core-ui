import * as React from "react";
import { Groups } from "./groups";
import { Header } from "../common/header";
import styled from "styled-components";
import { PushGroup } from "../editable/groups";
import { Editor } from "../editable/common";
import { defaultChannels } from "./legend";

const WrapContent = styled.div`
  height: 100%;
  display: grid;
  pointer-events: none;
  grid-template-rows: auto auto 1fr;
  grid-template-columns: 150px auto 100%;
  transform: translate(-150px);
`;

const WrapCore = styled.div`
  padding: 1em;
  grid-column: 3;
  grid-row: 1 / 3;
  overflow: scroll;
  pointer-events: all;
  word-wrap: break-word;
  outline: 1px solid var(--theme-glass-edge);
  background-color: var(--dark-glass);
  border-radius: var(--radius-0001);
`;

const WrapNav = styled.div`
  grid-row: 1;
  grid-column: 1;
  padding: 0.8em;
  font-size: 16px;
  pointer-events: all;
  padding-top: calc(1.5*var(--theme-gap-tiny));
  outline: 1px solid var(--theme-glass-edge);
  background-color: var(--dark-glass);
  border-radius: var(--radius-0001);
`;

const WrapColumns = styled.div`
  grid-template-columns: auto 1fr;
  display: grid;
  gap: 0.25em;
`;

const splitGroups = (groups) => {
  return groups.reduce(
    (out, group) => {
      const { channels } = group;
      if (channels.length <= 1) {
        return { ...out, solo: out.solo.concat([group]) };
      }
      return { ...out, poly: out.poly.concat([group]) };
    },
    { poly: [], solo: [] }
  );
};

const Content = (props) => {
  const { children, groups, stories } = props;
  const { pushGroup } = props;
  const { hash, setHash } = props;
  const { editable } = props;

  const { poly, solo } = splitGroups(groups);
  const total = groups.length;
  const groupProps = { ...props, total, editable, hash, setHash, stories };

  const pushFunction = (numChannels) => {
    const channels = defaultChannels.slice(0, numChannels);
    return () => {
      const newG = groups.length;
      pushGroup({
        g: newG,
        path: "TODO",
        name: `Group ${groups.length}`,
        channels: channels,
      });
      setHash({ g: newG });
    };
  };
  const extraUI = (numChannels) => {
    const onPush = pushFunction(numChannels);
    const editSwitch = [
      ["span", {}],
      [PushGroup, { onPush }],
    ];
    return <Editor {...{ ...props, editSwitch }} />;
  };

  const polyGroups =
    poly.length || props.editable ? (
      <>
        <Header>
          <WrapColumns>
            {extraUI(3)}
            <span>Channel Groups:</span>
          </WrapColumns>
        </Header>
        <Groups {...{ ...groupProps, groups: poly }} />
      </>
    ) : null;

  const soloGroups =
    solo.length || props.editable ? (
      <>
        <Header>
          <WrapColumns>
            {extraUI(1)}
            <span>Channels:</span>
          </WrapColumns>
        </Header>
        <Groups {...{ ...groupProps, groups: solo }} />
      </>
    ) : null;

  return (
    <WrapContent> 
      <WrapNav> 
        {children}
      </WrapNav> 
      <WrapCore>
        {polyGroups}
        {soloGroups}
      </WrapCore>
    </WrapContent> 
  );
};

export { Content };
