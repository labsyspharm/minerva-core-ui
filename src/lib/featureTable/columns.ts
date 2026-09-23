const ID_ALIASES = new Set(["classid", "classids", "id", "cellid", "cellids"]);
const NAME_ALIASES = new Set([
  "classname",
  "name",
  "class",
  "phenotype",
  "celltype",
  "celltypes",
]);

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function pickClassColumns(
  headers: string[],
): { id: string; name: string } | null {
  const id = headers.find((h) => ID_ALIASES.has(normHeader(h)));
  const name = headers.find((h) => NAME_ALIASES.has(normHeader(h)));
  if (!id || !name || id === name) return null;
  return { id, name };
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** First row looks like headers (not `1,Tumor` data). */
export function peekCsvHeaders(bytes: Uint8Array): {
  headers: string[];
  id: string;
  name: string;
} | null {
  const text = new TextDecoder().decode(
    bytes.subarray(0, Math.min(bytes.byteLength, 8192)),
  );
  let line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
  const headers = parseCsvLine(line).filter((h) => h.length > 0);
  if (headers.length < 2) return null;
  const guess =
    pickClassColumns(headers) ??
    (/^\d+$/.test(headers[0]) ? null : { id: headers[0], name: headers[1] });
  if (!guess) return null;
  return { headers, ...guess };
}

export async function peekFeatureCsv(file: File): Promise<{
  headers: string[];
  id: string;
  name: string;
} | null> {
  const bytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  return peekCsvHeaders(bytes);
}
