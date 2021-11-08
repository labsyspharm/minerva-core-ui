import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  unstable_HistoryRouter as HistoryRouter
} from "react-router-dom";
import { useHashHistory } from "use-hash-history";
import { HashHistory } from './components/hashHistory';
import { emptyHash } from "./lib/hashUtil";
import { readConfig } from "./lib/exhibit";

const config = {
  "Groups": [
    {
      "Path": "Nuclei_0__DAPI",
      "Name": "Test",
      "Colors": [
        "0000FF"
      ],
      "Channels": [
        "DNA"
      ]
    }  
  ],
  "Stories": [
    {
      "Name": "",
      "Waypoints": [
        {
          "Name": "Empty",
          "Group": "Test",
          "Audio": "",
          "Description": "Test",
          "Zoom": 0.5,
          "Pan": [ 0.5, 0.5 ],
          "Overlays": [],
          "Arrows": [],
          "Polygon": "Q"
        },
        {
          "Name": "Labels",
          "Group": "Test",
          "Audio": "",
          "Description": "Tumor and Stroma",
          "Zoom": 0.5,
          "Pan": [ 0.5, 0.5 ],
          "Overlays": [{
            "x": 0.8681,
            "y": 0.5487,
            "width": 0,
            "height": 0
          }],
          "Arrows": [
            {
              "Point": [
                0.9381917980144533,
                0.5809178743961351
              ],
              "Text": "TUMOR",
              "HideArrow": true
            },
            {
              "Point": [
                0.3480346062266265,
                0.2077906326563334
              ],
              "Text": "STROMA",
              "HideArrow": true
            }
          ],
          "Polygon": "Q"
        }
      ]
    }
  ]
}

const history = useHashHistory({
  hashSlash: "#",
  hashRoot: ""
})

ReactDOM.render(
  <React.StrictMode>
    <HistoryRouter history={history}>
      <HashHistory {...{
        exhibit: readConfig(config),
        emptyHash
      }}/>
    </HistoryRouter>
  </React.StrictMode>,
  document.getElementById("react-output")
);
