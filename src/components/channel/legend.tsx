import * as React from "react";
import styled from "styled-components";
import { PushChannel, PopUpdateChannel } from "../editable/channels";
import { Editor } from "../editable/common";
import { Status } from "../editable/status";
import {GithubPicker} from "react-color";

const RightAlign = styled.div`
  justify-items: right;
  display: grid;
`;

const WrapRows = styled.div`
  grid-auto-rows: auto;
  display: grid;
  gap: 0.25em;
`;

const WrapBox = styled.div`
  grid-template-columns: auto 1fr;
  justify-items: left;
  display: grid;
  gap: 0.25em;
`;

const Box = styled.div`
  background-color: #${({ color }) => color};
  height: 1em;
  width: 1em;
`;

const LegendRow = (props) => {
  const {channel} = props
  const channelName = channel.name;
  const [picking, setPicking] = React.useState(false);
  const { idx, name, path, g } = props;
	const setInput = (t) => {
    props.updateChannel({...channel, name: t}, {idx, g});
  }
  const onPop = () => {
    props.popChannel({g, idx});
  }

	const uuid = `group/channel/name/${idx}`;
	const statusProps = {
		...props,
		md: false,
		setInput,
		updateCache: () => null,
		cache: new Map(),
		uuid
  }

  const pickColor = () => setPicking(true)
  const picked = `#${props.channel.color}`;
  const updateColor = ({hex}) => {
    props.updateChannel({...channel, color: hex.slice(1)}, {idx, g});
    setPicking(false);
  }
  const coreUI = picking ? (
    <GithubPicker color={picked} onChangeComplete={updateColor}/>
  ) : (
    <WrapBox>
      <Box {...{...props.channel, onClick: pickColor}} />
      <Status {...statusProps}>{channelName}</Status>
    </WrapBox>
  );
  const editSwitch = [
    ["div", {children: coreUI}],
    [PopUpdateChannel, {children: coreUI, onPop}]
  ]
  const canPop = props.editable && props.total > 1; 
  const extraUI = <Editor {...{...props, editable: canPop, editSwitch}}/>

  return (
    <>{extraUI}</>
  );
};

const Legend = (props) => {
  const {g, pushChannel} = props;
  const newChannel = {color: "00FF00", name: "G"}
  const onPush = () => {
    pushChannel(newChannel, {g})
  }
  const editSwitch = [
    ["div", {}],
    [PushChannel, {onPush}]
  ]
  const extraUI = <Editor {...{...props, editSwitch}}/>

  const { channels } = props;
  const total = channels.length;
  const rows = channels.map((c, k) => {
    const rowProps = {...props, total, channel: c, idx: k};
    return <LegendRow key={k} {...rowProps} />;
  });
  return <div>
    <RightAlign>{extraUI}</RightAlign>
    <WrapRows>{rows}</WrapRows>
  </div>
};

export { Legend };
