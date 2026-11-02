function utcShort(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().replace("T", " ").slice(0, 16);
}

/** Colophon from `__BUILD_TIME_ISO__` and `__BUILD_GIT_SHA__` (viewer info panel). */
export function buildStamp(): { text: string; title: string } | null {
  const iso = typeof __BUILD_TIME_ISO__ === "string" ? __BUILD_TIME_ISO__ : "";
  const sha = typeof __BUILD_GIT_SHA__ === "string" ? __BUILD_GIT_SHA__ : "";
  const label = utcShort(iso);
  const short = sha.slice(0, 7);
  const text = [label ? `Updated ${label} UTC` : "", short]
    .filter(Boolean)
    .join(" · ");
  if (!text) return null;
  return { text, title: [iso, sha].filter(Boolean).join("\n") };
}
