import type { ReactNode } from "react";
import * as React from "react";
import { classViewFor, shownClassRows } from "@/lib/featureTable";
import {
  useFeatureTableIngestEpoch,
  useFeatureTableLutEpoch,
} from "@/lib/featureTable/hooks";
import {
  applyStackVisibilities,
  isStackVisible,
  sourceChannelInAnyGroup,
  visibilitiesForLegendRow,
} from "@/lib/imaging/channelCompositor";
import {
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isMaskChannel,
} from "@/lib/imaging/channelKind";
import {
  effectiveMaskVisualizationForSource,
  rgbToHex,
} from "@/lib/imaging/sourceChannelStyle";
import { legendClassKey, useAppStore } from "@/lib/stores/appStore";
import type { ChannelGroup, Image } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { useActiveWaypoint } from "@/lib/stores/useActiveWaypoint";
import { ChannelGroups } from "./ChannelGroups";
import {
  ChannelLegend,
  ClassLegend,
  type ClassLegendSection,
  type LegendChannel,
  type LegendEntry,
  type LegendSection,
  legendChannelFromLayer,
  legendChannelFromSource,
  legendLabelForImage,
} from "./ChannelLegend";
import styles from "./ChannelPanel.module.css";

export type ChannelPanelProps = {
  children: ReactNode;
  hiddenChannel: boolean;
  noLoader: boolean;
  /** Playback override so the legend matches export colors without writing the document. */
  images?: Image[];
};

export const ChannelPanel = (props: ChannelPanelProps) => {
  const hide = props.hiddenChannel;
  const hidden = props.noLoader;
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const setActiveChannelGroup = useAppStore((s) => s.setActiveChannelGroup);
  const channelVisibilities = useAppStore((s) => s.channelVisibilities);
  const channelGroupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const setChannelGroupRowVisibilities = useAppStore(
    (s) => s.setChannelGroupRowVisibilities,
  );
  const docChannelGroups = useDocumentStore((s) => s.channelGroups);
  const storeImages = useDocumentStore((s) => s.images);
  const images = props.images ?? storeImages;
  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const legendSections = React.useMemo((): LegendSection[] => {
    const activeGroup = activeChannelGroupId
      ? docChannelGroups.find((g) => g.id === activeChannelGroupId)
      : undefined;
    const hasStackVisibilityMap = Object.keys(channelVisibilities).length > 0;
    const sections: LegendSection[] = [];

    for (const im of images) {
      const entries: LegendEntry[] = [];
      const imageSources = sourceChannels.filter(
        (sc) =>
          sc.imageId === im.id && (isImageChannel(sc) || isMaskChannel(sc)),
      );

      if (activeGroup) {
        const groupChannels: LegendChannel[] = [];
        for (const gc of activeGroup.channels) {
          const sc = findSourceChannel(sourceChannels, gc.channelId);
          if (!sc || sc.imageId !== im.id) continue;
          groupChannels.push(legendChannelFromLayer(sc, gc, activeGroup.id));
        }

        const overlayChannels: LegendChannel[] = [];
        if (hasStackVisibilityMap) {
          for (const sc of imageSources) {
            if (sourceChannelInAnyGroup(docChannelGroups, sc.id)) continue;
            if (!isStackVisible(channelVisibilities, sc.id)) continue;
            overlayChannels.push(legendChannelFromSource(sc, sourceChannels));
          }
        }

        for (const c of groupChannels) {
          entries.push({ type: "channel", channel: c });
        }
        if (groupChannels.length > 0 && overlayChannels.length > 0) {
          entries.push({ type: "divider" });
        }
        for (const c of overlayChannels) {
          entries.push({ type: "channel", channel: c });
        }
      } else {
        let defaultIntensitySeen = 0;
        for (const sc of imageSources) {
          const visible = hasStackVisibilityMap
            ? isStackVisible(channelVisibilities, sc.id)
            : isMaskChannel(sc) ||
              defaultIntensitySeen < DEFAULT_VISIBLE_INTENSITY_CHANNELS;
          if (isImageChannel(sc)) defaultIntensitySeen += 1;
          if (!visible) continue;
          entries.push({
            type: "channel",
            channel: legendChannelFromSource(sc, sourceChannels),
          });
        }
      }

      if (entries.length === 0) continue;
      sections.push({
        imageId: im.id,
        label: legendLabelForImage(im.basename ?? ""),
        entries,
      });
    }
    return sections;
  }, [
    images,
    sourceChannels,
    docChannelGroups,
    activeChannelGroupId,
    channelVisibilities,
  ]);

  const featureTables = useDocumentStore((s) => s.featureTables);
  const activeWaypoint = useActiveWaypoint();
  const hiddenLegendClasses = useAppStore((s) => s.hiddenLegendClasses);
  const toggleLegendClass = useAppStore((s) => s.toggleLegendClass);
  const clearLegendClasses = useAppStore((s) => s.clearLegendClasses);
  // Legend toggles are for the playback session; authoring hides the legend.
  React.useEffect(() => {
    if (hide) clearLegendClasses();
  }, [hide, clearLegendClasses]);
  const ingestEpoch = useFeatureTableIngestEpoch();
  const lutEpoch = useFeatureTableLutEpoch();
  const classSections = React.useMemo((): ClassLegendSection[] => {
    void ingestEpoch;
    void lutEpoch;
    const inLegend = new Set(
      legendSections.flatMap((section) =>
        section.entries.flatMap((e) =>
          e.type === "channel" ? [e.channel.source_uuid] : [],
        ),
      ),
    );
    const out: ClassLegendSection[] = [];
    for (const featureTable of featureTables) {
      if (!inLegend.has(featureTable.sourceChannelId)) continue;
      const sc = findSourceChannel(
        sourceChannels,
        featureTable.sourceChannelId,
      );
      if (!sc || !isMaskChannel(sc)) continue;
      const viz = effectiveMaskVisualizationForSource(
        sc,
        docChannelGroups,
        activeChannelGroupId,
      );
      const rows = shownClassRows(
        featureTable,
        classViewFor(activeWaypoint, sc.id),
        viz.colorSeed ?? 0,
        activeWaypoint?.id,
      );
      if (!rows) continue;
      const hiddenNames = new Set(
        hiddenLegendClasses[legendClassKey(activeWaypoint?.id, sc.id)],
      );
      out.push({
        channelId: sc.id,
        label: sc.name,
        showSwatches: viz.color !== "white",
        rows: rows.map((row) => ({
          name: row.name,
          color: rgbToHex(row.color),
          hidden: hiddenNames.has(row.name),
        })),
      });
    }
    return out;
  }, [
    legendSections,
    featureTables,
    sourceChannels,
    docChannelGroups,
    activeChannelGroupId,
    activeWaypoint,
    hiddenLegendClasses,
    ingestEpoch,
    lutEpoch,
  ]);

  const groups = useDocumentStore((s) => s.channelGroups);
  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setGroupNames = useAppStore((s) => s.setGroupNames);

  const syncGroupState = React.useCallback(
    (newGroups: ChannelGroup[]) => {
      setChannelGroups(newGroups);
      setGroupNames(
        Object.fromEntries(newGroups.map(({ name, id }) => [id, name])),
      );
    },
    [setChannelGroups, setGroupNames],
  );

  const updateChannel = React.useCallback(
    (groupId, channelId, newChannel) => {
      const copy_name = (g) => `${g.name} copy`;
      const is_copied = (g) => " copy" === g.name.slice(-5);
      const id_group = groups.find(({ id }) => groupId === id);
      if (!id_group) return;

      const existingCopy = groups.find(
        ({ name }) => name === copy_name(id_group),
      );
      const group = existingCopy || id_group;

      const withColor = (g) => ({
        ...g,
        channels: g.channels.map((gc) =>
          gc.channelId === channelId ? { ...gc, ...newChannel } : gc,
        ),
      });

      if (is_copied(group)) {
        syncGroupState(
          groups.map((g) => (g.id === group.id ? withColor(g) : g)),
        );
        setActiveChannelGroup(group.id);
        return;
      }

      const colored = withColor(group);
      const prevVis = useAppStore.getState().channelGroupRowVisibilities;
      const nextVis = { ...prevVis };
      const channels = colored.channels.map((gc) => {
        const id = crypto.randomUUID();
        // Missing ids count as visible, same as `isGroupRowVisible`.
        nextVis[id] = prevVis[gc.id] !== false;
        return { ...gc, id };
      });
      const new_group = {
        ...colored,
        name: copy_name(group),
        id: crypto.randomUUID(),
        channels,
      };
      syncGroupState([...groups, new_group]);
      setChannelGroupRowVisibilities(nextVis);
      setActiveChannelGroup(new_group.id);
    },
    [
      groups,
      syncGroupState,
      setActiveChannelGroup,
      setChannelGroupRowVisibilities,
    ],
  );

  const toggleChannel = (c: LegendChannel) => {
    const rowId = c.group_uuid ? c.channel_uuid : undefined;
    const stackVisibilities =
      Object.keys(channelVisibilities).length > 0
        ? channelVisibilities
        : applyStackVisibilities(sourceChannels, {}, { kind: "fresh" });
    const next = visibilitiesForLegendRow({
      sourceChannels,
      channelGroups: docChannelGroups,
      stackVisibilities: channelVisibilities,
      groupRowVisibilities: channelGroupRowVisibilities,
      sourceId: c.source_uuid,
      rowId,
      visible: rowId
        ? !(channelGroupRowVisibilities[rowId] ?? true)
        : !isStackVisible(stackVisibilities, c.source_uuid),
    });
    if (next.channelGroupRowVisibilities) {
      setChannelGroupRowVisibilities(next.channelGroupRowVisibilities);
    }
    if (next.channelVisibilities) {
      setChannelVisibilities(next.channelVisibilities);
    }
  };

  const hideClass = [hide ? styles.hide : "", styles.core].join(" ");

  const allGroups =
    docChannelGroups.length > 0 ? (
      <>
        <div className={styles.overlaySectionLabel}>Channel groups</div>
        <ChannelGroups
          channelGroups={docChannelGroups.map((g) => ({
            id: g.id,
            name: g.name,
          }))}
        />
      </>
    ) : null;

  const channelMenu = (
    <div className={hideClass}>
      <div className={styles.wrapContent}>
        <div className={styles.wrapCore}>
          {allGroups}
          <ChannelLegend
            sections={legendSections}
            channelVisibilities={channelVisibilities}
            channelGroupRowVisibilities={channelGroupRowVisibilities}
            toggleChannel={toggleChannel}
            updateChannel={updateChannel}
          />
          <ClassLegend
            sections={classSections}
            onToggle={(channelId, name) =>
              toggleLegendClass(activeWaypoint?.id, channelId, name)
            }
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.textWrap}>
      {props.children}
      {hidden ? "" : channelMenu}
    </div>
  );
};
