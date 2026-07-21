import * as React from "react";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import { useAppStore } from "@/lib/stores/appStore";
import {
  type ChannelGroup,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import styles from "./ChannelGroups.module.css";

const GroupRow = (props: { group: ChannelGroup }) => {
  const { group } = props;
  const { name } = group;

  const { setActiveChannelGroup } = useAppStore();
  const docChannelGroups = useDocumentStore((s) => s.channelGroups);
  const row_group = React.useMemo(
    () =>
      docChannelGroups.find((grp) => grp.name === name) || docChannelGroups[0],
    [docChannelGroups, name],
  );

  const toGroup = () => {
    if (row_group) {
      setActiveChannelGroup(row_group.id);
    }
  };

  return (
    <button type="button" className={styles.groupAltRow} onClick={toGroup}>
      {name}
    </button>
  );
};

export const ChannelGroups = (props: {
  channelGroups: { id: string; name: string }[];
}) => {
  const { channelGroups } = props;
  const [expanded, setExpanded] = React.useState(false);

  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const docChannelGroups = useDocumentStore((s) => s.channelGroups);
  const activeGroup = React.useMemo(
    () =>
      docChannelGroups.find(({ id }) => id === activeChannelGroupId) ||
      docChannelGroups[0],
    [docChannelGroups, activeChannelGroupId],
  );

  const prevGroupId = React.useRef(activeChannelGroupId);
  React.useEffect(() => {
    if (prevGroupId.current !== activeChannelGroupId) {
      prevGroupId.current = activeChannelGroupId;
      setExpanded(false);
    }
  });

  const activeGroupName = activeGroup?.name || "No group";

  if (channelGroups.length <= 1) {
    return (
      <div className={styles.wrapRows}>
        <div className={styles.activeHeader} title={activeGroupName}>
          <span className={styles.ellipsis}>{activeGroupName}</span>
        </div>
      </div>
    );
  }

  const otherGroups = expanded
    ? docChannelGroups.filter((g) => g.id !== activeGroup?.id)
    : [];

  return (
    <div className={styles.wrapRows}>
      <button
        type="button"
        className={styles.activeGroupTrigger}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={styles.chevronWrap} aria-hidden>
          <ChevronIcon direction={expanded ? "up" : "down"} />
        </span>
        <span className={styles.triggerLabel}>{activeGroupName}</span>
      </button>
      {otherGroups.length > 0 ? (
        <div className={styles.alternateList}>
          {otherGroups.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </div>
      ) : null}
    </div>
  );
};
