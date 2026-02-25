import styled from "styled-components";

interface HeaderProps {
  font: string;
}

const fontStack = ({ font }) => {
  return [font, "sans-serif"].join(",");
};

const headers = new Map([
  [
    "h3",
    styled.h3<HeaderProps>`
      font-weight: 300;
      font-family: ${fontStack};
    `,
  ],
  [
    "h4",
    styled.h4<HeaderProps>`
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
  return <HeaderLevel font={font}>{children}</HeaderLevel>;
};

export { Header };
