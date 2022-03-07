import * as React from "react";
import * as ReactDOM from "react-dom";
import { Main } from "../src/main";
import "@fontsource/overpass/200.css";
import { createGlobalStyle } from "styled-components";
import { loremIpsum } from "react-lorem-ipsum";

const fakeText = (p) => {
  const random = true;
  return loremIpsum({ p, random }).join("\n\n");
};

const config = {
  Groups: [
    {
      Path: "Structural-Components_0__DAPI--14__KERATIN--34__ASMA--22__CD45--33__IBA1",
      Name: "Test",
      Colors: ["0000FF", "FFFFFF", "FF0000", "00FF00", "00FFFF"],
      Channels: ["DNA", "Keratin", "α-SMA", "CD45", "IBA1"],
    },
    {
      Path: "Nuclei_0__DAPI",
      Name: "Test DNA",
      Colors: ["FFFFFF"],
      Channels: ["DNA"],
    },
  ],
  Stories: [
    {
      Name: "",
      Waypoints: [
        {
          Name: "Waypoint Example",
          Group: "Test",
          Audio: "",
          Description: fakeText(3),
          Zoom: 0.5,
          Pan: [0.5, 0.5],
          Overlays: [],
          Arrows: [],
          Polygon: "Q",
        },
        {
          Name: "Another Waypoint",
          Group: "Test DNA",
          Audio: "",
          Description: fakeText(4),
          Zoom: 0.5,
          Pan: [0.5, 0.5],
          Overlays: [
            {
              x: 0.8681,
              y: 0.5487,
              width: 0,
              height: 0,
            },
          ],
          Arrows: [
            {
              Point: [0.9381917980144533, 0.5809178743961351],
              Text: "TUMOR",
              HideArrow: true,
            },
            {
              Point: [0.3480346062266265, 0.2077906326563334],
              Text: "STROMA",
              HideArrow: true,
            },
          ],
          Polygon: "Q",
        },
      ],
    },
  ],
};

const color = "black";
const fontColor = "eeeeee";
const id = "react-output";
const MainStyle = createGlobalStyle`
  #${id} {
    background-color: ${color};
    font-family: "Overpass";
    color: #${fontColor};
    height: 100%;
  }
`;

ReactDOM.render(
  <React.StrictMode>
    <Main config={config} />
    <MainStyle />
  </React.StrictMode>,
  document.getElementById(id)
);
