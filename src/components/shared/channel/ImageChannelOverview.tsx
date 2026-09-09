import type { CSSProperties } from "react";
import { Fragment, useMemo, useState } from "react";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import { ChannelEditor } from "@/components/shared/channel/ChannelEditorPopover";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import {
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import {
  buildImageChannelOverview,
  type ImageChannelChip,
  type ImageChannelGroupStrip,
} from "@/lib/imaging/imageChannelOverview";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image } from "@/lib/stores/documentSchema";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import styles from "./ImageChannelOverview.module.css";

function chipAriaLabel(chip: ImageChannelChip, toggle: boolean): string {
  if (toggle) {
    return chip.visible ? `Hide ${chip.name}` : `Show ${chip.name}`;
  }
  return chip.visible ? `${chip.name}, visible` : `${chip.name}, hidden`;
}

function ChipButton(props: {
  chip: ImageChannelChip;
  toggle: boolean;
  open: boolean;
  dim: boolean;
  onClick: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
}) {
  const { chip, toggle, open, dim, onClick, onOpenEditor } = props;
  return (
    <div
      className={[
        styles.chipCell,
        chip.visible ? styles.chipOn : null,
        dim ? styles.chipDim : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--ch": `#${chip.hex}` } as CSSProperties}
    >
      <button
        type="button"
        className={`${minervaTheme.focusRing} ${styles.chip}`}
        title={chip.name}
        aria-label={chipAriaLabel(chip, toggle)}
        aria-pressed={toggle ? chip.visible : undefined}
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
  toggle?: boolean;
  openChip: ImageChannelChip | null;
  onChip: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
}) {
  const { chips, openChip } = props;
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
            toggle={!!props.toggle}
            open={openChip?.key === chip.key}
            dim={openChip != null && openChip.key !== chip.key}
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
  group: ImageChannelGroupStrip;
  openChip: ImageChannelChip | null;
  onEdit: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  const { group } = props;
  const visLabel = group.allVisible
    ? `Hide every channel in ${group.name}`
    : `Show every channel in ${group.name}`;
  return (
    <div className={styles.groupRow}>
      <ChannelVisibilitySwatch
        visible={group.allVisible}
        title={visLabel}
        ariaLabel={visLabel}
        onClick={() => props.onToggleGroup(group.id)}
      />
      <div className={styles.groupBody}>
        <div className={styles.groupLabel}>{group.name}</div>
        <ChipGrid
          chips={group.chips}
          openChip={props.openChip}
          onChip={props.onEdit}
          onOpenEditor={props.onOpenEditor}
        />
      </div>
    </div>
  );
}

function EtcChips(props: {
  chips: ImageChannelChip[];
  aligned: boolean;
  openChip: ImageChannelChip | null;
  onChip: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
}) {
  const grid = (
    <ChipGrid
      chips={props.chips}
      toggle
      openChip={props.openChip}
      onChip={props.onChip}
      onOpenEditor={props.onOpenEditor}
    />
  );
  if (!props.aligned) return <div className={styles.etcRow}>{grid}</div>;
  return (
    <div className={styles.groupRow}>
      <div className={styles.eyeSpacer} />
      <div className={styles.groupBody}>{grid}</div>
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
  const setActiveChannelGroup = useAppStore((s) => s.setActiveChannelGroup);
  const nav = useAuthorChannelNav();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const allSourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const model = useMemo(
    () =>
      buildImageChannelOverview({
        image,
        channelGroups,
        allSourceChannels,
        stackVisibilities,
        groupRowVisibilities,
      }),
    [
      image,
      channelGroups,
      allSourceChannels,
      stackVisibilities,
      groupRowVisibilities,
    ],
  );

  const openChip =
    openKey == null
      ? null
      : ([...model.groups.flatMap((g) => g.chips), ...model.etc].find(
          (c) => c.key === openKey,
        ) ?? null);

  const onOpenEditor = (chip: ImageChannelChip) => {
    setOpenKey((cur) => (cur === chip.key ? null : chip.key));
  };

  if (image.channels.length === 0) return null;
  if (model.groups.length === 0 && model.etc.length === 0) return null;

  return (
    <div className={styles.root}>
      {model.groups.map((group) => (
        <GroupStrip
          key={group.id}
          group={group}
          openChip={openChip}
          onEdit={(chip) => {
            if (chip.groupId) setActiveChannelGroup(chip.groupId);
            nav?.openChannelEditor({
              key: chip.key,
              groupId: chip.groupId,
            });
          }}
          onOpenEditor={onOpenEditor}
          onToggleGroup={(groupId) => {
            const group = channelGroups.find((g) => g.id === groupId);
            if (!group || group.channels.length === 0) return;
            setActiveChannelGroup(groupId);
            const allOn = group.channels.every((gc) =>
              isGroupRowVisible(groupRowVisibilities, gc.id),
            );
            const next = { ...groupRowVisibilities };
            for (const gc of group.channels) next[gc.id] = !allOn;
            setChannelGroupRowVisibilities(next);
          }}
        />
      ))}
      {model.etc.length > 0 ? (
        <EtcChips
          chips={model.etc}
          aligned={model.groups.length > 0}
          openChip={openChip}
          onChip={(chip) => {
            const vis = useAppStore.getState().channelVisibilities;
            const turningOn = !isStackVisible(vis, chip.sourceId);
            setChannelVisibilities({ ...vis, [chip.sourceId]: turningOn });
            if (!turningOn) return;
            void nav
              ?.ensureChannelHistograms?.([chip.sourceId])
              .catch(() => undefined);
          }}
          onOpenEditor={onOpenEditor}
        />
      ) : null}
    </div>
  );
}
