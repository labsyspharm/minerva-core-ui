import { type ReactNode, useEffect, useMemo, useState } from "react";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import {
  type AuthorChannelNav,
  AuthorChannelNavProvider,
} from "@/components/shared/channel/AuthorChannelNav";
import { ChannelGroupsMasterDetail } from "@/components/shared/channel/ChannelGroupsMasterDetail";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import {
  SidebarStripSlot,
  SidebarStripSlotProvider,
} from "@/components/shared/panel/CompactHeader";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import { TabBar } from "@/components/shared/TabBar";
import { dragHasFiles } from "@/lib/imaging/importFileKind";
import { useAppStore } from "@/lib/stores/appStore";
import { useWaypointCanvasShapes } from "@/lib/waypoints/useWaypointCanvasShapes";
import styles from "./AuthorSidebar.module.css";

type AuthorTab = "images" | "channels" | "story";

const TAB_ORDER: AuthorTab[] = ["images", "channels", "story"];

const TAB_LABELS: Record<AuthorTab, string> = {
  images: "Images",
  channels: "Channels",
  story: "Story",
};

const TAB_ITEMS = TAB_ORDER.map((id) => ({ id, label: TAB_LABELS[id] }));

export type AuthorSidebarProps = {
  imagesPanel: ReactNode;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  contrastEditable?: boolean;
  expanded: boolean;
};

export function AuthorSidebar(props: AuthorSidebarProps) {
  // From the player's "Edit this story", start where that waypoint is edited.
  const [activeTab, setActiveTab] = useState<AuthorTab>(() =>
    useAppStore.getState().editWaypointOnOpen ? "story" : "images",
  );
  const { expanded } = props;

  // Annotations show on every tab, not only once Story has been opened.
  useWaypointCanvasShapes(activeTab === "story");

  // A waypoint to open (e.g. one annotations were just imported into) is on the Story tab.
  const editWaypointOnOpen = useAppStore((s) => s.editWaypointOnOpen);
  useEffect(() => {
    if (editWaypointOnOpen) setActiveTab("story");
  }, [editWaypointOnOpen]);

  // The Images panel takes file drops; bring it up when one enters the window.
  useEffect(() => {
    if (activeTab === "images") return;
    const onFileDrag = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      // Keep the browser from opening a file dropped before the panel mounts.
      e.preventDefault();
      setActiveTab("images");
    };
    const types = ["dragenter", "dragover", "drop"] as const;
    for (const t of types) window.addEventListener(t, onFileDrag, true);
    return () => {
      for (const t of types) window.removeEventListener(t, onFileDrag, true);
    };
  }, [activeTab]);

  const channelNav = useMemo<AuthorChannelNav>(
    () => ({
      ensureChannelHistograms: props.ensureChannelHistograms,
    }),
    [props.ensureChannelHistograms],
  );

  const otherPanel =
    activeTab === "channels" ? (
      <ChannelGroupsMasterDetail
        noLoader={props.noLoader}
        contrastEditable={props.contrastEditable}
      />
    ) : activeTab === "story" ? (
      <WaypointsList />
    ) : null;

  return (
    <AuthorChannelNavProvider value={channelNav}>
      <SidebarStripSlotProvider>
        <div
          className={[
            styles.sidebarHost,
            expanded ? null : styles.sidebarHostCollapsed,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.panelOuter}>
            <div className={`${styles.tabRow} ${minervaTheme.strip}`}>
              <TabBar<AuthorTab>
                tabs={TAB_ITEMS}
                value={activeTab}
                onChange={setActiveTab}
                aria-label="Author panels"
              />
              <SidebarStripSlot className={styles.stripActions} />
            </div>
            <div className={styles.panelContent} role="tabpanel">
              {/* Stay mounted on other tabs so a drop there still reaches Upload. */}
              <div
                className={styles.imagesMount}
                hidden={activeTab !== "images"}
              >
                {props.imagesPanel}
              </div>
              {otherPanel}
            </div>
          </div>
        </div>
      </SidebarStripSlotProvider>
    </AuthorChannelNavProvider>
  );
}

export type AuthorViewportProps = {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
};

export function AuthorViewport(props: AuthorViewportProps) {
  const { collapsed, children, className } = props;
  return (
    <div
      className={[
        styles.viewport,
        collapsed ? styles.viewportCollapsed : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export type AuthorViewerRegionProps = {
  children: ReactNode;
  className?: string;
};

export function AuthorViewerRegion(props: AuthorViewerRegionProps) {
  return (
    <div
      className={[styles.viewerRegion, props.className]
        .filter(Boolean)
        .join(" ")}
    >
      {props.children}
    </div>
  );
}

export type AuthorViewProps = {
  imagesPanel: ReactNode;
  viewer: ReactNode;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  contrastEditable?: boolean;
  /** Story preview pane shown instead of the sidebar; the viewer stays mounted. */
  previewNav?: ReactNode;
  /**
   * Keep `previewNav` mounted (playback effects) but show the sidebar.
   * Used when the pane renders nothing, e.g. one waypoint and no content.
   */
  previewNavHidden?: boolean;
};

export function AuthorView(props: AuthorViewProps) {
  const [expanded, setExpanded] = useState(true);
  const hasPreview = props.previewNav != null;
  const previewing = hasPreview && !props.previewNavHidden;

  return (
    <AuthorViewport
      collapsed={!expanded}
      className={previewing ? styles.viewportPreview : undefined}
    >
      {hasPreview ? (
        <div
          className={previewing ? styles.previewNav : styles.previewNavParked}
        >
          {props.previewNav}
        </div>
      ) : null}
      {previewing ? null : (
        <>
          <AuthorSidebar
            imagesPanel={props.imagesPanel}
            noLoader={props.noLoader}
            ensureChannelHistograms={props.ensureChannelHistograms}
            contrastEditable={props.contrastEditable}
            expanded={expanded}
          />
          <PanelIconButton
            className={[
              styles.expandControl,
              expanded ? styles.expandControlExpanded : null,
            ]
              .filter(Boolean)
              .join(" ")}
            title={expanded ? "Collapse panel" : "Expand panel"}
            aria-label={expanded ? "Collapse panel" : "Expand panel"}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            <ChevronIcon direction={expanded ? "left" : "right"} />
          </PanelIconButton>
        </>
      )}
      <AuthorViewerRegion>{props.viewer}</AuthorViewerRegion>
    </AuthorViewport>
  );
}
