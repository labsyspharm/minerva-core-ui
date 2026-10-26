import "@/components/shared/minervaTheme.global.css";
import "./index.css";
import { RouterProvider } from "@tanstack/react-router";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Main } from "@/components/Main";
import {
  DEMO_SHELF_STORY_ID,
  getDemoDocumentTitle,
  getDemoMainProps,
  isDemoOpenPreview,
} from "@/lib/persistence/demo";
import {
  createAppRouter,
  parsePreferredStoryIdFromLocation,
} from "@/router/appRouter";

const id = "react-output";

const rootElement = document.getElementById(id);
const root = createRoot(rootElement);

// Stable array reference — FileHandler restore effect deps stay stable across renders.
const OME_TIFF_HANDLE_KEYS = ["img-1"];

document.title = getDemoDocumentTitle();

// Hosted CRC01 demo: open the demo story rather than the Library when no story is linked.
if (isDemoOpenPreview() && parsePreferredStoryIdFromLocation() === null) {
  const url = new URL(window.location.href);
  url.searchParams.set("storyid", DEMO_SHELF_STORY_ID);
  window.history.replaceState(null, "", url);
}

const appRouter = createAppRouter(Main, {
  handleKeys: OME_TIFF_HANDLE_KEYS,
  ...getDemoMainProps(),
});

root.render(
  <React.StrictMode>
    <RouterProvider router={appRouter} />
  </React.StrictMode>,
);
