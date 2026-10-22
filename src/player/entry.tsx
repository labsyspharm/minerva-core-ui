import { createRoot, type Root } from "react-dom/client";
import "@deck.gl/widgets/stylesheet.css";
import "@/components/shared/minervaTheme.global.css";
import { StoryPlayerApp } from "@/components/playback/StoryPlayerApp";
import { beginEditing, isEditingOnThisPage, mountEditor } from "./storyEditor";

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
  /** Show an Edit button that switches this page to the author app. */
  editable?: boolean;
  root: HTMLElement;
};

export type MinervaStoryHandle = {
  destroy: () => void;
};

/**
 * CDN entry (`bundle/minerva.js`, an ES module).
 *
 * ```js
 * import { play } from "./bundle/minerva.js";
 * play({ documentUrl: "document.json", editable: true, root });
 * ```
 */
export function play(opts: MinervaStoryPlayOptions): MinervaStoryHandle {
  const { root } = opts;
  if (!root) throw new Error("play: root element is required");
  ensureDmSans();

  const documentUrl = new URL(
    opts.documentUrl ?? "document.json",
    window.location.href,
  ).href;
  let reactRoot: Root | null = null;
  let destroyed = false;

  const showEditor = () => {
    reactRoot?.unmount();
    reactRoot = mountEditor(root);
  };
  const showPlayer = () => {
    reactRoot = createRoot(root);
    reactRoot.render(
      <StoryPlayerApp
        documentUrl={documentUrl}
        onEdit={
          opts.editable
            ? async () => {
                await beginEditing(documentUrl);
                if (!destroyed) showEditor();
              }
            : undefined
        }
      />,
    );
  };

  if (opts.editable) {
    // A reload while editing reopens the editor on this site's copy.
    void isEditingOnThisPage().then((editing) => {
      if (destroyed) return;
      if (editing) showEditor();
      else showPlayer();
    });
  } else {
    showPlayer();
  }

  return {
    destroy: () => {
      destroyed = true;
      reactRoot?.unmount();
      root.replaceChildren();
    },
  };
}
