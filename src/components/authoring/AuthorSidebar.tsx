import type { ReactNode } from "react";
import * as React from "react";
import styled from "styled-components";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import { ChannelGroupsMasterDetail } from "@/components/shared/channel/ChannelGroupsMasterDetail";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import { GlassTabBar } from "@/components/shared/GlassTabBar";
import type { ContrastLimits } from "@/lib/imaging/autoContrast";

type AuthorTab = "images" | "channels" | "story";

const TAB_ORDER: AuthorTab[] = ["images", "channels", "story"];

const TAB_LABELS: Record<AuthorTab, string> = {
  images: "Images",
  channels: "Channels",
  story: "Story",
};

const TAB_ITEMS = TAB_ORDER.map((id) => ({ id, label: TAB_LABELS[id] }));

export const AuthorSidebarHost = styled.div<{ $collapsed: boolean }>`
  grid-column: 1;
  grid-row: 1;
  align-self: stretch;
  position: relative;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 30em;
  display: flex;
  flex-direction: column;
  --author-tab-header-height: 2.35rem;
  transition: transform 0.5s ease;
  transform: ${({ $collapsed }) =>
    $collapsed ? "translateX(-100%)" : "translateX(0)"};
  pointer-events: ${({ $collapsed }) => ($collapsed ? "none" : "auto")};
`;

const Sidebar = styled.div`
  width: 30em;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  pointer-events: all;
`;

const PanelOuter = styled.div`
  --dark-main-glass: color-mix(
    in xyz,
    var(--theme-dark-main-color, navy),
    transparent 60%
  );
  --dim-gray-glass: color-mix(
    in xyz,
    var(--theme-dim-gray-color, black),
    transparent 60%
  );

  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr;
  flex: 1;
  min-height: 0;
  border-radius: 0;
  backdrop-filter: var(--theme-glass-filter, blur(32px));
  background-color: var(--dark-main-glass);
  border: 1px solid var(--theme-glass-edge, rgba(255, 255, 255, 0.5));
  padding-left: 0;
  border-left: none;
  border-top: none;
  overflow: hidden;
`;

const TabRow = styled.div`
  grid-row: 1;
  display: flex;
  align-items: stretch;
  min-width: 0;
  min-height: var(--author-tab-header-height, 2.35rem);
  box-sizing: border-box;
  padding: 0 2.4rem 0 0.25em;
  font-size: 0.8em;
  border-bottom: 1px solid
    color-mix(
      in srgb,
      var(--theme-glass-edge, rgba(255, 255, 255, 0.5)) 40%,
      transparent
    );
`;

const SidebarExpandControl = styled.button<{ $expanded: boolean }>`
  grid-column: 1;
  grid-row: 1;
  z-index: 6;
  justify-self: ${({ $expanded }) => ($expanded ? "end" : "center")};
  align-self: start;
  margin-top: calc((var(--author-tab-header-height, 2.35rem) - 24px) / 2);
  margin-right: ${({ $expanded }) => ($expanded ? "0.35rem" : "0")};
  background-color: color-mix(
    in xyz,
    var(--theme-dark-main-color, navy),
    transparent 60%
  );
  padding: 0;
  border: 1px solid var(--theme-glass-edge, rgba(255, 255, 255, 0.5));
  border-radius: 50%;
  cursor: pointer;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  line-height: 0;
  flex-shrink: 0;
  transition:
    background-color 0.05s ease,
    border-color 0.05s ease;

  &:hover {
    background-color: color-mix(
      in xyz,
      var(--theme-dim-gray-color, black),
      transparent 52%
    );
    border-color: color-mix(
      in srgb,
      var(--theme-light-focus-color, white) 55%,
      var(--theme-glass-edge, rgba(255, 255, 255, 0.5))
    );
  }
`;

const PanelContent = styled.div`
  grid-row: 2;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: #000;
  font-size: 0.75em;
`;

const PanelContentInner = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const PanelSlot = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

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
    <AuthorSidebarHost $collapsed={!expanded}>
      <Sidebar>
        <PanelOuter>
          <TabRow>
            <GlassTabBar<AuthorTab>
              tabs={TAB_ITEMS}
              value={activeTab}
              onChange={setActiveTab}
              aria-label="Author panels"
            />
          </TabRow>
          <PanelContent role="tabpanel">
            <PanelContentInner>
              <PanelSlot>{activePanel}</PanelSlot>
            </PanelContentInner>
          </PanelContent>
        </PanelOuter>
      </Sidebar>
    </AuthorSidebarHost>
  );
}

export const AuthorViewport = styled.div<{ $collapsed: boolean }>`
  --author-collapsed-rail: 2.5rem;
  --author-tab-header-height: 2.35rem;
  font-family: var(--theme-font-family, "lato", sans-serif);
  color: var(--theme-light-contrast-color, white);
  flex: 1;
  height: 100%;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  display: grid;
  grid-template-columns: ${({ $collapsed }) =>
    $collapsed ? "var(--author-collapsed-rail, 2.5rem)" : "30em"} 1fr;
  grid-template-rows: 1fr;
  transition: grid-template-columns 0.5s ease;
`;

export const AuthorViewerRegion = styled.div`
  grid-column: 2;
  grid-row: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
  overflow: hidden;
`;

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
    <AuthorViewport $collapsed={!expanded}>
      <AuthorSidebar
        imagesPanel={props.imagesPanel}
        noLoader={props.noLoader}
        ensureChannelHistograms={props.ensureChannelHistograms}
        ensureChannelGmmContrastLimits={props.ensureChannelGmmContrastLimits}
        expanded={expanded}
      />
      <SidebarExpandControl
        type="button"
        $expanded={expanded}
        title={expanded ? "Collapse panel" : "Expand panel"}
        aria-label={expanded ? "Collapse panel" : "Expand panel"}
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <ChevronIcon direction={expanded ? "left" : "right"} />
      </SidebarExpandControl>
      <AuthorViewerRegion>{props.viewer}</AuthorViewerRegion>
    </AuthorViewport>
  );
}
