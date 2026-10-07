import {
  exportFeatureTableParquet,
  hasIngestedFeatureTable,
} from "@/lib/featureTable/client";
import {
  isJpegOmeTiffImageSource,
  JPEG_OME_TIFF_IMAGE_SOURCE,
} from "@/lib/imaging/cubeRootEncoding";
import type {
  DocumentData,
  FeatureTable,
  Image,
} from "@/lib/stores/documentSchema";
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
export type StoryExportMode = "jpeg-pyramid" | "jpeg-ome-tiff" | "remote-url";

/** True when every intensity source is an absolute http(s) URL (no local / relative files). */
export function canExportWithRemoteUrls(images: Image[]): boolean {
  const withSource = images.filter((im) => im.source);
  if (withSource.length === 0) return false;
  return withSource.every((im) => {
    if (im.source?.kind !== "url") return false;
    return /^https?:\/\//i.test(im.source.url.trim());
  });
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
  let images = data.images;
  if (mode === "jpeg-pyramid") {
    images = withPortableJpegSources(data.images);
  }
  return validateDocumentData({
    ...data,
    images,
    metadata: {
      ...data.metadata,
      minervaVersion: MINERVA_VERSION,
      imageSource: imageSourceForExportMode(mode, data.metadata.imageSource),
    },
  });
}

function imageSourceForExportMode(
  mode: StoryExportMode,
  current?: string,
): string {
  if (mode === "remote-url") return "remote-url";
  if (mode === "jpeg-ome-tiff") {
    // Preserve contrast vs cube-root variant set by the exporter.
    if (current && isJpegOmeTiffImageSource(current)) return current;
    return JPEG_OME_TIFF_IMAGE_SOURCE;
  }
  return current ?? "jpeg-pyramid";
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
      /* Hex literal (no custom properties yet): matches --minerva-paper before player CSS loads. */
      html, body, #minerva-root { height: 100%; margin: 0; background: #000; }
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

const FEATURE_TABLE_DIR = "feature-tables";

/**
 * Point each loaded table at `feature-tables/<id>.parquet` beside
 * `document.json`. A table the worker has not loaded has no bytes to write:
 * it is left out and its mask's name is returned in `skipped`.
 */
function planFeatureTableSidecars(
  data: Pick<DocumentData, "featureTables" | "images">,
): { featureTables: FeatureTable[]; skipped: string[] } {
  const featureTables: FeatureTable[] = [];
  const skipped: string[] = [];
  for (const featureTable of data.featureTables) {
    if (!hasIngestedFeatureTable(featureTable.id)) {
      const channel = data.images
        .flatMap((im) => im.channels)
        .find((ch) => ch.id === featureTable.sourceChannelId);
      skipped.push(channel?.name ?? featureTable.sourceChannelId);
      continue;
    }
    featureTables.push({
      ...featureTable,
      source: {
        kind: "url",
        url: `${FEATURE_TABLE_DIR}/${featureTable.id}.parquet`,
      },
    });
  }
  return { featureTables, skipped };
}

async function writeFeatureTableFiles(
  directory: FileSystemDirectoryHandle,
  featureTables: readonly FeatureTable[],
): Promise<void> {
  if (featureTables.length === 0) return;
  const dir = await directory.getDirectoryHandle(FEATURE_TABLE_DIR, {
    create: true,
  });
  for (const featureTable of featureTables) {
    const bytes = await exportFeatureTableParquet(featureTable.id);
    const fh = await dir.getFileHandle(`${featureTable.id}.parquet`, {
      create: true,
    });
    const write = await fh.createWritable();
    await write.write(bytes);
    await write.close();
  }
}

export type WriteStoryBundleOptions = {
  mode?: StoryExportMode;
};

export type WriteStoryBundleResult = {
  /** Masks whose feature table was not loaded, so the export left it out. */
  skippedFeatureTables: string[];
};

/**
 * Write `document.json`, CDN-backed `index.html`, and each loaded feature
 * table as Parquet into an export directory.
 */
export async function writeStoryBundleSidecars(
  directory: FileSystemDirectoryHandle,
  data: DocumentData,
  opts?: WriteStoryBundleOptions,
): Promise<WriteStoryBundleResult> {
  const mode = opts?.mode ?? "jpeg-pyramid";
  if (mode === "remote-url" && !canExportWithRemoteUrls(data.images)) {
    throw new Error(
      "Remote URL export requires all images to use OME-TIFF URLs (no local files).",
    );
  }
  const { featureTables, skipped } = planFeatureTableSidecars(data);
  await writeFeatureTableFiles(directory, featureTables);
  const exported = toExportedStoryDocument({ ...data, featureTables }, mode);
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
  return { skippedFeatureTables: skipped };
}
