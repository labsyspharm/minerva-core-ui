import * as React from "react";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
const getProps = (props, ref = null) => {
  const noClick = !ref ? null : () => null;
  const { onClick = noClick } = props;
  const { size = "1em", color = "inherit" } = props;
  return Object.assign({ size, color, onClick }, !ref ? {} : { ref });
};
const Icon = (props) => {
  const { icon } = props;
  const buttonProps = getProps(props);
  return React.createElement(
    Button,
    Object.assign({}, buttonProps),
    React.createElement(FontAwesomeIcon, Object.assign({}, { icon }))
  );
};
const RefIconCore = (props, ref) => {
  const { icon } = props;
  const buttonProps = getProps(props, ref);
  return React.createElement(
    Button,
    Object.assign({}, buttonProps),
    React.createElement(FontAwesomeIcon, Object.assign({}, { icon }))
  );
};
const RefIcon = React.forwardRef(RefIconCore);
export { Icon, RefIcon };
//# sourceMappingURL=icon.js.map
