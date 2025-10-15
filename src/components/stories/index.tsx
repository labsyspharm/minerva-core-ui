import * as React from "react";
import styles from "./index.module.css";
import { useOverlayStore } from "../../lib/stores";
import { ItemList, type ListItem } from "../common/ItemList";
import { MarkdownEditor } from "./MarkdownEditor";
import { TextIcon, PolylineIcon } from "../overlays/icons";

// Types
import type { HashContext } from "../../lib/hashUtil";
import type { ConfigWaypoint } from "../../lib/config";

// Extended metadata type for markdown editor
interface MarkdownEditorMetadata {
    type: 'markdown-editor';
    story: ConfigWaypoint;
    storyIndex: number;
}

export type Props = HashContext;

const Stories = (props: Props) => {
    const { hash } = props;

    // Use Zustand store for stories and waypoints management
    const { 
        stories, 
        activeStoryIndex, 
        setActiveStory,
        waypoints,
        activeWaypointId,
        setActiveWaypoint,
        updateStory
    } = useOverlayStore();

    // Local state for markdown editing
    const [isEditingMarkdown, setIsEditingMarkdown] = React.useState(false);
    const [expandedMarkdownStories, setExpandedMarkdownStories] = React.useState<Set<string>>(new Set());

    const className = [
        styles.center, styles.black
    ].join(" ");

    // Convert stories to ListItem format with inline markdown editor
    const listItems: ListItem<ConfigWaypoint | MarkdownEditorMetadata>[] = stories.map((story, index) => {
        const storyId = story.UUID || `story-${index}`;
        const isMarkdownExpanded = expandedMarkdownStories.has(storyId);
        
        return {
            id: storyId,
            title: story.Properties.Name,
            subtitle: story.Properties.Content ? 
                (story.Properties.Content.length > 30 ? 
                    `${story.Properties.Content.substring(0, 30)}...` : 
                    story.Properties.Content) : 
                'Story',
            isActive: activeStoryIndex === index,
            isExpanded: isMarkdownExpanded,
            // Only include children when markdown is expanded
            children: isMarkdownExpanded ? [{
                id: `${storyId}-markdown-editor`,
                title: 'Markdown Editor',
                subtitle: 'Click to edit content',
                isActive: false,
                isExpanded: false,
                metadata: { 
                    type: 'markdown-editor',
                    story: story,
                    storyIndex: index
                } as MarkdownEditorMetadata
            }] : undefined,
            metadata: story
        };
    });

    const handleItemClick = (item: ListItem<ConfigWaypoint | MarkdownEditorMetadata>) => {
        // Only handle story clicks, not markdown editor clicks
        if (item.metadata && !('type' in item.metadata)) {
            const story = item.metadata as ConfigWaypoint;
            const index = stories.findIndex(s => s.UUID === story.UUID);
            if (index !== -1) {
                setActiveStory(index);
            }
        }
    };

    // Markdown editing handlers
    const handleContentChange = (newContent: string) => {
        if (activeStoryIndex !== null && stories[activeStoryIndex]) {
            updateStory(activeStoryIndex, {
                Properties: {
                    ...stories[activeStoryIndex].Properties,
                    Content: newContent
                }
            });
        }
    };

    const handleSaveMarkdown = () => {
        setIsEditingMarkdown(false);
    };

    const handleCancelMarkdown = () => {
        setIsEditingMarkdown(false);
    };

    const handleToggleEditMarkdown = () => {
        setIsEditingMarkdown(!isEditingMarkdown);
    };

    // Handle markdown editor toggle
    const handleToggleMarkdownEditor = (storyId: string) => {
        setExpandedMarkdownStories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(storyId)) {
                newSet.delete(storyId);
            } else {
                newSet.add(storyId);
            }
            return newSet;
        });
    };

    // Handle annotations button (placeholder for future functionality)
    const handleAnnotationsClick = (storyId: string) => {
        console.log('Annotations clicked for story:', storyId);
        // TODO: Implement annotations functionality
    };

    // Get the active story for markdown editing
    const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

    // Custom item actions for stories
    const storyItemActions = (item: ListItem<ConfigWaypoint | MarkdownEditorMetadata>) => {
        // Only show actions for story items, not markdown editor items
        if (item.metadata && 'type' in item.metadata) {
            return null;
        }

        const story = item.metadata as ConfigWaypoint;
        const storyId = story.UUID || item.id;
        const isMarkdownExpanded = expandedMarkdownStories.has(storyId);

        return (
            <div style={{ display: 'flex', gap: '4px' }}>
                {/* Markdown/Text Editor Button */}
                <button
                    style={{
                        background: 'none',
                        border: 'none',
                        color: isMarkdownExpanded ? '#007acc' : '#ccc',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMarkdownEditor(storyId);
                    }}
                    title={isMarkdownExpanded ? "Hide markdown editor" : "Show markdown editor"}
                >
                    <TextIcon style={{ width: '14px', height: '14px' }} />
                </button>

                {/* Annotations Button */}
                <button
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#ccc',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleAnnotationsClick(storyId);
                    }}
                    title="Annotations (coming soon)"
                >
                    <PolylineIcon style={{ width: '14px', height: '14px' }} />
                </button>
            </div>
        );
    };

    // Custom child renderer for markdown editor
    const customChildRenderer = (childItem: ListItem<ConfigWaypoint | MarkdownEditorMetadata>, parentItem: ListItem<ConfigWaypoint | MarkdownEditorMetadata>) => {
        if (childItem.metadata && 'type' in childItem.metadata && childItem.metadata.type === 'markdown-editor') {
            const metadata = childItem.metadata as MarkdownEditorMetadata;
            const story = metadata.story;
            const storyIndex = metadata.storyIndex;
            
            return (
                <div className={styles.markdownEditorInline}>
                    <MarkdownEditor
                        title={`Edit: ${story.Properties.Name}`}
                        content={story.Properties.Content || ''}
                        onContentChange={(newContent) => {
                            updateStory(storyIndex, {
                                Properties: {
                                    ...story.Properties,
                                    Content: newContent
                                }
                            });
                        }}
                        onSave={handleSaveMarkdown}
                        onCancel={handleCancelMarkdown}
                        isEditing={isEditingMarkdown}
                        onToggleEdit={handleToggleEditMarkdown}
                        compact={true}
                    />
                </div>
            );
        }
        
        // Fallback to default rendering
        return null;
    };

    return (
        <div slot="stories" className={className}>
            {/* Stories panel content */}
            <ItemList
                items={listItems}
                title="Stories"
                onItemClick={handleItemClick}
                showVisibilityToggle={false}
                showDeleteButton={false}
                showExpandToggle={false}
                emptyMessage="No stories yet"
                customChildRenderer={customChildRenderer}
                itemActions={storyItemActions}
            />
        </div>
    );
};

export { Stories };
