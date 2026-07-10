import { RouterProvider } from "@tanstack/react-router";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Main } from "@/components/main";
import { createAppRouter } from "@/router/appRouter";
import "@fontsource/overpass/200.css";
import "@/fonts.css";
import "@fontsource/overpass/500.css";

import { createGlobalStyle } from "styled-components";
import {
  configWaypoints,
  exhibit_config,
  jpeg_exhibit_config,
} from "@/config/demoCrc";
import type { ExhibitConfig } from "@/lib/legacy/exhibit";

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
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
`;

const rootElement = document.getElementById(id);
const root = createRoot(rootElement);

// Stable array reference — FileHandler restore effect deps stay stable across renders.
const OME_TIFF_HANDLE_KEYS = ["img-1"];

/** Bundled CRC channel groups, waypoints, and remote OME-TIFF only for `pnpm run demo` (`vite --mode demo`). */
const ENABLE_JPEG_DEMO = import.meta.env.MODE === "demo-jpeg";
const ENABLE_DEMO_CONTENT = ENABLE_JPEG_DEMO || import.meta.env.MODE === "demo";

document.title = ENABLE_DEMO_CONTENT ? "Minerva 2.0 Demo" : "Minerva";

const emptyExhibitConfig: ExhibitConfig = {
  Name: "",
  Stories: [],
  Groups: [],
};

const DEMO_JPEG_URL = "crc-export";
const DEMO_CRC_OME_TIFF_URL =
  "https://lsp-public-data.s3.amazonaws.com/lin-2021-crc-atlas/CRC01-096-097.ome.tif";

const appRouter = createAppRouter(Main, {
  handleKeys: OME_TIFF_HANDLE_KEYS,
  demo_dicom_web: false,
  demo_jpeg: ENABLE_JPEG_DEMO,
  demo_url: ENABLE_DEMO_CONTENT
    ? ENABLE_JPEG_DEMO
      ? DEMO_JPEG_URL
      : DEMO_CRC_OME_TIFF_URL
    : undefined,
  exhibit_config: ENABLE_DEMO_CONTENT
    ? ENABLE_JPEG_DEMO
      ? jpeg_exhibit_config
      : exhibit_config
    : emptyExhibitConfig,
  configWaypoints:
    ENABLE_DEMO_CONTENT && !ENABLE_JPEG_DEMO ? configWaypoints : [],
});

root.render(
  <React.StrictMode>
    <RouterProvider router={appRouter} />
    <MainStyle />
  </React.StrictMode>,
);
