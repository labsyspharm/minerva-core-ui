import * as React from "react";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";

export type Props = {
  size?: string;
  color?: string;
  icon: IconProp;
  onClick?: (_: unknown) => unknown;
};

const clickOpacity = (noClick) => {
  return noClick ? "0.5" : "1.0";
};

const clickCursor = (noClick) => {
  return noClick ? "default" : "pointer";
};

const Button = styled.button`
  padding: 0px;
  border: none;
  font: inherit;
  outline: inherit;
  background: none;
  color: ${({ color }) => color};
  font-size: ${({ size }) => size};
  opacity: ${({ onClick }) => clickOpacity(!onClick)};
  cursor: ${({ onClick }) => clickCursor(!onClick)};
`;

const getProps = (props: Props, ref = null) => {
  const noClick = !ref ? null : () => null;
  const { onClick = noClick } = props;
  const { size = "1em", color = "inherit" } = props;
  return {
    size,
    color,
    onClick,
    ...(!ref ? {} : { ref }),
  };
};

const Icon = (props: Props) => {
  const { icon } = props;
  const buttonProps = getProps(props);
  return (
    <Button {...buttonProps}>
      <FontAwesomeIcon {...{ icon }} />
    </Button>
  );
};

const RefIconCore = (props: Props, ref: unknown) => {
  const { icon } = props;
  const buttonProps = getProps(props, ref);
  return (
    <Button {...buttonProps}>
      <FontAwesomeIcon {...{ icon }} />
    </Button>
  );
};
const RefIcon = React.forwardRef(RefIconCore);

export { Icon, RefIcon };
