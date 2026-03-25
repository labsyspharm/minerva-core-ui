import { SimpleIconsetStore } from "@haxtheweb/simple-icon/lib/simple-iconset.js";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Main } from "@/components/main";
import { crc1DemoWaypoints, crc1ExhibitConfig } from "@/demo/crc1DemoData";
import "@fontsource/overpass/200.css";

// Base path for deployment (e.g. /minerva-annotation-demo/ or /)
const base = (
  typeof import.meta.env?.BASE_URL === "string" ? import.meta.env.BASE_URL : "/"
).replace(/\/?$/, "/");
SimpleIconsetStore.registerIconset("icons", `${base}icons/`);
import "@/fonts.css";
import "@fontsource/overpass/500.css";
import { createGlobalStyle } from "styled-components";

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
      handleKeys={["img-1"]}
      demo_dicom_web={false}
      exhibit_config={crc1ExhibitConfig}
      configWaypoints={crc1DemoWaypoints}
    />
    <MainStyle />
  </React.StrictMode>,
);
