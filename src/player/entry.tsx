import { createRoot } from "react-dom/client";
import "@deck.gl/widgets/stylesheet.css";
import "@/components/shared/minervaTheme.global.css";
import { StoryPlayerApp } from "@/components/playback/StoryPlayerApp";

const DM_SANS_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap";

function ensureDmSans() {
  if (document.querySelector(`link[href="${DM_SANS_HREF}"]`)) return;
  const google = document.createElement("link");
  google.rel = "preconnect";
  google.href = "https://fonts.googleapis.com";
  const gstatic = document.createElement("link");
  gstatic.rel = "preconnect";
  gstatic.href = "https://fonts.gstatic.com";
  gstatic.crossOrigin = "anonymous";
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = DM_SANS_HREF;
  document.head.append(google, gstatic, sheet);
}

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
  ensureDmSans();

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
