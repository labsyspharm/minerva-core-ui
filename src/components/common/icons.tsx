import styled from "styled-components";

const WrapIcons = styled.div`
  gap: 1.333em;
  display: grid;
  grid-template-rows: auto;
  justify-items: ${({ justify }) => justify};
`;

export { WrapIcons };
