import { RouterProvider } from "@tanstack/react-router";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Main } from "@/components/Main";
import { createAppRouter } from "@/router/appRouter";
import "@fontsource/overpass/200.css";
import "@/fonts.css";
import "@fontsource/overpass/500.css";

import { createGlobalStyle } from "styled-components";
import { getDemoDocumentTitle, getDemoMainProps } from "@/lib/persistence/demo";

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

document.title = getDemoDocumentTitle();

const appRouter = createAppRouter(Main, {
  handleKeys: OME_TIFF_HANDLE_KEYS,
  ...getDemoMainProps(),
});

root.render(
  <React.StrictMode>
    <RouterProvider router={appRouter} />
    <MainStyle />
  </React.StrictMode>,
);
