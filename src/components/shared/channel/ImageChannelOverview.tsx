import type { CSSProperties } from "react";
import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import { ChannelEditor } from "@/components/shared/channel/ChannelEditorPopover";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import {
  defaultVisibilitiesForSources,
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import {
  buildImageChannelOverview,
  type ImageChannelChip,
} from "@/lib/imaging/imageChannelOverview";
import {
  getStackPalettePendingIds,
  subscribeStackPalettePending,
} from "@/lib/imaging/psudoPalette";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image } from "@/lib/stores/documentSchema";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import styles from "./ImageChannelOverview.module.css";

function chipAriaLabel(chip: ImageChannelChip): string {
  return chip.visible ? `Hide ${chip.name}` : `Show ${chip.name}`;
}

function ChipButton(props: {
  chip: ImageChannelChip;
  open: boolean;
  dim: boolean;
  colorPending: boolean;
  onClick: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
}) {
  const { chip, open, dim, colorPending, onClick, onOpenEditor } = props;
  const pendingLabel = `Assigning color to ${chip.name}`;
  return (
    <div
      className={[
        styles.chipCell,
        chip.visible && chip.hex ? styles.chipOn : null,
        !chip.visible && chip.hex ? styles.chipOutlined : null,
        chip.hex ? null : styles.chipUnassigned,
        colorPending ? minervaTheme.busyOverlay : null,
        dim ? styles.chipDim : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        chip.hex ? ({ "--ch": `#${chip.hex}` } as CSSProperties) : undefined
      }
      aria-busy={colorPending || undefined}
    >
      <button
        type="button"
        className={`${minervaTheme.focusRing} ${styles.chip}`}
        title={colorPending ? pendingLabel : chip.name}
        aria-label={colorPending ? pendingLabel : chipAriaLabel(chip)}
        aria-pressed={chip.visible}
        onClick={() => onClick(chip)}
      >
        {chip.name}
      </button>
      <button
        type="button"
        className={`${minervaTheme.focusRing} ${styles.chipMenu}`}
        title={`Edit ${chip.name}`}
        aria-label={`Edit ${chip.name}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onOpenEditor(chip);
        }}
      >
        <ChevronIcon direction={open ? "up" : "down"} />
      </button>
    </div>
  );
}

/** Keep in sync with `repeat(5, …)` on `.chipWrap`. */
const CHIP_COLS = 5;

function ChipGrid(props: {
  chips: ImageChannelChip[];
  openChip: ImageChannelChip | null;
  onChip: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
}) {
  const { chips, openChip } = props;
  const pendingIds = useSyncExternalStore(
    subscribeStackPalettePending,
    getStackPalettePendingIds,
    getStackPalettePendingIds,
  );
  const openIndex = openChip
    ? chips.findIndex((c) => c.key === openChip.key)
    : -1;
  const rowEnd =
    openIndex < 0
      ? -1
      : Math.min(
          chips.length - 1,
          openIndex - (openIndex % CHIP_COLS) + CHIP_COLS - 1,
        );
  return (
    <div className={styles.chipWrap}>
      {chips.map((chip, i) => (
        <Fragment key={chip.key}>
          <ChipButton
            chip={chip}
            open={openChip?.key === chip.key}
            dim={openChip != null && openChip.key !== chip.key}
            colorPending={pendingIds.includes(chip.sourceId)}
            onClick={props.onChip}
            onOpenEditor={props.onOpenEditor}
          />
          {i === rowEnd && openChip ? (
            <div className={styles.editor}>
              <ChannelEditor chip={openChip} />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function GroupStrip(props: {
  name: string;
  chips: ImageChannelChip[];
  openChip: ImageChannelChip | null;
  onChip: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
  allVisible?: boolean;
  onToggleVisibility?: () => void;
}) {
  const visLabel = props.allVisible
    ? `Hide every channel in ${props.name}`
    : `Show every channel in ${props.name}`;
  return (
    <div className={styles.groupCard}>
      <div className={styles.groupHeader}>
        {props.onToggleVisibility ? (
          <ChannelVisibilitySwatch
            visible={Boolean(props.allVisible)}
            title={visLabel}
            ariaLabel={visLabel}
            onClick={props.onToggleVisibility}
          />
        ) : null}
        <div className={styles.groupLabel}>{props.name}</div>
      </div>
      <ChipGrid
        chips={props.chips}
        openChip={props.openChip}
        onChip={props.onChip}
        onOpenEditor={props.onOpenEditor}
      />
    </div>
  );
}

export function ImageChannelOverviewCard(props: { image: Image }) {
  const { image } = props;
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const stackVisibilities = useAppStore((s) => s.channelVisibilities);
  const groupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const setChannelGroupRowVisibilities = useAppStore(
    (s) => s.setChannelGroupRowVisibilities,
  );
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const nav = useAuthorChannelNav();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const allSourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const filledStackVis = useMemo(
    () => defaultVisibilitiesForSources(allSourceChannels, stackVisibilities),
    [allSourceChannels, stackVisibilities],
  );
  const model = useMemo(
    () =>
      buildImageChannelOverview({
        image,
        channelGroups,
        allSourceChannels,
        stackVisibilities: filledStackVis,
        groupRowVisibilities,
        activeChannelGroupId,
      }),
    [
      image,
      channelGroups,
      allSourceChannels,
      filledStackVis,
      groupRowVisibilities,
      activeChannelGroupId,
    ],
  );

  const openChip =
    openKey == null
      ? null
      : ([...model.groups.flatMap((g) => g.chips), ...model.allChannels].find(
          (c) => c.key === openKey,
        ) ?? null);

  const onOpenEditor = (chip: ImageChannelChip) => {
    setOpenKey((cur) => (cur === chip.key ? null : chip.key));
  };

  const onGroupChip = (chip: ImageChannelChip) => {
    if (!chip.groupRowId) return;
    const vis = useAppStore.getState().channelGroupRowVisibilities;
    if (chip.visible) {
      setChannelGroupRowVisibilities({
        ...vis,
        [chip.groupRowId]: false,
      });
      return;
    }
    if (!isGroupRowVisible(vis, chip.groupRowId)) {
      setChannelGroupRowVisibilities({
        ...vis,
        [chip.groupRowId]: true,
      });
    }
    void nav?.ensureChannelHistograms?.([chip.sourceId]).catch(() => undefined);
  };

  const onAllChannelsChip = (chip: ImageChannelChip) => {
    if (chip.groupRowId) {
      const vis = useAppStore.getState().channelGroupRowVisibilities;
      const groups = useDocumentStore.getState().channelGroups;
      const nextOn = !chip.visible;
      const next = { ...vis };
      for (const g of groups) {
        for (const gc of g.channels) {
          if (gc.channelId === chip.sourceId) next[gc.id] = nextOn;
        }
      }
      setChannelGroupRowVisibilities(next);
      if (nextOn) {
        void nav
          ?.ensureChannelHistograms?.([chip.sourceId])
          .catch(() => undefined);
      }
      return;
    }
    const vis = defaultVisibilitiesForSources(
      flattenImageChannelsInDocumentOrder(useDocumentStore.getState().images),
      useAppStore.getState().channelVisibilities,
    );
    const turningOn = !isStackVisible(vis, chip.sourceId);
    setChannelVisibilities({ ...vis, [chip.sourceId]: turningOn });
    if (!turningOn) return;
    void nav?.ensureChannelHistograms?.([chip.sourceId]).catch(() => undefined);
  };

  if (image.channels.length === 0) return null;

  return (
    <div className={styles.root}>
      {model.groups.map((group) => (
        <GroupStrip
          key={group.id}
          name={group.name}
          chips={group.chips}
          openChip={openChip}
          allVisible={group.allVisible}
          onChip={onGroupChip}
          onOpenEditor={onOpenEditor}
          onToggleVisibility={() => {
            const docGroup = channelGroups.find((g) => g.id === group.id);
            if (!docGroup || docGroup.channels.length === 0) return;
            const allOn = docGroup.channels.every((gc) =>
              isGroupRowVisible(groupRowVisibilities, gc.id),
            );
            const next = { ...groupRowVisibilities };
            for (const gc of docGroup.channels) next[gc.id] = !allOn;
            setChannelGroupRowVisibilities(next);
          }}
        />
      ))}
      {model.allChannels.length > 0 ? (
        <GroupStrip
          name="All channels"
          chips={model.allChannels}
          openChip={openChip}
          onChip={onAllChannelsChip}
          onOpenEditor={onOpenEditor}
        />
      ) : null}
    </div>
  );
}
