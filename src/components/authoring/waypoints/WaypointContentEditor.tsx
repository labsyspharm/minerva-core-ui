import MDEditor from "@uiw/react-md-editor";
import * as React from "react";
import "@uiw/react-md-editor/markdown-editor.css";
import type { StoreStoryWaypoint } from "@/lib/stores";
import { useOverlayStore } from "@/lib/stores";
import "./WaypointContentEditor.css";

type PreviewMode = NonNullable<
  React.ComponentProps<typeof MDEditor>["preview"]
>;

type WaypointContentEditorProps = {
  story: StoreStoryWaypoint;
  storyIndex: number;
  /** When "detail", editor grows to fit content and relies on the parent for scrolling */
  variant?: "compact" | "detail";
};

type MDEditorHandle = {
  container: HTMLDivElement | null;
};

const COMPACT_HEIGHT = 200;

function parsePreviewModeFromContainer(root: HTMLElement): PreviewMode {
  const cls = root.className;
  if (cls.includes("w-md-editor-show-preview")) return "preview";
  if (cls.includes("w-md-editor-show-live")) return "live";
  return "edit";
}

const WaypointContentEditor: React.FC<WaypointContentEditorProps> = ({
  story,
  storyIndex,
  variant = "compact",
}) => {
  const updateStory = useOverlayStore((state) => state.updateStory);
  const mdRef = React.useRef<MDEditorHandle | null>(null);
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("edit");

  const handleChange = (value?: string) => {
    updateStory(storyIndex, { Content: value ?? "" });
  };

  React.useEffect(() => {
    if (variant !== "detail") return;

    let cancelled = false;
    let observer: MutationObserver | undefined;
    const rafIds: number[] = [];

    const tryAttach = (): boolean => {
      const root = mdRef.current?.container;
      if (!root || cancelled) return false;
      setPreviewMode(parsePreviewModeFromContainer(root));
      observer?.disconnect();
      observer = new MutationObserver(() => {
        setPreviewMode(parsePreviewModeFromContainer(root));
      });
      observer.observe(root, { attributes: true, attributeFilter: ["class"] });
      return true;
    };

    const schedule = () => {
      if (cancelled) return;
      if (tryAttach()) return;
      if (rafIds.length < 60) {
        rafIds.push(window.requestAnimationFrame(schedule));
      }
    };
    rafIds.push(window.requestAnimationFrame(schedule));

    return () => {
      cancelled = true;
      for (const id of rafIds) {
        window.cancelAnimationFrame(id);
      }
      observer?.disconnect();
    };
  }, [variant]);

  const height = variant === "detail" ? "auto" : COMPACT_HEIGHT;
  const previewProp: PreviewMode = variant === "detail" ? previewMode : "live";

  return (
    <div
      data-color-mode="dark"
      className={
        variant === "detail" ? "waypointMarkdownEditorDetail" : undefined
      }
    >
      <MDEditor
        key={variant === "detail" ? story.id : storyIndex}
        ref={mdRef as React.Ref<MDEditorHandle & Record<string, unknown>>}
        value={story.content ?? ""}
        onChange={handleChange}
        preview={previewProp}
        height={height}
        minHeight={variant === "detail" ? 0 : undefined}
        visibleDragbar={false}
        enableScroll={variant !== "detail"}
      />
    </div>
  );
};

export { WaypointContentEditor };
export type { WaypointContentEditorProps };
