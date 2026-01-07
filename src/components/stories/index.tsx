import * as React from "react";
import styles from "./index.module.css";
import { useOverlayStore } from "../../lib/stores";
import { ItemList, type ListItem } from "../common/ItemList";
import { ROIPanel } from "./ROIPanel";
import { TextIcon, PolylineIcon } from "../overlays/icons";

// Types
import type { HashContext } from "../../lib/hashUtil";
import type { ConfigWaypoint } from "../../lib/config";

// Extended metadata type for markdown editor
// Removed markdown editor

interface ROIPanelMetadata {
    type: 'roi-panel';
    story: ConfigWaypoint;
    storyIndex: number;
}

export type Props = HashContext & {
  viewOnly?: boolean;
};

const Stories = (props: Props) => {
    const { hash, viewOnly } = props;

    // Use Zustand store for stories and waypoints management
    const { 
        stories, 
        activeStoryIndex, 
        setActiveStory,
        waypoints,
        activeWaypointId,
        setActiveWaypoint,
        updateStory,
        reorderStories,
        importWaypointAnnotations,
        clearImportedAnnotations,
        imageWidth,
        imageHeight
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

    // Auto-import annotations for the active story (or first story on initial load)
    // Also re-run when image dimensions become available
    React.useEffect(() => {
        if (stories.length === 0) return;
        // Wait for image dimensions to be set
        if (imageWidth === 0 || imageHeight === 0) return;
        
        // Determine which story to use - active story or default to first
        const storyIndex = activeStoryIndex ?? 0;
        const story = stories[storyIndex];
        
        if (story) {
            // Clear any existing imported annotations first
            clearImportedAnnotations();
            
            // Import annotations from the story
            const arrows = story.Arrows || [];
            const overlays = story.Overlays || [];
            if (arrows.length > 0 || overlays.length > 0) {
                importWaypointAnnotations(arrows, overlays);
            }
        }
    }, [stories, activeStoryIndex, imageWidth, imageHeight, importWaypointAnnotations, clearImportedAnnotations]);

    // Convert stories to ListItem format with inline markdown editor and ROI panel
const listItems: ListItem<ConfigWaypoint | ROIPanelMetadata>[] = stories.map((story, index) => {
        const storyId = story.UUID || `story-${index}`;
        const isMarkdownExpanded = expandedMarkdownStories.has(storyId);
        const isROIExpanded = expandedROIStories.has(storyId);
        const isDragging = draggedStoryId === storyId;
        const isDropTarget = dropTargetIndex === index;
        
        // Build children array based on what's expanded
    const children: ListItem<ConfigWaypoint | ROIPanelMetadata>[] = [];
        
    // Markdown editor removed
        
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

    const handleItemClick = (item: ListItem<ConfigWaypoint | ROIPanelMetadata>) => {
        // Only handle story clicks, not child panel clicks
        if (item.metadata && !('type' in item.metadata)) {
            const story = item.metadata as ConfigWaypoint;
            const index = stories.findIndex(s => s.UUID === story.UUID);
            if (index !== -1) {
                setActiveStory(index);
                
                // Collapse all ROI panels when switching stories to avoid showing
                // annotations from the new story under the old story's panel
                setExpandedROIStories(new Set());
                
                // Note: annotations are imported automatically by the useEffect 
                // that watches activeStoryIndex changes
            }
        }
    };

    // Markdown editing handlers
    // Markdown editor removed

    // Markdown editor removed

    // Handle markdown editor toggle
    // Markdown editor removed

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
    const storyItemActions = (item: ListItem<ConfigWaypoint | ROIPanelMetadata>) => {
        // Only show actions for story items, not child panel items
        if (item.metadata && 'type' in item.metadata) {
            return null;
        }

        const story = item.metadata as ConfigWaypoint;
        const storyId = story.UUID || item.id;
        const isMarkdownExpanded = false;
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

                {/* Text Editor Button (disabled) */}
                <button
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#999',
                        cursor: 'not-allowed',
                        padding: '4px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        opacity: 0.5,
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        // No-op: markdown editor removed
                    }}
                    title="Text editor removed"
                    disabled
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
    const customChildRenderer = (childItem: ListItem<ConfigWaypoint | ROIPanelMetadata>, parentItem: ListItem<ConfigWaypoint | ROIPanelMetadata>) => {
        if (childItem.metadata && 'type' in childItem.metadata) {
            const metadata = childItem.metadata as ROIPanelMetadata;
            
            if (metadata.type === 'roi-panel') {
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
        <div slot="waypoints" className={className}>
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
                itemActions={viewOnly ? null: storyItemActions}
                noHeader={viewOnly}
            />
        </div>
    );
};

export { Stories };
