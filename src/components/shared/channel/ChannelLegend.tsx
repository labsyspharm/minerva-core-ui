import styled from "styled-components";
import {
  PopUpdate as PopUpdateChannel,
  Push as PushChannel,
} from "@/components/authoring/tools/ActionButtons";
import { EditableText } from "@/components/authoring/tools/EditableText";
import { EditModeSwitcher } from "@/components/authoring/tools/EditModeSwitcher";

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
  color: ${({ color }) => color};
  grid-template-columns: auto 1fr;
  justify-items: left;
  display: grid;
  gap: 0.5em;
  :hover {
    text-decoration: underline;
    cursor: pointer;
  }
`;

const Box = styled.div`
  background-color: #${({ color }) => color};
  outline: ${({ outline }) => outline};
  height: 1em;
  width: 1em;
  margin-top: 2px;
`;

export const defaultChannels = [
  { color: "0000FF", name: "DNA" },
  { color: "FF0000", name: "Red" },
  { color: "00FF00", name: "Green" },
  { color: "FFFFFF", name: "White" },
];

const LegendRow = (props) => {
  const { channel, channelVisibilities } = props;
  const channelName = channel.name;
  const visible = channelVisibilities[channelName];
  const { idx, g, onClick } = props;
  const setInput = (t) => {
    props.updateChannel({ ...channel, name: t }, { idx, g });
  };
  const onPop = () => {
    props.popChannel({ g, idx });
  };

  const uuid = `group/channel/name/${idx}`;
  const statusProps = {
    ...props,
    md: false,
    setInput,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  const wrapProps = {
    color: "rgb(238, 238, 238)",
    onClick,
  };
  const boxProps = {
    ...props.channel,
    outline: "none",
  };
  if (!visible) {
    boxProps.color = "black";
    wrapProps.color = "rgb(138, 138, 138)";
    boxProps.outline = "2px solid #cccccc";
  }
  const coreUI = (
    <WrapBox {...wrapProps}>
      <Box {...boxProps} />
      <EditableText {...statusProps}>{channelName}</EditableText>
    </WrapBox>
  );
  const editSwitch = [
    ["div", { children: coreUI }],
    [PopUpdateChannel, { children: coreUI, onPop }],
  ];
  const canPop = props.editable && props.total > 1;
  const extraUI = (
    <EditModeSwitcher {...{ ...props, editable: canPop, editSwitch }} />
  );

  return <>{extraUI}</>;
};

export const ChannelLegend = (props) => {
  const { g, pushChannel, toggleChannel } = props;
  const nextIdx = props.channels.length + 1;
  const newChannel = defaultChannels[nextIdx % defaultChannels.length];
  const onPush = () => {
    pushChannel(newChannel, { g });
  };
  const editSwitch = [
    ["div", {}],
    [PushChannel, { onPush }],
  ];
  const extraUI = <EditModeSwitcher {...{ ...props, editSwitch }} />;

  const { channels } = props;
  const total = channels.length;
  const rows = channels.map((c, k) => {
    const rowProps = {
      ...props,
      total,
      channel: c,
      idx: k,
      onClick: () => toggleChannel(c),
    };
    return <LegendRow key={c.name} {...rowProps} />;
  });
  return (
    <div>
      <RightAlign>{extraUI}</RightAlign>
      <h2 className="h6">Channels</h2>
      <WrapRows>{rows}</WrapRows>
    </div>
  );
};
