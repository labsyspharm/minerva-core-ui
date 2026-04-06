import type { ReactNode } from "react";
import * as React from "react";
import styled, { keyframes } from "styled-components";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import type { ConfigProps } from "@/lib/config";
import { useOverlayStore } from "@/lib/stores";
import { ChannelGroups } from "./ChannelGroups";
import { ChannelGroupsMasterDetail } from "./ChannelGroupsMasterDetail";
import { ChannelLegend } from "./ChannelLegend";

export type ChannelPanelProps = {
  children: ReactNode;
  config: ConfigProps;
  authorMode: boolean;
  hiddenChannel: boolean;
  startExport: () => void;
  channelItemElement: string;
  controlPanelElement: string;
  retrievingMetadata: boolean;
  /** When true, image/data is not loaded yet — hide channel chrome that needs channels. */
  noLoader: boolean;
  setHiddenChannel: (v: boolean) => void;
  /** Switch layout to playback / presentation (optional). */
  enterPlaybackPreview?: () => void;
  /** Incremented after a successful image import. */
  importRevision?: number;
  /** Lazy OME-TIFF URL histogram fetch in progress. */
  histogramsLoading?: boolean;
};

const TextWrap = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
  > div.core {
    color: #eee;
    position: absolute;
    right: 0;
    top: 0;
    width: 220px;
    margin-bottom: 4px;
    transition: transform 0.5s ease 0s;
  }
  > div.core.hide {
    transform: translateX(100%); 
  }
  .dim {
    color: #aaa;
  }
`;

const TextOther = styled.div`
  background-color: transparent;
`;

const channelHistogramsSpin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const ChannelGroupsSlot = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const HistogramsLoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.42);
  z-index: 3;
  font-size: 12px;
  color: #c8c8c8;
  pointer-events: none;
`;

const HistogramsLoadingSpinner = styled.div`
  width: 22px;
  height: 22px;
  border: 2px solid rgba(255, 255, 255, 0.28);
  border-top-color: #9cf;
  border-radius: 50%;
  animation: ${channelHistogramsSpin} 0.65s linear infinite;
`;

// Content layout styles (merged from content.tsx)
const WrapContent = styled.div`
  height: 100%;
  display: grid;
  pointer-events: none;
  grid-template-rows: auto auto 1fr;
  grid-template-columns: 100%;
`;

const WrapCore = styled.div`
  padding: 0.5em;
  grid-column: 1;
  grid-row: 1 / 3;
  overflow: auto;
  scrollbar-color: #888 var(--theme-dim-gray-color);
  pointer-events: all;
  word-wrap: break-word;
  border: 2px solid var(--theme-glass-edge);
  background-color: var(--dark-glass);
  border-radius: var(--radius-0001);
`;

const WrapColumns = styled.div`
  grid-template-columns: auto 1fr;
  display: grid;
  gap: 0.25em;
`;

const Header = styled.h2`
`;

export const ChannelPanel = (props: ChannelPanelProps) => {
  const hide = props.hiddenChannel;
  const hidden = props.retrievingMetadata || props.noLoader;
  const { setActiveChannelGroup } = useOverlayStore();
  const activeChannelGroupId = useOverlayStore((s) => s.activeChannelGroupId);
  const channelVisibilities = useOverlayStore((s) => s.channelVisibilities);
  const setChannelVisibilities = useOverlayStore(
    (s) => s.setChannelVisibilities,
  );
  const Groups = useOverlayStore((s) => s.Groups);
  const SourceChannels = useOverlayStore((s) => s.SourceChannels);

  const groups = Groups.map((group, g) => {
    return {
      g,
      UUID: group.UUID,
      name: group.Name,
      channels: group.GroupChannels.map((channel) => {
        const { SourceChannel, Color } = channel;
        const found = SourceChannels.find(
          ({ UUID }) => SourceChannel.UUID === UUID,
        );
        if (found) {
          const { R, G, B } = Color;
          const hex_color = [R, G, B]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          return {
            r: R,
            g: G,
            b: B,
            lower_range: channel.LowerRange,
            upper_range: channel.UpperRange,
            name: found.Name,
            color: `${hex_color}`,
            group_uuid: group.UUID,
            source_uuid: found.UUID,
            channel_uuid: channel.UUID,
          };
        }
        return null;
      }).filter((x) => x),
    };
  });
  const activeGroup =
    activeChannelGroupId || (groups.length > 0 ? groups[0].UUID : null);
  const group = groups.find(({ UUID }) => UUID === activeGroup);
  const toggleChannel = ({ name }) => {
    setChannelVisibilities(
      Object.fromEntries(
        Object.entries(channelVisibilities).map(([k, v]) => [
          k,
          k === name ? !v : v,
        ]),
      ),
    );
  };

  const legendProps = {
    ...props,
    ...group,
    channelVisibilities,
    toggleChannel,
  };
  const hideClass = ["show core", "hide core"][+hide];

  const total = groups.length;
  const groupProps = { ...props, total };

  const allGroups =
    groups.length || props ? (
      <>
        <Header className="h6">
          <WrapColumns>
            <span>Channel Group</span>
          </WrapColumns>
        </Header>
        <ChannelGroups {...{ ...groupProps, groups }} />
      </>
    ) : null;

  const channelMenu = (
    <div className={hideClass}>
      <WrapContent>
        <WrapCore>
          {allGroups}
          <ChannelLegend {...legendProps} />
        </WrapCore>
      </WrapContent>
    </div>
  );

  const waypointsPanel = props.authorMode ? (
    props.retrievingMetadata ? (
      <div style={{ padding: "1em", color: "#aaa" }}>Loading image data...</div>
    ) : (
      <WaypointsList onEnterPlaybackPreview={props.enterPlaybackPreview} />
    )
  ) : null;

  const channel_list = (
    <ChannelGroupsSlot>
      <ChannelGroupsMasterDetail
        channelItemElement={props.channelItemElement}
        retrievingMetadata={props.retrievingMetadata}
        noLoader={props.noLoader}
      />
      {props.histogramsLoading ? (
        <HistogramsLoadingOverlay
          role="status"
          aria-live="polite"
          aria-label="Loading channel histograms"
        >
          <HistogramsLoadingSpinner aria-hidden />
          Histograms…
        </HistogramsLoadingOverlay>
      ) : null}
    </ChannelGroupsSlot>
  );

  const controlPanelRef = React.useRef<HTMLElement>(null);

  // Switch to Stories tab when loading finishes or importRevision changes.
  const prevImportRevision = React.useRef(props.importRevision ?? 0);
  const wantsStoryTab = React.useRef(false);

  React.useEffect(() => {
    const rev = props.importRevision ?? 0;
    if (rev > prevImportRevision.current) {
      wantsStoryTab.current = true;
    }
    prevImportRevision.current = rev;
  }, [props.importRevision]);

  // Try to apply the tab switch after the element stabilizes post-load.
  // React StrictMode + state changes from image loading can destroy and recreate
  // the custom element, resetting its tab to the default. We wait for the element
  // to settle before switching.
  React.useEffect(() => {
    if (!wantsStoryTab.current) return;
    let cancelled = false;
    const clickStoryTab = (root: Element | ShadowRoot): boolean => {
      const buttons = root.querySelectorAll('button[role="tab"]');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === "Story") {
          (btn as HTMLElement).click();
          return true;
        }
      }
      for (const child of root.querySelectorAll("*")) {
        if (child.shadowRoot) {
          if (clickStoryTab(child.shadowRoot)) return true;
        }
      }
      return false;
    };
    // Wait for React to finish re-renders, then try clicking the tab
    const timer = setTimeout(() => {
      if (cancelled) return;
      const el = controlPanelRef.current;
      if (el?.shadowRoot && clickStoryTab(el.shadowRoot)) {
        wantsStoryTab.current = false;
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const minerva_author_ui = React.createElement(
    props.controlPanelElement,
    { ref: controlPanelRef },
    <>
      {props.children}
      {waypointsPanel}
      <div
        slot="groups"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {channel_list}
      </div>
    </>,
  );

  const content = props.authorMode ? (
    <TextOther>{minerva_author_ui}</TextOther>
  ) : (
    props.children
  );

  return (
    <TextWrap>
      {content}
      {hidden ? "" : channelMenu}
    </TextWrap>
  );
};
