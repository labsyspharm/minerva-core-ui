import * as React from "react";
import styled from "styled-components";
import { Icon } from "src/components/shared/common/Icons";
import {
  faPlus as faPush,
  faMinus as faPop,
  faCheck as faSelect,
} from "@fortawesome/free-solid-svg-icons";

const defineIcon = ({ icon, onClick, color }) => {
  return {
    size: "1em",
    color,
    icon,
    onClick,
  };
};

const SimpleButton = (props) => {
  return <Icon {...defineIcon(props)} />;
};

const WrapColumn = styled.div`
  grid-template-columns: auto auto auto;
  justify-content: start;
  justify-items: left;
  display: grid;
  gap: 0.25em;
`;

const Push = (props) => {
  const pushProps = {
    ...props,
    onClick: props.onPush,
    icon: faPush,
    color: "#2e5",
  };
  return <SimpleButton {...pushProps} />;
};

const PopUpdate = (props) => {
  const { onPop, children } = props;
  const popProps = { ...props, onClick: onPop, icon: faPop, color: "#e25" };
  return (
    <WrapColumn>
      <SimpleButton {...popProps} />
      {children}
    </WrapColumn>
  );
};

const Update = (props) => {
  const { onUpdate, children } = props;
  const updateProps = { ...props, onClick: onUpdate };
  return (
    <WrapColumn>
      <SimpleButton {...{ ...updateProps, icon: faSelect, color: "#fff" }} />
      {children}
    </WrapColumn>
  );
};

export { Push, PopUpdate, Update };
