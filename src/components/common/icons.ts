import styled from "styled-components";

interface Props {
  justify: string;
}

const WrapIcons = styled.div<Props>`
  gap: 1.333em;
  display: grid;
  grid-template-rows: auto;
  justify-items: ${({ justify }) => justify};
`;
export { WrapIcons };
