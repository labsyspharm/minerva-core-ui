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
  "Header": "",
  "Rotation": 0,
  "Layout": {
    "Grid": [
      [
        "i0"
      ]
    ]
  },
  "Stories": [
    {
      "Name": "",
      "Waypoints": [
        {
          "Name": "Waypoint Example",
          "Group": "H&E",
          "Audio": "",
          "Description": fakeText(3),
          "Zoom": 0.5,
          "Pan": [0.5, 0.5],
          "Overlays": [],
          "Arrows": [],
          "Polygon": "Q",
        },
        {
          "Name": "Another Waypoint",
          "Group": "One",
          "Audio": "",
          "Description": fakeText(4),
          "Zoom": 0.5,
          "Pan": [0.5, 0.5],
          "Overlays": [
          ],
          "Arrows": [
            {
              "Point": [0.9381917980144533, 0.5809178743961351],
              "Text": "TUMOR",
              "HideArrow": true,
            },
            {
              "Point": [0.3480346062266265, 0.2077906326563334],
              "Text": "STROMA",
              "HideArrow": true,
            },
          ],
          "Polygon": "Q",
        },
      ],
    },
  ],
  "Groups": [
    {
      "Name": "H&E",
      "Path": "HE_0__Hematoxylin--1__Eosin",
      "Colors": [
        "6000a0",
        "d030d0"
      ],
      "Channels": [
        "Hematoxylin",
        "Eosin"
      ]
    },
    {
      "Name": "One",
      "Path": "One_0__Hoechst--2__CD31--3__CD45--17__Pan-CK--18__alpha-SMA",
      "Colors": [
        "0000FF",
        "FFFF00",
        "00FF00",
        "FFFFFF",
        "FF0000"
      ],
      "Channels": [
        "Hoechst",
        "CD31",
        "CD45",
        "Pan CK",
        "alpha SMA"
      ]
    },
    {
      "Name": "Two",
      "Path": "Two_0__Hoechst--9__CD45RO--10__CD20--12__CD3e--15__PD-1--17__Pan-CK",
      "Colors": [
        "0000FF",
        "FFFF00",
        "FF00FF",
        "0000FF",
        "00FF00",
        "FF0000"
      ],
      "Channels": [
        "Hoechst",
        "CD45RO",
        "CD20",
        "CD3e",
        "PD-1",
        "Pan CK"
      ]
    },
    {
      "Name": "Three",
      "Path": "Three_0__Hoechst--4__CD68--11__PD-L1--13__CD163--16__Ki67--17__Pan-CK",
      "Colors": [
        "0000FF",
        "00FF00",
        "FF00FF",
        "FF0000",
        "FFFFFF",
        "00FFFF"
      ],
      "Channels": [
        "Hoechst",
        "CD68",
        "PD-L1",
        "CD163",
        "Ki67",
        "Pan CK"
      ]
    },
    {
      "Name": "Four",
      "Path": "Four_0__Hoechst--6__CD4--7__FoxP3--8__CD8a--14__E-Cadherin",
      "Colors": [
        "0000FF",
        "FF0000",
        "00FF00",
        "00FFFF",
        "FFFFFF"
      ],
      "Channels": [
        "Hoechst",
        "CD4",
        "FoxP3",
        "CD8a",
        "E Cadherin"
      ]
    }
  ],
  "Masks": []
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
