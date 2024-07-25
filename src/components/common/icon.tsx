import * as React from "react";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import type { RefObject } from "react";

export type Props = {
  size?: string;
  width?: string;
  height?: string;
  color?: string;
  icon: IconProp;
  onClick?: (_: unknown) => unknown;
};

interface ButtonProps {
  onClick: any;
  size: string;
  color: string;
}

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

const Button = styled.button<ButtonProps>`
  svg {
    transform: scale(1.0, 0.9);
  }
  justify-items: center;
  align-items: center;
  display: grid;
  border: none;
  font: inherit;
  border-radius: 50%;
  outline: 1px solid var(--theme-glass-edge) !important;
  background-color: var(--theme-dark-main-color);
  margin-bottom: calc(2 * var(--theme-gap-tiny));
  color: ${({ color }) => color};
  font-size: ${({ size }) => size};
  height: ${({ height }) => height};
  width: ${({ width }) => width};
  opacity: ${({ onClick }) => clickOpacity(!onClick)};
  cursor: ${({ onClick }) => clickCursor(!onClick)};
`;

const getProps = (props: Props, noClick = null) => {
  const { icon, onClick = noClick } = props;
  const { 
    size = "1em", color = "inherit",
    height = "1em", width = "1em"
  } = props;
  return {
    size,
    height,
    width,
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
