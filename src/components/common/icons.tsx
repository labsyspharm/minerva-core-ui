import styled from "styled-components";

const WrapIcons = styled.div`
  gap: 1.333em;
  display: grid;
  grid-template-rows: auto;
  color: var(--theme-light-contrast-color);
  justify-items: ${({ justify }) => justify};
`;

export { WrapIcons };
