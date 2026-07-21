import type { ReactNode } from "react";
import * as React from "react";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import { ChannelGroupsMasterDetail } from "@/components/shared/channel/ChannelGroupsMasterDetail";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import { GlassTabBar } from "@/components/shared/GlassTabBar";
import type { ContrastLimits } from "@/lib/imaging/autoContrast";
import styles from "./AuthorSidebar.module.css";

type AuthorTab = "images" | "channels" | "story";

const TAB_ORDER: AuthorTab[] = ["images", "channels", "story"];

const TAB_LABELS: Record<AuthorTab, string> = {
  images: "Images",
  channels: "Channels",
  story: "Story",
};

const TAB_ITEMS = TAB_ORDER.map((id) => ({ id, label: TAB_LABELS[id] }));

export type AuthorSidebarHostProps = {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
};

/** Thin layout wrapper (formerly styled); kept for stable export API. */
export function AuthorSidebarHost(props: AuthorSidebarHostProps) {
  const { collapsed, children, className } = props;
  return (
    <div
      className={[
        styles.sidebarHost,
        collapsed ? styles.sidebarHostCollapsed : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export type AuthorSidebarProps = {
  imagesPanel: ReactNode;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  ensureChannelGmmContrastLimits?: (
    channelIds: string[],
    opts?: { overwriteExistingLimits?: boolean },
  ) => Promise<Map<string, ContrastLimits>>;
  expanded: boolean;
};

export function AuthorSidebar(props: AuthorSidebarProps) {
  const [activeTab, setActiveTab] = React.useState<AuthorTab>("images");
  const { expanded } = props;

  const activePanel =
    activeTab === "images" ? (
      props.imagesPanel
    ) : activeTab === "channels" ? (
      <ChannelGroupsMasterDetail
        noLoader={props.noLoader}
        ensureChannelHistograms={props.ensureChannelHistograms}
        ensureChannelGmmContrastLimits={props.ensureChannelGmmContrastLimits}
      />
    ) : (
      <WaypointsList />
    );

  return (
    <AuthorSidebarHost collapsed={!expanded}>
      <div className={styles.sidebar}>
        <div className={styles.panelOuter}>
          <div className={styles.tabRow}>
            <GlassTabBar<AuthorTab>
              tabs={TAB_ITEMS}
              value={activeTab}
              onChange={setActiveTab}
              aria-label="Author panels"
            />
          </div>
          <div className={styles.panelContent} role="tabpanel">
            <div className={styles.panelContentInner}>
              <div className={styles.panelSlot}>{activePanel}</div>
            </div>
          </div>
        </div>
      </div>
    </AuthorSidebarHost>
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
  ensureChannelGmmContrastLimits?: (
    channelIds: string[],
    opts?: { overwriteExistingLimits?: boolean },
  ) => Promise<Map<string, ContrastLimits>>;
};

export function AuthorView(props: AuthorViewProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <AuthorViewport collapsed={!expanded}>
      <AuthorSidebar
        imagesPanel={props.imagesPanel}
        noLoader={props.noLoader}
        ensureChannelHistograms={props.ensureChannelHistograms}
        ensureChannelGmmContrastLimits={props.ensureChannelGmmContrastLimits}
        expanded={expanded}
      />
      <button
        type="button"
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
      </button>
      <AuthorViewerRegion>{props.viewer}</AuthorViewerRegion>
    </AuthorViewport>
  );
}
