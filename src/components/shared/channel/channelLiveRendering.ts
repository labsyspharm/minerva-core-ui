import type { ChannelRendering } from "@/lib/stores/appStore";
import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";

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

export function webComponentChannelAttrs(args: {
  group_uuid: string;
  channel_uuid: string;
  source_uuid: string;
  r: number;
  g: number;
  b: number;
  lower: number;
  upper: number;
}) {
  return {
    group_uuid: args.group_uuid,
    channel_uuid: args.channel_uuid,
    source_uuid: args.source_uuid,
    r: String(args.r),
    g: String(args.g),
    b: String(args.b),
    lower_range: String(args.lower),
    upper_range: String(args.upper),
  };
}

type ChannelItemAttrsArgs = {
  channelRendering: ChannelRendering | null;
  groupId: string;
  rowId: string;
  sourceId: string;
  color: { r?: number; g?: number; b?: number };
  lower: number;
  upper: number;
};

/** Web component attrs for a stack or group-row channel histogram editor. */
export function channelItemAttrsFor(args: ChannelItemAttrsArgs) {
  const liveColor = colorRenderingForSource(
    args.channelRendering,
    args.sourceId,
  );
  const c = liveColor ?? args.color;
  const liveContrast = contrastRenderingForSource(
    args.channelRendering,
    args.sourceId,
  );
  return webComponentChannelAttrs({
    group_uuid: args.groupId,
    channel_uuid: args.rowId,
    source_uuid: args.sourceId,
    r: c.r ?? 0,
    g: c.g ?? 0,
    b: c.b ?? 0,
    lower: liveContrast ? liveContrast.lower : args.lower,
    upper: liveContrast ? liveContrast.upper : args.upper,
  });
}

export function channelItemAttrsForSource(
  channelRendering: ChannelRendering | null,
  sc: Channel,
  color: { r?: number; g?: number; b?: number },
  limits: [number, number],
) {
  return channelItemAttrsFor({
    channelRendering,
    groupId: "",
    rowId: sc.id,
    sourceId: sc.id,
    color,
    lower: limits[0],
    upper: limits[1],
  });
}

export function channelItemAttrsForGroupRow(
  channelRendering: ChannelRendering | null,
  groupId: string,
  gc: ChannelGroupChannel,
  sc: Channel | undefined,
) {
  const sourceId = sc?.id ?? gc.channelId;
  return channelItemAttrsFor({
    channelRendering,
    groupId,
    rowId: gc.id,
    sourceId,
    color: gc.color,
    lower: gc.lowerLimit,
    upper: gc.upperLimit,
  });
}
