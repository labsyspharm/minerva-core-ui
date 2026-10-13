import { afterEach, describe, expect, it, vi } from "vitest";
import type { Image } from "@/lib/stores/documentSchema";
import {
  canExportWithRemoteUrls,
  imageSourceForExportMode,
  storyIndexHtml,
  withPortableJpegSources,
} from "./storyBundle";

const image = (source: Image["source"]) => ({ id: "im", source }) as Image;

describe("canExportWithRemoteUrls", () => {
  it("accepts hosted OME-TIFFs and hosted JPEG pyramids", () => {
    expect(
      canExportWithRemoteUrls([
        image({ kind: "url", url: "https://cdn.example.org/a.ome.tif" }),
        image({ kind: "jpeg", url: "https://lab.example.org/stories/crc" }),
      ]),
    ).toBe(true);
  });

  it("rejects relative or local sources", () => {
    expect(canExportWithRemoteUrls([image({ kind: "jpeg", url: "." })])).toBe(
      false,
    );
    expect(
      canExportWithRemoteUrls([image({ kind: "url", url: "a.ome.tif" })]),
    ).toBe(false);
    expect(
      canExportWithRemoteUrls([image({ kind: "local", handleKey: "k" })]),
    ).toBe(false);
  });
});

describe("withPortableJpegSources", () => {
  it("points local pixels at the story folder but keeps hosted pyramids", () => {
    const hosted = { kind: "jpeg", url: "https://lab.example.org/s" } as const;
    expect(
      withPortableJpegSources([
        image(hosted),
        image({ kind: "jpeg", url: "pyramid" }),
        image({ kind: "url", url: "https://cdn.example.org/a.ome.tif" }),
        image({ kind: "local", handleKey: "k" }),
      ]).map((im) => im.source),
    ).toEqual([
      hosted,
      { kind: "jpeg", url: "." },
      { kind: "jpeg", url: "." },
      { kind: "jpeg", url: "." },
    ]);
  });
});

describe("imageSourceForExportMode", () => {
  it("keeps the JPEG encoding of hosted pixels", () => {
    for (const source of [
      "jpeg-pyramid",
      "jpeg-pyramid-cube-root",
      "jpeg-ome-tiff",
      "jpeg-ome-tiff-contrast",
    ]) {
      expect(imageSourceForExportMode("remote-url", source)).toBe(source);
    }
  });

  it("marks raw OME-TIFF URLs as remote-url", () => {
    expect(imageSourceForExportMode("remote-url")).toBe("remote-url");
    expect(imageSourceForExportMode("remote-url", "remote-url")).toBe(
      "remote-url",
    );
  });
});

describe("storyIndexHtml", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("imports the published bundle as a module and allows editing", () => {
    const html = storyIndexHtml("A <b> story", "1.2.3");
    expect(html).toContain('<script type="module">');
    expect(html).toContain(
      'import { play } from "https://cdn.jsdelivr.net/npm/minerva-core-ui@1.2.3/bundle/minerva.js";',
    );
    expect(html).toContain("editable: true,");
    expect(html).toContain("<title>A &lt;b&gt; story</title>");
    expect(html).not.toContain("MinervaStory.");
  });

  it("imports a copied player by relative path, not a bare specifier", () => {
    vi.stubEnv("VITE_STORY_BUNDLE_URL", "bundle/");
    const html = storyIndexHtml("Story", "1.2.3");
    expect(html).toContain('import { play } from "./bundle/minerva.js";');
    expect(html).toContain('href="./bundle/minerva.css"');
  });
});
