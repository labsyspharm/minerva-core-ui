import * as React from "react";
import styled from "styled-components";

const WrapRows = styled.div`
  grid-template-columns: auto 1fr;
  grid-auto-rows: auto;
  display: grid;
  gap: 0.25em;
`;

const WrapBox = styled.div`
  justify-items: center;
  display: grid;
`;

const Box = styled.div`
  background-color: #${({ color }) => color};
  height: 1em;
  width: 1em;
`;
const LegendRow = (props) => {
  const { name } = props;

  return (
    <>
      <WrapBox>
        <Box {...props} />
      </WrapBox>
      <div>{name}</div>
    </>
  );
};

const Legend = (props) => {
  const { channels } = props;
  const rows = channels.map((c, k) => {
    return <LegendRow key={k} {...c} />;
  });
  return <WrapRows>{rows}</WrapRows>;
};

export { Legend };
