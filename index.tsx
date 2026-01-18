import * as React from "react";
import { createRoot } from 'react-dom/client';
import { Main } from "./src/main";
import "@fontsource/overpass/200.css";
import "@fontsource/overpass/500.css";
import { createGlobalStyle } from "styled-components";
import { loremIpsum } from "react-lorem-ipsum";

const fakeText = (p) => {
    const random = true;
    return loremIpsum({ p, random }).join("\n\n");
};

const configWaypoints = [
    {
        "UUID": "8320f08c-9456-49a3-a104-8ab3d5daab2b",
        "State": {
            "Expanded": true
        },
        "Properties": {
            "Name": "Introduction",
            "Content": "...",
            "Pan": [0.5, 0.5],
            "Zoom": 0.6,
            "Group": "Cycle 3"
        },
        "Arrows": [],
        "Overlays": []
    },
];

// TODO: remove legacy exhibit data structure
const exhibit_config = {
    Name: "CRC02 CyCIF - Overview",
    Stories: [{
        Waypoints: configWaypoints.map(({ Properties, Arrows, Overlays }) => {
            const { Name, Content, Pan, Zoom, Group } = Properties;
            return {
                Name, Description: Content,
                Pan, Zoom, Group,
                Arrows, Overlays
            }
        })
    }],
    Groups: [
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 1",
            "Path": "Cycle_1",
            "Channels": [
                "Hoechst1", "Control-488", "Control-555", "Control-647"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                65535, 5000, 5000, 5000
            ],
            "Lows": [
                0, 500, 500, 500
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 2",
            "Path": "Cycle_2",
            "Channels": [
                "Hoechst2", "CD3", "Na-K ATPase", "CD45RO"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                65535, 20000, 20000, 20000
            ],
            "Lows": [
                0, 3000, 2500, 3000
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 3",
            "Path": "Cycle_3",
            "Channels": [
                "Hoechst3", "Ki67", "Keratin", "aSMA"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                40000, 30000, 20000, 50000
            ],
            "Lows": [
                4000, 3000, 3000, 5000
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 4",
            "Path": "Cycle_4",
            "Channels": [
                "Hoechst4", "CD4", "CD45", "PD1"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                40000, 20000, 10360, 10000
            ],
            "Lows": [
                3000, 3000, 1000, 1500
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 5",
            "Path": "Cycle_5",
            "Channels": [
                "Hoechst5", "CD20", "CD68", "CD8a"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                65535, 40000, 20000, 40000
            ],
            "Lows": [
                0, 2000, 1000, 3500
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 6",
            "Path": "Cycle_6",
            "Channels": [
                "Hoechst6", "CD163", "FOXP3", "PDL1"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                65535, 10000, 12000, 5000
            ],
            "Lows": [
                0, 500, 2000, 1900
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 7",
            "Path": "Cycle_7",
            "Channels": [
                "Hoechst7", "Ecad", "Vimentin", "CDX2"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                50000, 12000, 7500, 60000
            ],
            "Lows": [
                4000, 2500, 500, 10000
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 8",
            "Path": "Cycle_8",
            "Channels": [
                "Hoechst8", "LaminABC", "Desmin", "CD31"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                40000, 40000, 65535, 30000
            ],
            "Lows": [
                4000, 3000, 500, 3000
            ]
        },
        {
            "Image": {
                "Method": "Colorimetric"
            },
            "Name": "Cycle 9",
            "Path": "Cycle_9",
            "Channels": [
                "Hoechst9", "PCNA", "Ki67", "CollagenIV"
            ],
            "Colors": [
                "0000FF", "00FF00", "FFFFFF", "FF0000"
            ],
            "Highs": [
                50000, 60000, 15000, 45000
            ],
            "Lows": [
                4000, 2000, 1000, 1000
            ]
        }
    ]
}

// TODO Warning: hard-coded for LUNG-3-PR_40X.ome.tif
const marker_names = ["DNA_1", "AF488", "AF555", "AF647", "DNA_2", "A488 background", "A555 background", "A647 background", "DNA_3", "A488 background", "LAG3", "ARL13B", "DNA_4", "KI67", "Keratin", "PD1", "DNA_5", "CD45RB", "CD3D", "PD-L1", "DNA_6", "CD4", "CD45", "CD8A", "DNA_7", "CD163", "CD68", "CD14", "DNA_8", "CD11B", "FOXP3", "CD21", "DNA_9", "IBA1", "α-SMA", "CD20", "DNA_10", "CD19", "GFAP", "GTUBULIN", "DNA_11", "LAMINAC", "BANF1", "LAMINB"];

const color = "black";
const fontColor = "eeeeee";
const id = "react-output";
const MainStyle = createGlobalStyle`
  #${id} {
    background-color: ${color};
    font-family: "Overpass";
    font-weight: 200;
    color: #${fontColor};
    height: 100%;
  }
`;

const rootElement = document.getElementById(id);
const root = createRoot(rootElement);

root.render(
    <React.StrictMode>
        <Main
            handleKeys={["ome-dir-1"]} demo_dicom_web={true}
            exhibit_config={exhibit_config} configWaypoints={configWaypoints}
        />
        <MainStyle />
    </React.StrictMode>
);

