import { createRoot } from "react-dom/client";
import "@deck.gl/widgets/stylesheet.css";
import { StoryPlayerApp } from "@/components/playback/StoryPlayerApp";

export type MinervaStoryPlayOptions = {
  /** URL to document.json (relative or absolute). */
  documentUrl?: string;
  root: HTMLElement;
};

export type MinervaStoryHandle = {
  destroy: () => void;
};

/**
 * CDN entry (`bundle/minerva.js` → `MinervaStory`).
 *
 * ```js
 * MinervaStory.play({ documentUrl: "document.json", root });
 * ```
 */
export function play(opts: MinervaStoryPlayOptions): MinervaStoryHandle {
  const { root } = opts;
  if (!root) throw new Error("MinervaStory.play: root element is required");

  const documentUrl = new URL(
    opts.documentUrl ?? "document.json",
    window.location.href,
  ).href;
  const reactRoot = createRoot(root);
  reactRoot.render(<StoryPlayerApp documentUrl={documentUrl} />);

  return {
    destroy: () => {
      reactRoot.unmount();
      root.replaceChildren();
    },
  };
}
