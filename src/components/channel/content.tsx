import * as React from "react";
import { Groups } from "./groups";
import { Header } from "../common/header";
import styled from "styled-components";
import styles from "./content.module.css";
import { PushGroup } from "../editable/groups";
import { Editor } from "../editable/common";
import { defaultChannels } from "./legend";

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
    <div className={styles.wrap}>
      <div className={styles.nav}>{children}</div>
      <div className={styles.core}>
        {polyGroups}
        {soloGroups}
      </div>
    </div>
  );
};

export { Content };
