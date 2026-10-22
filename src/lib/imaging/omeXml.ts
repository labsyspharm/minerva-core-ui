/**
 * OME-TIFF ImageDescription → DOM. Firefox is stricter than Chrome: TIFF ASCII
 * tags are often NUL-padded (FF: "XML Parsing Error: not well-formed"), and
 * OME elements live in a namespace so unprefixed querySelector misses them.
 */

/** Strip TIFF ASCII padding / trailing junk so DOMParser accepts the payload. */
export function sanitizeOmeXml(raw: string): string {
  let s = raw.replaceAll("\0", "").trim();
  if (!s) return s;
  // Prefer a clean cut at the OME root close when junk follows the document.
  const endTag = s.search(/<\/(?:ome:)?OME\s*>/i);
  if (endTag >= 0) {
    const gt = s.indexOf(">", endTag);
    if (gt >= 0) s = s.slice(0, gt + 1);
  }
  return s.trim();
}

export function parseOmeXml(raw: string): Document | null {
  const xml = sanitizeOmeXml(raw);
  if (!xml) return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  return doc;
}

/** Namespace-agnostic first Pixels element (OME uses a default xmlns). */
export function omePixelsElement(doc: Document): Element | null {
  return doc.getElementsByTagNameNS("*", "Pixels")[0] ?? null;
}

/** Direct Channel children of a Pixels element. */
export function omeChannelElements(pixels: Element): Element[] {
  return [...pixels.getElementsByTagNameNS("*", "Channel")].filter(
    (el) => el.parentElement === pixels,
  );
}
