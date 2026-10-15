import { parseCsvLine } from "@/lib/featureTable/columns";
import { isImageChannel } from "@/lib/imaging/channelKind";

type MarkerCsvColumns = { name: string };

const MARKER_ALIASES = new Set([
  "markername",
  "marker",
  "name",
  "channelname",
  "target",
]);
const META_ALIASES = new Set([
  "cyclenumber",
  "cycle",
  "channelnumber",
  "channel",
  "channelindex",
  "index",
  "excitationwavelength",
  "emissionwavelength",
  "excitation",
  "emission",
  "filter",
]);

function normHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function csvRows(text: string): string[][] {
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  return body
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((cells) => cells.some((cell) => cell.length > 0));
}

/** Name column only. Rows are channel order; cycle and channel numbers are not indexes. */
function guessMarkerName(headers: string[]): string | null {
  if (headers.length === 0 || /^\d+$/.test(headers[0] ?? "")) return null;
  const nameHit = headers.find((h) => MARKER_ALIASES.has(normHeader(h)));
  if (nameHit) return nameHit;
  return headers.find((h) => !META_ALIASES.has(normHeader(h))) ?? null;
}

export async function peekMarkerCsv(
  file: File,
): Promise<(MarkerCsvColumns & { headers: string[] }) | null> {
  const bytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const headers = csvRows(text)[0];
  if (!headers) return null;
  const name = guessMarkerName(headers);
  if (!name) return null;
  return { headers, name };
}

/** Names in file order, one per channel starting at index 0. */
export function markerNamesByChannelIndex(
  text: string,
  columns: MarkerCsvColumns | null,
): { ok: true; names: Map<number, string> } | { ok: false; error: string } {
  const rows = csvRows(text);
  if (rows.length === 0) return { ok: false, error: "Markers CSV is empty." };

  const header = rows[0] ?? [];
  const selected = columns?.name || guessMarkerName(header);
  let data = rows;
  let nameCol = 0;
  if (selected && header.includes(selected)) {
    nameCol = header.indexOf(selected);
    data = rows.slice(1);
  } else if (/^\d+$/.test(header[0] ?? "") && header.length >= 2) {
    nameCol = header.length - 1;
  }

  const names = new Map<number, string>();
  for (const row of data) {
    const name = (row[nameCol] ?? "").trim();
    if (!name) continue;
    names.set(names.size, name);
  }
  if (names.size === 0) {
    return { ok: false, error: "Markers CSV has no channel names." };
  }
  return { ok: true, names };
}

export function renameChannelsFromMarkers<
  T extends { index?: number; name?: string; kind?: string },
>(
  channels: readonly T[],
  names: ReadonlyMap<number, string>,
): { channels: T[]; applied: number } {
  let applied = 0;
  const next = channels.map((channel) => {
    if (!isImageChannel(channel) || channel.index == null) return channel;
    const name = names.get(channel.index);
    if (!name) return channel;
    applied += 1;
    if (name === channel.name) return channel;
    return { ...channel, name } as T;
  });
  return { channels: next, applied };
}
