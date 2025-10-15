import * as React from "react";
import styles from "./index.module.css";
import { useOverlayStore } from "../../lib/stores";
import { ItemList, type ListItem } from "../common/ItemList";

// Types
import type { HashContext } from "../../lib/hashUtil";
import type { ConfigWaypoint } from "../../lib/config";

export type Props = HashContext;

const Stories = (props: Props) => {
    const { hash } = props;
    
    // Use Zustand store for stories management
    const { 
        stories, 
        activeStoryIndex, 
        setActiveStory 
    } = useOverlayStore();

    const className = [
        styles.center, styles.black
    ].join(" ");

    // Convert stories to ListItem format
    const listItems: ListItem<ConfigWaypoint>[] = stories.map((story, index) => ({
        id: story.UUID || `story-${index}`,
        title: story.Properties.Name,
        subtitle: "1 waypoint",
        isActive: activeStoryIndex === index,
        metadata: story
    }));

    const handleStoryClick = (item: ListItem<ConfigWaypoint>) => {
        const index = stories.findIndex(story => story.UUID === item.id || story === item.metadata);
        if (index !== -1) {
            setActiveStory(index);
        }
    };

    return (
        <div slot="stories" className={className}>
            {/* Stories panel content */}
            <ItemList
                items={listItems}
                title="Stories"
                onItemClick={handleStoryClick}
                showVisibilityToggle={false}
                showDeleteButton={false}
                showExpandToggle={false}
                emptyMessage="No stories yet"
            />
        </div>
    );
};

export { Stories };
