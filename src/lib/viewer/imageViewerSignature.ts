import type { Channel, Group } from "@/lib/stores/documentStore";

/**
 * Snapshot of document fields that affect VIV layer settings (see `toSettings` in `viv.ts`).
 * Omit histogram payloads: merging `sourceDistribution` must not change this string, so memoized
 * viewer props stay stable while curves load.
 */
export function buildImageViewerSignature(
  Groups: Group[],
  SourceChannels: Channel[],
): string {
  const sources = SourceChannels.map((sc) => ({
    u: sc.id,
    i: sc.index,
    n: sc.name,
    s: sc.samples,
    img: sc.imageId,
    dt: sc.sourceDataTypeId,
  }));
  const groups = Groups.map((g) => ({
    u: g.id,
    n: g.name,
    e: g.expanded ?? false,
    ch: g.channels.map((c) => ({
      u: c.id,
      lr: c.lowerLimit,
      ur: c.upperLimit,
      rgb: [c.color.r, c.color.g, c.color.b],
      sc: c.channelId,
    })),
  }));
  return JSON.stringify({ sources, groups });
}
