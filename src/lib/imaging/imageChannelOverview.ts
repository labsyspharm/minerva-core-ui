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

/** One channel as the channel editor takes it (`ChannelEditor`'s `chip`). */
export type ImageChannelChip = {
  key: string;
  sourceId: string;
  /** Shown through the edited row, or (no row) in its own style. */
  visible: boolean;
  groupId: string | null;
  groupRowId?: string;
};
