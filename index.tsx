import "@/components/shared/minervaTheme.global.css";
import "./index.css";
import { RouterProvider } from "@tanstack/react-router";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Main } from "@/components/Main";
import { createAppRouter } from "@/router/appRouter";

const id = "react-output";

const rootElement = document.getElementById(id);
const root = createRoot(rootElement);

// Stable array reference — FileHandler restore effect deps stay stable across renders.
const OME_TIFF_HANDLE_KEYS = ["img-1"];

const appRouter = createAppRouter(Main, {
  handleKeys: OME_TIFF_HANDLE_KEYS,
});

root.render(
  <React.StrictMode>
    <RouterProvider router={appRouter} />
  </React.StrictMode>,
);
