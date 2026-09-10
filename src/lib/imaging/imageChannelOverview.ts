import {
  isDisplayedViaGroupRow,
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import { assignedDisplayHex } from "@/lib/imaging/sourceChannelStyle";
import type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
  Image,
} from "@/lib/stores/documentSchema";

/** Case-insensitive substring, then in-order subsequence on alphanumerics. */
export function channelNameMatchesQuery(name: string, query: string): boolean {
  const qRaw = query.trim().toLowerCase();
  if (qRaw.length === 0) return true;
  const nRaw = name.toLowerCase();
  if (nRaw.includes(qRaw)) return true;
  const q = qRaw.replace(/[^a-z0-9]+/g, "");
  if (q.length === 0) return true;
  const n = nRaw.replace(/[^a-z0-9]+/g, "");
  if (n.includes(q)) return true;
  let i = 0;
  for (let k = 0; k < n.length; k++) {
    if (n[k] === q[i]) {
      i += 1;
      if (i === q.length) return true;
    }
  }
  return false;
}

export type ImageChannelChip = {
  key: string;
  sourceId: string;
  name: string;
  hex: string;
  visible: boolean;
  groupId: string | null;
  groupRowId?: string;
};

type ImageChannelGroupStrip = {
  id: string;
  name: string;
  allVisible: boolean;
  chips: ImageChannelChip[];
};

type ImageChannelOverviewModel = {
  groups: ImageChannelGroupStrip[];
  allChannels: ImageChannelChip[];
};

function groupHome(
  groups: readonly ChannelGroup[],
  sourceId: string,
  groupRowVisibilities: Record<string, boolean>,
  activeGroupId?: string | null,
): { groupId: string; row: ChannelGroupChannel } | null {
  const memberships: { groupId: string; row: ChannelGroupChannel }[] = [];
  for (const g of groups) {
    const row = g.channels.find((gc) => gc.channelId === sourceId);
    if (row) memberships.push({ groupId: g.id, row });
  }
  if (memberships.length === 0) return null;
  return (
    memberships.find((m) =>
      isGroupRowVisible(groupRowVisibilities, m.row.id),
    ) ??
    memberships.find((m) => m.groupId === activeGroupId) ??
    memberships[0]
  );
}

export function buildImageChannelOverview(args: {
  image: Image;
  channelGroups: readonly ChannelGroup[];
  allSourceChannels: readonly Channel[];
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
  activeChannelGroupId?: string | null;
}): ImageChannelOverviewModel {
  const byId = new Map(args.image.channels.map((c) => [c.id, c]));

  const groups: ImageChannelGroupStrip[] = [];
  for (const group of args.channelGroups) {
    const chips: ImageChannelChip[] = [];
    for (const gc of group.channels) {
      const sc = byId.get(gc.channelId);
      if (!sc) continue;
      const channel = { ...sc, imageId: args.image.id };
      chips.push({
        key: `g:${group.id}:${gc.id}`,
        sourceId: sc.id,
        name: sc.name,
        hex: assignedDisplayHex(channel, args.allSourceChannels, gc) ?? "",
        visible: isGroupRowVisible(args.groupRowVisibilities, gc.id),
        groupId: group.id,
        groupRowId: gc.id,
      });
    }
    if (chips.length === 0) continue;
    groups.push({
      id: group.id,
      name: group.name,
      allVisible: chips.every((c) => c.visible),
      chips,
    });
  }

  const allChannels: ImageChannelChip[] = [];
  for (const sc of args.image.channels) {
    const home = groupHome(
      args.channelGroups,
      sc.id,
      args.groupRowVisibilities,
      args.activeChannelGroupId,
    );
    const channel = { ...sc, imageId: args.image.id };
    allChannels.push({
      key: `e:${sc.id}`,
      sourceId: sc.id,
      name: sc.name,
      hex:
        assignedDisplayHex(
          channel,
          args.allSourceChannels,
          home?.row ?? null,
        ) ?? "",
      visible: home
        ? isDisplayedViaGroupRow(
            sc.id,
            args.channelGroups,
            args.groupRowVisibilities,
          )
        : isStackVisible(args.stackVisibilities, sc.id),
      groupId: home?.groupId ?? null,
      groupRowId: home?.row.id,
    });
  }

  return { groups, allChannels };
}
