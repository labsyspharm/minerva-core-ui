import type {
  ConfigSourceChannel,
  ConfigGroup as DocConfigGroup,
} from "@/lib/stores/documentStore";

/**
 * Snapshot of document fields that affect VIV layer settings (see `toSettings` in `viv.ts`).
 * Omit histogram payloads: merging `sourceDistribution` must not change this string, so memoized
 * viewer props stay stable while curves load.
 */
export function buildImageViewerSignature(
  Groups: DocConfigGroup[],
  SourceChannels: ConfigSourceChannel[],
): string {
  const sources = SourceChannels.map((sc) => ({
    u: sc.id,
    i: sc.SourceIndex,
    n: sc.Name,
    s: sc.Samples,
    img: sc.sourceImageId,
    dt: sc.sourceDataTypeId,
  }));
  const groups = Groups.map((g) => ({
    u: g.id,
    n: g.Name,
    e: g.State.Expanded,
    ch: g.GroupChannels.map((c) => ({
      u: c.id,
      lr: c.LowerRange,
      ur: c.UpperRange,
      rgb: [c.Color.R, c.Color.G, c.Color.B],
      sc: c.sourceChannelId,
      gu: c.groupId,
    })),
  }));
  return JSON.stringify({ sources, groups });
}
