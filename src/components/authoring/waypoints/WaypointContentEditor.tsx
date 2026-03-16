import MDEditor from "@uiw/react-md-editor";
import type * as React from "react";
import "@uiw/react-md-editor/markdown-editor.css";
import type { ConfigWaypoint } from "@/lib/config";
import { useOverlayStore } from "@/lib/stores";

type WaypointContentEditorProps = {
  story: ConfigWaypoint;
  storyIndex: number;
};

const WaypointContentEditor: React.FC<WaypointContentEditorProps> = ({
  story,
  storyIndex,
}) => {
  const updateStory = useOverlayStore((state) => state.updateStory);

  const handleChange = (value?: string) => {
    updateStory(storyIndex, { Content: value ?? "" });
  };

  return (
    <div data-color-mode="dark">
      <MDEditor
        value={story.Content ?? ""}
        onChange={handleChange}
        preview="live"
        height={200}
        visibleDragbar={false}
      />
    </div>
  );
};

export { WaypointContentEditor };
export type { WaypointContentEditorProps };
