import * as React from "react";
import styled from "styled-components";
const fontStack = ({ font }) => {
  return [font, "sans-serif"].join(",");
};
const headers = new Map([
  [
    "h3",
    styled.h3`
      font-weight: 300;
      font-family: ${fontStack};
    `,
  ],
  [
    "h4",
    styled.h4`
      font-weight: 300;
      font-family: ${fontStack};
    `,
  ],
]);
const Header = (props) => {
  const font = "Verdana";
  const { children, h } = props;
  const level = [3, 4].includes(h) ? h : 4;
  const HeaderLevel = headers.get(`h${level}`);
  return React.createElement(HeaderLevel, { font: font }, children);
};
export { Header };
//# sourceMappingURL=header.js.map
