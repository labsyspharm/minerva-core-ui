import * as React from "react";
import styles from "./index.module.css";

// Types
import type { Story } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type Props = HashContext & {
    stories: Story[];
};

const Stories = (props: Props) => {
    const { hash, stories } = props;

    const className = [
        styles.center, styles.black
    ].join(" ");

    return (
        <div slot="stories" className={className}>
            {/* Stories panel content */}
            SIMONSIMON
            <div className={styles.storiesContainer}>
                <h3 style={{ color: 'white', margin: '0 0 10px 0' }}>Stories</h3>
                {stories.map((story, index) => (
                    <div 
                        key={index}
                        className={`${styles.storyItem} ${hash.s === index ? styles.active : ''}`}
                    >
                        <div>Story {index + 1}</div>
                        <div style={{ fontSize: '0.9em', opacity: 0.7 }}>
                            {story.waypoints?.length || 0} waypoints
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export { Stories };
