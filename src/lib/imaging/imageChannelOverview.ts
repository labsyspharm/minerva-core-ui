import {
  isGroupRowVisible,
  isStackVisible,
  sourceChannelInAnyGroup,
} from "@/lib/imaging/channelCompositor";
import {
  effectiveDisplayColor,
  rgbToHex,
} from "@/lib/imaging/sourceChannelStyle";
import type { Channel, ChannelGroup, Image } from "@/lib/stores/documentSchema";

export type ImageChannelChip = {
  key: string;
  sourceId: string;
  name: string;
  hex: string;
  visible: boolean;
  groupId: string | null;
  groupRowId?: string;
};

export type ImageChannelGroupStrip = {
  id: string;
  name: string;
  allVisible: boolean;
  chips: ImageChannelChip[];
};

export type ImageChannelOverviewModel = {
  groups: ImageChannelGroupStrip[];
  etc: ImageChannelChip[];
};

export function groupChipKey(groupId: string, rowId: string): string {
  return `g:${groupId}:${rowId}`;
}

export function etcChipKey(sourceId: string): string {
  return `e:${sourceId}`;
}

export function buildImageChannelOverview(args: {
  image: Image;
  channelGroups: readonly ChannelGroup[];
  allSourceChannels: readonly Channel[];
  stackVisibilities: Record<string, boolean>;
  groupRowVisibilities: Record<string, boolean>;
}): ImageChannelOverviewModel {
  const byId = new Map(args.image.channels.map((c) => [c.id, c]));

  const groups: ImageChannelGroupStrip[] = [];
  for (const group of args.channelGroups) {
    const chips: ImageChannelChip[] = [];
    for (const gc of group.channels) {
      const sc = byId.get(gc.channelId);
      if (!sc) continue;
      const color = effectiveDisplayColor(
        { ...sc, imageId: args.image.id },
        args.allSourceChannels,
        gc,
      );
      chips.push({
        key: groupChipKey(group.id, gc.id),
        sourceId: sc.id,
        name: sc.name,
        hex: rgbToHex(color),
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

  const etc: ImageChannelChip[] = [];
  for (const sc of args.image.channels) {
    if (sourceChannelInAnyGroup(args.channelGroups as ChannelGroup[], sc.id)) {
      continue;
    }
    const color = effectiveDisplayColor(
      { ...sc, imageId: args.image.id },
      args.allSourceChannels,
      null,
    );
    etc.push({
      key: etcChipKey(sc.id),
      sourceId: sc.id,
      name: sc.name,
      hex: rgbToHex(color),
      visible: isStackVisible(args.stackVisibilities, sc.id),
      groupId: null,
    });
  }

  return { groups, etc };
}
