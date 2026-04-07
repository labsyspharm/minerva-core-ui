import type {
  ConfigSourceChannel,
  ConfigGroup as DocConfigGroup,
} from "@/lib/document-store";

/**
 * Snapshot of document fields that affect VIV layer settings (see `toSettings` in `viv.ts`).
 * Omit histogram payloads: merging `SourceDistribution` must not change this string, so memoized
 * viewer props stay stable while curves load.
 */
export function buildImageViewerSignature(
  Groups: DocConfigGroup[],
  SourceChannels: ConfigSourceChannel[],
): string {
  const sources = SourceChannels.map((sc) => ({
    u: sc.UUID,
    i: sc.SourceIndex,
    n: sc.Name,
    s: sc.Samples,
    img: sc.SourceImage.UUID,
    dt: sc.SourceDataType.ID,
  }));
  const groups = Groups.map((g) => ({
    u: g.UUID,
    n: g.Name,
    e: g.State.Expanded,
    ch: g.GroupChannels.map((c) => ({
      u: c.UUID,
      lr: c.LowerRange,
      ur: c.UpperRange,
      rgb: [c.Color.R, c.Color.G, c.Color.B],
      sc: c.SourceChannel.UUID,
      gu: c.Group.UUID,
    })),
  }));
  return JSON.stringify({ sources, groups });
}
