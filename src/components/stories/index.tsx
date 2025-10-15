import * as React from "react";
import styles from "./index.module.css";
import { useOverlayStore } from "../../lib/stores";
import { ItemList, type ListItem } from "../common/ItemList";
import { MarkdownEditor } from "./MarkdownEditor";
import { ROIPanel } from "./ROIPanel";
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

interface ROIPanelMetadata {
    type: 'roi-panel';
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
        updateStory,
        reorderStories
    } = useOverlayStore();

    // Local state for markdown editing
    const [isEditingMarkdown, setIsEditingMarkdown] = React.useState(false);
    const [expandedMarkdownStories, setExpandedMarkdownStories] = React.useState<Set<string>>(new Set());
    
    // Local state for ROI panel expansion
    const [expandedROIStories, setExpandedROIStories] = React.useState<Set<string>>(new Set());
    
    // Drag and drop state
    const [draggedStoryId, setDraggedStoryId] = React.useState<string | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);

    const className = [
        styles.center, styles.black
    ].join(" ");

    // Convert stories to ListItem format with inline markdown editor and ROI panel
    const listItems: ListItem<ConfigWaypoint | MarkdownEditorMetadata | ROIPanelMetadata>[] = stories.map((story, index) => {
        const storyId = story.UUID || `story-${index}`;
        const isMarkdownExpanded = expandedMarkdownStories.has(storyId);
        const isROIExpanded = expandedROIStories.has(storyId);
        const isDragging = draggedStoryId === storyId;
        const isDropTarget = dropTargetIndex === index;
        
        // Build children array based on what's expanded
        const children: ListItem<ConfigWaypoint | MarkdownEditorMetadata | ROIPanelMetadata>[] = [];
        
        if (isMarkdownExpanded) {
            children.push({
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
            });
        }
        
        if (isROIExpanded) {
            children.push({
                id: `${storyId}-roi-panel`,
                title: 'ROI Panel',
                subtitle: 'Overlays and annotations',
                isActive: false,
                isExpanded: false,
                metadata: { 
                    type: 'roi-panel',
                    story: story,
                    storyIndex: index
                } as ROIPanelMetadata
            });
        }
        
        return {
            id: storyId,
            title: story.Properties.Name,
            subtitle: story.Properties.Content ? 
                (story.Properties.Content.length > 30 ? 
                    `${story.Properties.Content.substring(0, 30)}...` : 
                    story.Properties.Content) : 
                'Story',
            isActive: activeStoryIndex === index,
            isExpanded: isMarkdownExpanded || isROIExpanded,
            isDragging: isDragging,
            children: children.length > 0 ? children : undefined,
            metadata: story
        };
    });

    const handleItemClick = (item: ListItem<ConfigWaypoint | MarkdownEditorMetadata | ROIPanelMetadata>) => {
        // Only handle story clicks, not child panel clicks
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

    // Handle ROI panel toggle
    const handleToggleROIPanel = (storyId: string) => {
        setExpandedROIStories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(storyId)) {
                newSet.delete(storyId);
            } else {
                newSet.add(storyId);
            }
            return newSet;
        });
    };

    // Drag and drop handlers
    const handleDragStart = (storyId: string, event: React.DragEvent) => {
        setDraggedStoryId(storyId);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', storyId);
    };

    const handleDragEnd = (storyId: string, event: React.DragEvent) => {
        setDraggedStoryId(null);
        setDropTargetIndex(null);
    };

    const handleDragOver = (storyId: string, event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        // Find the index of the target story
        const targetIndex = stories.findIndex(story => story.UUID === storyId);
        if (targetIndex !== -1) {
            setDropTargetIndex(targetIndex);
        }
    };

    const handleDragLeave = (storyId: string, event: React.DragEvent) => {
        setDropTargetIndex(null);
    };

    const handleDrop = (targetStoryId: string, draggedStoryId: string) => {
        if (draggedStoryId && draggedStoryId !== targetStoryId) {
            const fromIndex = stories.findIndex(story => story.UUID === draggedStoryId);
            const toIndex = stories.findIndex(story => story.UUID === targetStoryId);
            
            if (fromIndex !== -1 && toIndex !== -1) {
                reorderStories(fromIndex, toIndex);
            }
        }
        setDraggedStoryId(null);
        setDropTargetIndex(null);
    };

    // Get the active story for markdown editing
    const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

    // Custom item actions for stories
    const storyItemActions = (item: ListItem<ConfigWaypoint | MarkdownEditorMetadata | ROIPanelMetadata>) => {
        // Only show actions for story items, not child panel items
        if (item.metadata && 'type' in item.metadata) {
            return null;
        }

        const story = item.metadata as ConfigWaypoint;
        const storyId = story.UUID || item.id;
        const isMarkdownExpanded = expandedMarkdownStories.has(storyId);
        const isROIExpanded = expandedROIStories.has(storyId);

        return (
            <div style={{ display: 'flex', gap: '4px' }}>
                {/* Drag Handle */}
                <div
                    style={{
                        cursor: 'grab',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                        fontSize: '12px',
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(storyId, e)}
                    onDragEnd={(e) => handleDragEnd(storyId, e)}
                    title="Drag to reorder"
                >
                    ⋮⋮
                </div>

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

                {/* ROI/Annotations Button */}
                <button
                    style={{
                        background: 'none',
                        border: 'none',
                        color: isROIExpanded ? '#007acc' : '#ccc',
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
                        handleToggleROIPanel(storyId);
                    }}
                    title={isROIExpanded ? "Hide ROI panel" : "Show ROI panel"}
                >
                    <PolylineIcon style={{ width: '14px', height: '14px' }} />
                </button>
            </div>
        );
    };

    // Custom child renderer for markdown editor and ROI panel
    const customChildRenderer = (childItem: ListItem<ConfigWaypoint | MarkdownEditorMetadata | ROIPanelMetadata>, parentItem: ListItem<ConfigWaypoint | MarkdownEditorMetadata | ROIPanelMetadata>) => {
        if (childItem.metadata && 'type' in childItem.metadata) {
            const metadata = childItem.metadata as MarkdownEditorMetadata | ROIPanelMetadata;
            
            if (metadata.type === 'markdown-editor') {
                const markdownMetadata = metadata as MarkdownEditorMetadata;
                const story = markdownMetadata.story;
                const storyIndex = markdownMetadata.storyIndex;
                
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
            } else if (metadata.type === 'roi-panel') {
                const roiMetadata = metadata as ROIPanelMetadata;
                const story = roiMetadata.story;
                
                return (
                    <div className={styles.roiPanelInline}>
                        <ROIPanel 
                            story={story}
                            storyIndex={roiMetadata.storyIndex}
                        />
                    </div>
                );
            }
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
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
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
