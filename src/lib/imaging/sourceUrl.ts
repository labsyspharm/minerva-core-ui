/**
 * True when `url` names its own location: any scheme (`https:`, `blob:`,
 * `file:`, `data:`) or protocol-relative `//host`. Everything else is a path
 * relative to `document.json`.
 */
export function isAbsoluteUrl(url: string): boolean {
  const u = url.trim();
  return /^[a-z][a-z\d+.-]*:/i.test(u) || u.startsWith("//");
}

/** Last path segment, without query or hash; empty for a bare directory. */
export function urlFileName(url: string): string {
  const path = url.trim().split(/[?#]/)[0];
  return path.split(/[/\\]/).pop()?.trim() ?? "";
}
