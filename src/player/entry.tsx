import { createRoot } from "react-dom/client";
import { createMinervaController, type MinervaHandle } from "@/api/controller";
import { type MinervaStoryProps, MinervaStoryView } from "@/embed/MinervaStory";

export type MinervaStoryPlayOptions = Omit<MinervaStoryProps, "document"> & {
  /** URL to document.json (relative or absolute). */
  documentUrl?: string;
  /** Parsed document.json; takes precedence over `documentUrl`. */
  document?: object;
  root: HTMLElement;
};

export type MinervaStoryHandle = MinervaHandle & {
  destroy: () => void;
};

/**
 * CDN entry (`bundle/minerva.js` → `MinervaStory`).
 *
 * ```js
 * const story = MinervaStory.play({ documentUrl: "document.json", root });
 * await story.whenReady();
 * await story.goToWaypoint(2);
 * ```
 */
export function play(opts: MinervaStoryPlayOptions): MinervaStoryHandle {
  const { root, documentUrl, document, ...props } = opts;
  if (!root) throw new Error("MinervaStory.play: root element is required");

  const source =
    document ??
    new URL(documentUrl ?? "document.json", window.location.href).href;
  const controller = createMinervaController();
  const reactRoot = createRoot(root);
  reactRoot.render(
    <MinervaStoryView {...props} document={source} controller={controller} />,
  );

  return {
    ...controller.handle,
    destroy: () => {
      reactRoot.unmount();
      controller.dispose();
      root.replaceChildren();
    },
  };
}
