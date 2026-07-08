import type { ReactNode } from "react";
import * as React from "react";
import styled from "styled-components";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import { ChannelGroupsMasterDetail } from "@/components/shared/channel/ChannelGroupsMasterDetail";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";

type AuthorTab = "images" | "channels" | "story";

const TAB_ORDER: AuthorTab[] = ["images", "channels", "story"];

const TAB_LABELS: Record<AuthorTab, string> = {
  images: "Images",
  channels: "Channels",
  story: "Story",
};

const TAB_DESCRIPTIONS: Record<AuthorTab, string> = {
  images: "Image Sources",
  channels: "Channel Groups",
  story: "",
};

export const AuthorSidebarHost = styled.div<{ $collapsed: boolean }>`
  grid-column: 1;
  grid-row: 1;
  min-height: 0;
  width: 30em;
  transition: transform 0.5s ease;
  transform: ${({ $collapsed }) =>
    $collapsed ? "translate(-27em, 0)" : "translate(0, 0)"};
`;

const Sidebar = styled.div<{ $collapsed: boolean }>`
  width: 30em;
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr;
  pointer-events: all;
  transition: transform 0.5s ease;
  transform: ${({ $collapsed }) =>
    $collapsed ? "translate(-3em, 0)" : "translate(0, 0)"};
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
  grid-template-rows: auto auto 1fr;
  grid-template-columns: 1fr;
  height: 100%;
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
  padding-top: calc(var(--theme-gap-tiny, 0.3em) * 2);
  padding-bottom: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  min-width: 0;
  font-size: 0.75em;
`;

const TabStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 0;
  padding-inline-end: calc(var(--theme-gap-tiny, 0.3em) * 2);
  gap: var(--theme-gap-tiny, 0.3em);
`;

const TabCell = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;

  &::before,
  &::after {
    width: var(--theme-gap-tiny, 0.3em);
    content: "";
    box-shadow: inset 0em -1px var(--theme-glass-edge, rgba(255, 255, 255, 0.5));
  }

  &:first-child::before,
  &:last-child::after {
    width: 0;
  }
`;

const TabButton = styled.button<{ $active?: boolean }>`
  background-color: color-mix(
    in xyz,
    var(--theme-dark-main-color, navy),
    transparent 60%
  );
  color: inherit;
  border: none;
  padding: 0.45em 0.6em;
  cursor: pointer;
  font: inherit;
  font-size: inherit;
  width: 100%;
  text-align: center;

  ${({ $active }) =>
    $active
      ? `
    color: var(--theme-light-focus-color, white);
    box-shadow: inset 1px 1px 1px var(--theme-glass-edge, rgba(255, 255, 255, 0.5));
    text-shadow: var(--theme-dark-focus-color, black) 0 0 4px;
    background-color: color-mix(
      in xyz,
      var(--theme-dim-gray-color, black),
      transparent 60%
    );
  `
      : ""}
`;

const ExpandButtonWrap = styled.div<{ $expanded: boolean }>`
  grid-row: 1;
  align-self: start;
  justify-self: end;
  margin: 0.3em 0.4em 0 0;
  z-index: 1;

  button {
    background-color: ${({ $expanded }) =>
      $expanded
        ? "color-mix(in xyz, var(--theme-dark-main-color, navy), transparent 60%)"
        : "var(--theme-dark-accept-color, darkslategray)"};
    padding: var(--theme-gap-tiny, 0.3em);
    transform: ${({ $expanded }) =>
      $expanded ? "scaleX(1) rotate(90deg)" : "scaleX(-1) rotate(90deg)"};
    border: 1px solid var(--theme-glass-edge, rgba(255, 255, 255, 0.5));
    border-radius: 50%;
    cursor: pointer;
    color: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    transition: 0.05s;
  }
`;

const PanelDescription = styled.h2`
  grid-row: 2;
  margin: 0;
  padding: var(--theme-gap-tiny, 0.3em) 0 0 1em;
  font-size: 0.75em;
  font-weight: 600;
`;

const PanelContent = styled.div`
  grid-row: 3;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: color-mix(
    in xyz,
    var(--theme-dim-gray-color, black),
    transparent 60%
  );
  font-size: 0.75em;
  border-top: none;
`;

const PanelContentInner = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--theme-gap-tiny, 0.3em);
`;

const ChannelsPanelSlot = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ExpandChevron = styled(ChevronDownIcon)`
  width: 18px;
  height: 18px;
  display: block;
`;

export type AuthorSidebarProps = {
  imagesPanel: ReactNode;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

export function AuthorSidebar(props: AuthorSidebarProps) {
  const [activeTab, setActiveTab] = React.useState<AuthorTab>("images");
  const { expanded, onExpandedChange } = props;

  const activePanel =
    activeTab === "images" ? (
      props.imagesPanel
    ) : activeTab === "channels" ? (
      <ChannelsPanelSlot>
        <ChannelGroupsMasterDetail
          noLoader={props.noLoader}
          ensureChannelHistograms={props.ensureChannelHistograms}
        />
      </ChannelsPanelSlot>
    ) : (
      <WaypointsList />
    );

  const description = TAB_DESCRIPTIONS[activeTab];

  return (
    <AuthorSidebarHost $collapsed={!expanded}>
      <Sidebar $collapsed={!expanded}>
        <PanelOuter>
          <TabRow>
            <TabStrip role="tablist">
              {TAB_ORDER.map((tab) => (
                <TabCell key={tab}>
                  <TabButton
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    $active={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                  >
                    {TAB_LABELS[tab]}
                  </TabButton>
                </TabCell>
              ))}
            </TabStrip>
            <ExpandButtonWrap $expanded={expanded}>
              <button
                type="button"
                title={expanded ? "Collapse panel" : "Expand panel"}
                aria-label={expanded ? "Collapse panel" : "Expand panel"}
                aria-expanded={expanded}
                onClick={() => onExpandedChange(!expanded)}
              >
                <ExpandChevron aria-hidden />
              </button>
            </ExpandButtonWrap>
          </TabRow>
          {description ? (
            <PanelDescription>{description}</PanelDescription>
          ) : null}
          <PanelContent role="tabpanel">
            <PanelContentInner>{activePanel}</PanelContentInner>
          </PanelContent>
        </PanelOuter>
      </Sidebar>
    </AuthorSidebarHost>
  );
}

export const AuthorViewport = styled.div<{ $collapsed: boolean }>`
  font-family: var(--theme-font-family, "lato", sans-serif);
  color: var(--theme-light-contrast-color, white);
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: ${({ $collapsed }) => ($collapsed ? "3em" : "30em")} 1fr;
  grid-template-rows: minmax(0, 1fr);
  transition: grid-template-columns 0.5s ease;
`;

export const AuthorViewerRegion = styled.div`
  grid-column: 2;
  grid-row: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
`;

export type AuthorViewProps = {
  imagesPanel: ReactNode;
  viewer: ReactNode;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
};

export function AuthorView(props: AuthorViewProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <AuthorViewport $collapsed={!expanded}>
      <AuthorSidebar
        imagesPanel={props.imagesPanel}
        noLoader={props.noLoader}
        ensureChannelHistograms={props.ensureChannelHistograms}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
      <AuthorViewerRegion>{props.viewer}</AuthorViewerRegion>
    </AuthorViewport>
  );
}
