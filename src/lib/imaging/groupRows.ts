import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";
import {
  DEFAULT_MASK_VISUALIZATION,
  isMaskChannel,
  planarRgbDisplayColor,
} from "./channelKind";
import { seedRgbForGroupChannelIndex } from "./psudoPalette";
import { effectiveSourceLimits } from "./sourceChannelStyle";

/**
 * A new group row for `sc`: the source's limits and color, else a seed color
 * for `slotIndex` (planar H&E keeps its R/G/B slot color).
 */
export function makeGroupChannelRow(
  sc: Channel,
  slotIndex: number,
  sourceChannels: Channel[],
): ChannelGroupChannel {
  const [srcLo, srcHi] = effectiveSourceLimits(sc);
  const seed =
    planarRgbDisplayColor(sc, sourceChannels) ??
    seedRgbForGroupChannelIndex(slotIndex);
  const isMask = isMaskChannel(sc);
  return {
    id: crypto.randomUUID(),
    lowerLimit: srcLo,
    upperLimit: srcHi,
    color: sc.color ?? seed,
    channelId: sc.id,
    ...(isMask
      ? {
          maskVisualization: sc.maskVisualization ?? DEFAULT_MASK_VISUALIZATION,
        }
      : {}),
  };
}
