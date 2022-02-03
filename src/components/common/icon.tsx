import * as React from "react";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import type { RefObject } from "react";

export type Props = {
  size?: string;
  color?: string;
  icon: IconProp;
  onClick?: (_: unknown) => unknown;
};

type Ref = (x: unknown) => void;

const isRef = (x: unknown): x is Ref => {
  return typeof x === "function";
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

const getProps = (props: Props, noClick = null) => {
  const { icon, onClick = noClick } = props;
  const { size = "1em", color = "inherit" } = props;
  return {
    size,
    icon,
    color,
    onClick,
  };
};

const Icon = (props: Props) => {
  const { icon, ...rest } = getProps(props);
  return (
    <Button {...rest}>
      <FontAwesomeIcon {...{ icon }} />
    </Button>
  );
};

const RefIcon = React.forwardRef((props: Props, ref: Ref) => {
  const coreProps = getProps(props, () => null);
  const { icon, ...rest } = { ref, ...coreProps };
  return (
    <Button {...rest}>
      <FontAwesomeIcon {...{ icon }} />
    </Button>
  );
});

export { Icon, RefIcon };
