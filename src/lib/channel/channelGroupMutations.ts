import { defaultVisibilitiesForSources } from "@/lib/imaging/channelCompositor";
import { useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";

/** Persist group list and sync stack visibility keys for new source channels. */
export function syncChannelGroupState(
  newGroups: ChannelGroup[],
  sourceChannels: Channel[],
): void {
  useDocumentStore.getState().setChannelGroups(newGroups);
  const prev = useAppStore.getState().channelVisibilities;
  useAppStore
    .getState()
    .setChannelVisibilities(
      defaultVisibilitiesForSources(sourceChannels, prev, newGroups),
    );
}

/** Rename a persisted source channel label (visibility keyed by source id). */
export function renameSourceChannelDisplayName(
  channelId: string,
  rawName: string,
): void {
  const trimmed = rawName.trim();
  if (!trimmed) return;
  const doc = useDocumentStore.getState();
  const flatBefore = flattenImageChannelsInDocumentOrder(doc.images);
  const prev = findSourceChannel(flatBefore, channelId);
  if (!prev || prev.name === trimmed) return;

  const nextImages = doc.images.map((im) => ({
    ...im,
    channels: im.channels.map((ch) =>
      ch.id === channelId ? { ...ch, name: trimmed } : ch,
    ),
  }));
  useDocumentStore.getState().setImages(nextImages);
}

export function addSourceChannelToGroup(
  groupId: string,
  sourceChannelId: string,
  color?: { r: number; g: number; b: number },
): void {
  const doc = useDocumentStore.getState();
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const sc = sourceChannels.find(({ id }) => id === sourceChannelId);
  if (!sc) return;

  const newGroups = doc.channelGroups.map((g) => {
    if (g.id !== groupId) return g;
    if (g.channels.some((gc) => gc.channelId === sourceChannelId)) return g;
    const newChannel = {
      id: crypto.randomUUID(),
      lowerLimit: 0,
      upperLimit: 65535,
      color: color ?? { r: 255, g: 255, b: 255 },
      channelId: sc.id,
    };
    return { ...g, channels: [...g.channels, newChannel] };
  });
  syncChannelGroupState(newGroups, sourceChannels);
}

export function removeGroupChannel(
  groupId: string,
  groupChannelId: string,
): void {
  const doc = useDocumentStore.getState();
  const sourceChannels = flattenImageChannelsInDocumentOrder(doc.images);
  const newGroups = doc.channelGroups.map((g) => {
    if (g.id !== groupId) return g;
    return {
      ...g,
      channels: g.channels.filter((gc) => gc.id !== groupChannelId),
    };
  });
  syncChannelGroupState(newGroups, sourceChannels);
}
