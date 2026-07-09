import type { ChannelRendering } from "@/lib/stores/appStore";
import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";
import type { ChannelContrastEditorProps } from "./ChannelContrastEditor";

export function colorRenderingForSource(
  live: ChannelRendering | null,
  sourceChannelId: string,
): Extract<ChannelRendering, { kind: "color" }> | null {
  if (live?.kind === "color" && live.sourceChannelId === sourceChannelId) {
    return live;
  }
  return null;
}

export function contrastRenderingForSource(
  live: ChannelRendering | null,
  sourceChannelId: string,
): Extract<ChannelRendering, { kind: "contrast" }> | null {
  if (live?.kind === "contrast" && live.sourceChannelId === sourceChannelId) {
    return live;
  }
  return null;
}

export function contrastEditorPropsForSource(
  channelRendering: ChannelRendering | null,
  sc: Channel,
  color: { r?: number; g?: number; b?: number },
  limits: [number, number],
): ChannelContrastEditorProps {
  const liveColor = colorRenderingForSource(channelRendering, sc.id);
  const c = liveColor ?? color;
  const liveContrast = contrastRenderingForSource(channelRendering, sc.id);
  return {
    groupId: "",
    channelId: sc.id,
    sourceChannelId: sc.id,
    r: c.r ?? 0,
    g: c.g ?? 0,
    b: c.b ?? 0,
    lowerLimit: liveContrast ? liveContrast.lower : limits[0],
    upperLimit: liveContrast ? liveContrast.upper : limits[1],
    distribution: sc.sourceDistribution ?? null,
  };
}

export function contrastEditorPropsForGroupRow(
  channelRendering: ChannelRendering | null,
  groupId: string,
  gc: ChannelGroupChannel,
  sc: Channel | undefined,
): ChannelContrastEditorProps {
  const sourceId = sc?.id ?? gc.channelId;
  const liveColor = colorRenderingForSource(channelRendering, sourceId);
  const c = liveColor ?? gc.color;
  const liveContrast = contrastRenderingForSource(channelRendering, sourceId);
  return {
    groupId,
    channelId: gc.id,
    sourceChannelId: sourceId,
    r: c.r ?? 0,
    g: c.g ?? 0,
    b: c.b ?? 0,
    lowerLimit: liveContrast ? liveContrast.lower : gc.lowerLimit,
    upperLimit: liveContrast ? liveContrast.upper : gc.upperLimit,
    distribution: sc?.sourceDistribution ?? null,
  };
}
