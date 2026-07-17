import { createRoot, type Root } from "react-dom/client";
import "@deck.gl/widgets/stylesheet.css";
import { StoryPlayerApp } from "./StoryPlayerApp";

export type MinervaStoryPlayOptions = {
  /** URL to document.json (relative to the page or absolute). */
  documentUrl?: string;
  /** Mount node. */
  root: HTMLElement;
};

export type MinervaStoryHandle = {
  destroy: () => void;
};

/**
 * CDN entry for the Minerva app.
 * Import `bundle/minerva.js`, then call:
 *
 * ```js
 * MinervaStory.play({ documentUrl: "document.json", root });
 * ```
 */
export function play(opts: MinervaStoryPlayOptions): MinervaStoryHandle {
  const rootEl = opts.root;
  if (!rootEl) {
    throw new Error("MinervaStory.play: root element is required");
  }
  const documentUrl = opts.documentUrl ?? "document.json";
  const resolved = new URL(documentUrl, window.location.href).href;

  const reactRoot: Root = createRoot(rootEl);
  reactRoot.render(<StoryPlayerApp documentUrl={resolved} />);

  return {
    destroy: () => {
      reactRoot.unmount();
      rootEl.replaceChildren();
    },
  };
}
