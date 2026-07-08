import { useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";

/** Persist group list and sync channel visibility keys for any new channel names. */
export function syncChannelGroupState(
  newGroups: ChannelGroup[],
  sourceChannels: Channel[],
): void {
  useDocumentStore.getState().setChannelGroups(newGroups);

  const namesInUse = new Set<string>();
  for (const g of newGroups) {
    for (const gc of g.channels) {
      const sc = findSourceChannel(sourceChannels, gc.channelId);
      if (sc?.name) namesInUse.add(sc.name);
    }
  }
  const prev = useAppStore.getState().channelVisibilities;
  const merged = { ...prev };
  for (const name of namesInUse) {
    if (merged[name] === undefined) merged[name] = true;
  }
  useAppStore.getState().setChannelVisibilities(merged);
}

/** Rename a persisted source channel label and keep visibility keys in sync. */
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

  const oldName = prev.name;
  const nextImages = doc.images.map((im) => ({
    ...im,
    channels: im.channels.map((ch) =>
      ch.id === channelId ? { ...ch, name: trimmed } : ch,
    ),
  }));
  useDocumentStore.getState().setImages(nextImages);

  const flatAfter = flattenImageChannelsInDocumentOrder(nextImages);
  const stillUsesOldName = flatAfter.some((c) => c.name === oldName);

  const vis = useAppStore.getState().channelVisibilities;
  const nextVis = { ...vis };
  if (nextVis[trimmed] === undefined) {
    nextVis[trimmed] = nextVis[oldName] ?? true;
  }
  if (!stillUsesOldName && oldName !== trimmed) {
    delete nextVis[oldName];
  }
  useAppStore.getState().setChannelVisibilities(nextVis);
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
