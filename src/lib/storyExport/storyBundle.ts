import type { DocumentData, Image } from "@/lib/stores/documentSchema";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import { version as MINERVA_VERSION } from "../../../package.json";

function minervaCdnUrls(version: string): { js: string; css: string } {
  const base = `https://cdn.jsdelivr.net/npm/minerva-core-ui@${version}/bundle`;
  return {
    js: `${base}/minerva.js`,
    css: `${base}/minerva.css`,
  };
}

/** How pixel data is referenced in an exported story folder. */
export type StoryExportMode = "jpeg-pyramid" | "remote-url";

/** True when every intensity source is a remote URL (no local file handles). */
export function canExportWithRemoteUrls(images: Image[]): boolean {
  const withSource = images.filter((im) => im.source);
  if (withSource.length === 0) return false;
  return withSource.every((im) => im.source?.kind === "url");
}

/** Point intensity images at the story-folder JPEG root. */
export function withPortableJpegSources(images: Image[]): Image[] {
  return images.map((im) => {
    if (
      !im.source ||
      (im.source.kind !== "jpeg" &&
        im.source.kind !== "local" &&
        im.source.kind !== "url")
    ) {
      return im;
    }
    return { ...im, source: { kind: "jpeg" as const, url: "." } };
  });
}

function toExportedStoryDocument(
  data: DocumentData,
  mode: StoryExportMode,
): DocumentData {
  const images =
    mode === "remote-url" ? data.images : withPortableJpegSources(data.images);
  return validateDocumentData({
    ...data,
    images,
    metadata: {
      ...data.metadata,
      minervaVersion: MINERVA_VERSION,
      imageSource:
        mode === "remote-url"
          ? "remote-url"
          : (data.metadata.imageSource ?? "jpeg-pyramid"),
    },
  });
}

function storyIndexHtml(title?: string, version = MINERVA_VERSION): string {
  const { js, css } = minervaCdnUrls(version);
  const safeTitle = (title?.trim() || "Minerva Story")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <link rel="stylesheet" href="${css}" />
    <style>
      html, body, #minerva-root { height: 100%; margin: 0; background: #111; }
    </style>
  </head>
  <body>
    <div id="minerva-root"></div>
    <script src="${js}"></script>
    <script>
      MinervaStory.play({
        documentUrl: "document.json",
        root: document.getElementById("minerva-root"),
      });
    </script>
  </body>
</html>
`;
}

async function writeTextFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  text: string,
): Promise<void> {
  const fh = await directory.getFileHandle(name, { create: true });
  const write = await fh.createWritable();
  await write.write(text);
  await write.close();
}

export type WriteStoryBundleOptions = {
  mode?: StoryExportMode;
};

/** Write `document.json` + CDN-backed `index.html` into an export directory. */
export async function writeStoryBundleSidecars(
  directory: FileSystemDirectoryHandle,
  data: DocumentData,
  opts?: WriteStoryBundleOptions,
): Promise<void> {
  const mode = opts?.mode ?? "jpeg-pyramid";
  if (mode === "remote-url" && !canExportWithRemoteUrls(data.images)) {
    throw new Error(
      "Remote URL export requires all images to use OME-TIFF URLs (no local files).",
    );
  }
  const exported = toExportedStoryDocument(data, mode);
  await writeTextFile(
    directory,
    "document.json",
    JSON.stringify(exported, null, 2),
  );
  await writeTextFile(
    directory,
    "index.html",
    storyIndexHtml(
      exported.metadata.title,
      exported.metadata.minervaVersion ?? MINERVA_VERSION,
    ),
  );
}
