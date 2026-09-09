import { type ReactNode, useCallback, useMemo, useState } from "react";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import type { ChannelEditFocus } from "@/components/shared/channel/AuthorChannelNav";
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
  const [activeTab, setActiveTab] = useState<AuthorTab>("images");
  const [channelEditFocus, setChannelEditFocus] =
    useState<ChannelEditFocus | null>(null);
  const { expanded } = props;

  const openChannelEditor = useCallback((focus: ChannelEditFocus) => {
    setChannelEditFocus(focus);
    setActiveTab("channels");
  }, []);

  const channelNav = useMemo<AuthorChannelNav>(
    () => ({
      openChannelEditor,
      ensureChannelHistograms: props.ensureChannelHistograms,
    }),
    [openChannelEditor, props.ensureChannelHistograms],
  );

  const activePanel =
    activeTab === "images" ? (
      props.imagesPanel
    ) : activeTab === "channels" ? (
      <ChannelGroupsMasterDetail
        noLoader={props.noLoader}
        ensureChannelHistograms={props.ensureChannelHistograms}
        contrastEditable={props.contrastEditable}
        editFocus={channelEditFocus}
        onEditFocusConsumed={() => setChannelEditFocus(null)}
      />
    ) : (
      <WaypointsList />
    );

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
              {activePanel}
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
};

export function AuthorView(props: AuthorViewProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <AuthorViewport collapsed={!expanded}>
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
      <AuthorViewerRegion>{props.viewer}</AuthorViewerRegion>
    </AuthorViewport>
  );
}
