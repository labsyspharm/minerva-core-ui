import type { Roi, RoiShape } from "./roiParser";

const attr = (el: Element, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = el.getAttribute(k);
    if (v != null && v !== "") return v;
  }
  return null;
};

const num = (el: Element, ...keys: string[]): number => {
  const s = attr(el, ...keys);
  if (s == null) return Number.NaN;
  return Number(s);
};

/** OME-XML often uses 8-hex (#AARRGGBB) or 6-hex. Output RGBA 0–255. */
const parseOmeColor = (
  s: string | null | undefined,
): [number, number, number, number] | undefined => {
  if (s == null || s === "") return undefined;
  const t = s.trim();
  if (/^-?\d+$/.test(t)) {
    const int = Number.parseInt(t, 10);
    if (!Number.isNaN(int)) {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setInt32(0, int, false);
      const b = new Uint8Array(buffer);
      if (b.length < 4) return undefined;
      return [b[0], b[1], b[2], b[3]];
    }
  }
  if (t.startsWith("rgba(") || t.startsWith("rgb(")) {
    const parts = t
      .replace(/^rgba\(/, "")
      .replace(/^rgb\(/, "")
      .replace(/\)\s*$/, "")
      .split(/[,\s]+/)
      .map(Number);
    if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
      const r0 = parts[0];
      const r1 = parts[1];
      const r2 = parts[2];
      if (r0 === undefined || r1 === undefined || r2 === undefined) {
        return undefined;
      }
      const aRaw = parts[3];
      const a = aRaw === undefined ? 255 : aRaw <= 1 ? aRaw * 255 : aRaw;
      return [r0, r1, r2, a];
    }
  }
  let hex = t.replace("#", "");
  if (hex.length === 8) {
    const a = parseInt(hex.slice(0, 2), 16);
    hex = hex.slice(2);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([a, r, g, b].some((n) => Number.isNaN(n))) return undefined;
    return [r, g, b, a];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return undefined;
    return [r, g, b, 255];
  }
  return undefined;
};

const shapeCommon = (el: Element, id: string) => {
  const name = attr(el, "Name", "name");
  const text = attr(el, "Text", "text", "Value");
  const theC = num(el, "TheC", "theC");
  const theT = num(el, "TheT", "theT");
  const theZ = num(el, "TheZ", "theZ");
  const sw = num(el, "StrokeWidth", "strokeWidth");
  const base: {
    ID: string;
    Name?: string;
    Text?: string;
    FillColor?: [number, number, number, number];
    StrokeColor?: [number, number, number, number];
    StrokeWidth?: number;
    TheC?: number;
    TheT?: number;
    TheZ?: number;
  } = { ID: id };
  if (name) base.Name = name;
  if (text) base.Text = text;
  const fill = parseOmeColor(
    attr(el, "FillColor", "fillColor", "Fill", "fill"),
  );
  const stroke = parseOmeColor(
    attr(el, "StrokeColor", "strokeColor", "Stroke", "stroke"),
  );
  if (fill) base.FillColor = fill;
  if (stroke) base.StrokeColor = stroke;
  if (!Number.isNaN(sw) && sw > 0) base.StrokeWidth = sw;
  if (!Number.isNaN(theC) && theC >= 0) base.TheC = Math.floor(theC);
  if (!Number.isNaN(theT) && theT >= 0) base.TheT = Math.floor(theT);
  if (!Number.isNaN(theZ) && theZ >= 0) base.TheZ = Math.floor(theZ);
  return base;
};

const shapeIdFor = (el: Element, fallback: string): string =>
  attr(el, "ID", "id", "Name", "name") || fallback;

function elementToRoiShape(el: Element, index: number): RoiShape | null {
  const id = shapeIdFor(el, `Shape:${index}`);
  const common = (extra: object): RoiShape | null => {
    return { ...shapeCommon(el, id), ...extra } as RoiShape;
  };

  const tag = el.localName;
  const lower = tag.toLowerCase();

  if (lower === "rectangle") {
    const x = num(el, "X", "x");
    const y = num(el, "Y", "y");
    const w = num(el, "Width", "width", "W", "w");
    const h = num(el, "Height", "height", "H", "h");
    if ([x, y, w, h].some((n) => Number.isNaN(n)) || w <= 0 || h <= 0) {
      return null;
    }
    return common({
      type: "rectangle" as const,
      X: x,
      Y: y,
      Width: w,
      Height: h,
    });
  }

  if (lower === "ellipse") {
    const x = num(el, "X", "x", "cx");
    const y = num(el, "Y", "y", "cy");
    const rx = num(el, "RadiusX", "radiusX", "rx", "Radius", "r");
    let ry = num(el, "RadiusY", "radiusY", "ry");
    if (Number.isNaN(ry) && !Number.isNaN(rx)) ry = rx;
    if ([x, y, rx, ry].some((n) => Number.isNaN(n)) || rx <= 0 || ry <= 0) {
      return null;
    }
    return common({
      type: "ellipse" as const,
      X: x,
      Y: y,
      RadiusX: rx,
      RadiusY: ry,
    });
  }

  if (lower === "line") {
    const x1 = num(el, "X1", "x1", "X");
    const y1 = num(el, "Y1", "y1", "Y");
    const x2 = num(el, "X2", "x2");
    const y2 = num(el, "Y2", "y2");
    if ([x1, y1, x2, y2].some((n) => Number.isNaN(n))) {
      return null;
    }
    return common({ type: "line" as const, X1: x1, Y1: y1, X2: x2, Y2: y2 });
  }

  if (lower === "point") {
    const x = num(el, "X", "x", "px");
    const y = num(el, "Y", "y", "py");
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return common({ type: "point" as const, X: x, Y: y });
  }

  if (lower === "polygon" || lower === "polyline") {
    const pts = attr(el, "Points", "points", "Point", "Path");
    if (!pts || !pts.trim()) return null;
    if (lower === "polygon") {
      return common({ type: "polygon" as const, Points: pts.trim() });
    }
    return common({ type: "polyline" as const, Points: pts.trim() });
  }

  if (lower === "label") {
    const x = num(el, "X", "x", "px");
    const y = num(el, "Y", "y", "py");
    const t =
      attr(el, "Text", "text", "Value", "name") || el.textContent?.trim() || "";
    if (Number.isNaN(x) || Number.isNaN(y) || t === "") return null;
    return common({ type: "label" as const, X: x, Y: y, Text: t });
  }

  return null;
}

function unionShapeElements(roiEl: Element): Element[] {
  const out: Element[] = [];
  const ns = (name: string) => roiEl.getElementsByTagNameNS("*", name);
  const unions = [
    ...Array.from(ns("Union")),
    ...Array.from(roiEl.getElementsByTagName("Union")),
  ];
  if (unions.length > 0) {
    for (const u of unions) {
      for (const ch of u.children) {
        if (ch.nodeType === Node.ELEMENT_NODE) out.push(ch as Element);
      }
    }
    return out;
  }
  for (const ch of roiEl.children) {
    if (ch.localName === "Name" || ch.localName === "Description") continue;
    if (ch.nodeType === Node.ELEMENT_NODE) out.push(ch);
  }
  return out;
}

function collectRoiElements(doc: Document): Element[] {
  const a = Array.from(doc.getElementsByTagNameNS("*", "ROI"));
  const b = Array.from(doc.getElementsByTagName("ROI"));
  return Array.from(new Set([...a, ...b]));
}

/**
 * Parse OME-XML (e.g. companion annotation file) into the same `Roi` structure Viv uses
 * in `metadata.ROIs` so the existing `parseRoisFromRoiList` path applies.
 */
export function parseOmeXmlStringToRois(xml: string): Roi[] {
  if (typeof DOMParser === "undefined") {
    throw new Error("XML parsing is not available in this environment.");
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const perr = doc.getElementsByTagName("parsererror")[0];
  if (perr?.textContent?.trim()) {
    throw new Error("The file is not well-formed XML.");
  }

  const roiEls = collectRoiElements(doc);
  const rois: Roi[] = [];
  for (const roiEl of roiEls) {
    const id = attr(roiEl, "ID", "id");
    if (!id) continue;

    let roiName: string | undefined;
    for (const ch of Array.from(roiEl.children)) {
      if (ch.localName === "Name" && ch.textContent) {
        roiName = ch.textContent.trim();
        break;
      }
    }
    if (!roiName) roiName = attr(roiEl, "Name", "name") || undefined;

    let desc: string | undefined;
    for (const ch of Array.from(roiEl.children)) {
      if (ch.localName === "Description" && ch.textContent) {
        desc = ch.textContent.trim();
        break;
      }
    }

    const shapeEls = unionShapeElements(roiEl);
    const shapes: RoiShape[] = [];
    shapeEls.forEach((shapeEl, i) => {
      const s = elementToRoiShape(shapeEl, i);
      if (s) shapes.push(s);
    });

    if (shapes.length > 0) {
      rois.push({
        ID: id,
        Name: roiName,
        Description: desc,
        shapes,
      });
    }
  }
  return rois;
}
