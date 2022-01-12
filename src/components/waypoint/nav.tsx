import * as React from "react";
import styled from "styled-components";

const repeat = ({ length }) => {
  return `repeat(${length}, auto)`;
};

const Wrap = styled.div`
  display: grid;
  justify-content: space-evenly;
  grid-template-columns: ${repeat};
`;

const Nav = (props) => {
  const { children } = props;
  const { length } = children;
  return <Wrap {...{ length }}>{children}</Wrap>;
};

export { Nav };
