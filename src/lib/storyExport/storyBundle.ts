import minervaMarkSvg from "@/assets/minerva-mark.svg?raw";
import { featureTableHandleKey } from "@/lib/featureTable";
import {
  exportFeatureTableParquet,
  hasIngestedFeatureTable,
} from "@/lib/featureTable/client";
import { storedTableFormat } from "@/lib/featureTable/persistFormat";
import {
  isJpegEncodedImageSource,
  isJpegOmeTiffImageSource,
  JPEG_OME_TIFF_IMAGE_SOURCE,
} from "@/lib/imaging/cubeRootEncoding";
import { jpegSourceNeedsLocalRoot } from "@/lib/imaging/loadJpegFromDocument";
import { isAbsoluteUrl } from "@/lib/imaging/sourceUrl";
import { getBlob } from "@/lib/persistence/db";
import { writeDirectoryFile } from "@/lib/persistence/directoryFiles";
import type {
  DocumentData,
  FeatureTable,
  Image,
} from "@/lib/stores/documentSchema";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import { routerBasepath } from "@/router/appRouter";
import { version as MINERVA_VERSION } from "../../../package.json";

const LOCAL_PLAYER_DIR = "bundle";

/** Inlined so the story's index.html needs no extra file beside it. */
const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(
  minervaMarkSvg.replace(/\s*\n\s*/g, ""),
)}`;

/**
 * PR previews build with `VITE_STORY_BUNDLE_URL` and ship the story player next
 * to the app (see `pr-preview.yml`). Exports from those builds copy that player
 * into the story folder and load it with relative URLs, so the story keeps
 * working after the preview is removed. Other builds keep the published npm player.
 */
function hostedPlayerBaseUrl(): string | null {
  const selfHosted = import.meta.env.VITE_STORY_BUNDLE_URL;
  if (!selfHosted) return null;
  // Relative values resolve against the deploy folder (e.g. `/pr-preview/pr-12/`).
  const deployDir = new URL(
    `${routerBasepath().replace(/\/$/, "")}/`,
    window.location.origin,
  );
  return new URL(selfHosted, deployDir).href.replace(/\/$/, "");
}

function playerAssetUrls(version: string): { js: string; css: string } {
  if (import.meta.env.VITE_STORY_BUNDLE_URL) {
    // `./`: the module import needs a relative path, not a bare specifier.
    return {
      js: `./${LOCAL_PLAYER_DIR}/minerva.js`,
      css: `./${LOCAL_PLAYER_DIR}/minerva.css`,
    };
  }
  const base = `https://cdn.jsdelivr.net/npm/minerva-core-ui@${version}/bundle`;
  return {
    js: `${base}/minerva.js`,
    css: `${base}/minerva.css`,
  };
}

/** How pixel data is referenced in an exported story folder. */
export type StoryExportMode = "jpeg-pyramid" | "jpeg-ome-tiff" | "remote-url";

/**
 * True when every pixel source is an absolute http(s) URL (no local / relative
 * files): OME-TIFFs, or the hosted JPEG pyramids of a story opened from its URL.
 */
export function canExportWithRemoteUrls(images: Image[]): boolean {
  const withSource = images.filter((im) => im.source);
  if (withSource.length === 0) return false;
  return withSource.every((im) => {
    if (
      im.source?.kind !== "url" &&
      im.source?.kind !== "jpeg" &&
      im.source?.kind !== "volume"
    ) {
      return false;
    }
    return /^https?:\/\//i.test(im.source.url.trim());
  });
}

/**
 * Point intensity images at the story-folder JPEG root. Hosted pyramids
 * (absolute http(s) roots) keep reading from their host.
 */
export function withPortableJpegSources(images: Image[]): Image[] {
  return images.map((im) => {
    if (
      !im.source ||
      (im.source.kind !== "jpeg" &&
        im.source.kind !== "local" &&
        im.source.kind !== "url") ||
      (im.source.kind === "jpeg" && !jpegSourceNeedsLocalRoot(im.source.url))
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
  if (mode === "remote-url") {
    // Hosted JPEG pixels keep the marker the player decodes them with.
    return current && isJpegEncodedImageSource(current)
      ? current
      : "remote-url";
  }
  if (mode === "jpeg-ome-tiff") {
    // Preserve contrast vs cube-root variant set by the exporter.
    if (current && isJpegOmeTiffImageSource(current)) return current;
    return JPEG_OME_TIFF_IMAGE_SOURCE;
  }
  return current ?? "jpeg-pyramid";
}

function storyIndexHtml(title?: string, version = MINERVA_VERSION): string {
  const { js, css } = playerAssetUrls(version);
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
    <link rel="icon" type="image/svg+xml" href="${FAVICON_HREF}" />
    <link rel="stylesheet" href="${css}" />
    <style>
      /* Hex literal (no custom properties yet): matches --minerva-paper before player CSS loads. */
      html, body, #minerva-root { height: 100%; margin: 0; background: #000; }
    </style>
  </head>
  <body>
    <div id="minerva-root"></div>
    <script type="module">
      import { play } from "${js}";
      play({
        documentUrl: "document.json",
        editable: true,
        root: document.getElementById("minerva-root"),
      });
    </script>
  </body>
</html>
`;
}

const FEATURE_TABLE_DIR = "feature-tables";

/**
 * A table's Parquet: the stored blob when it already is Parquet (no worker
 * round trip, and present before the table finishes ingesting), else an export
 * from the worker. `null` when neither has the rows.
 */
async function featureTableParquet(
  featureTable: FeatureTable,
): Promise<Uint8Array | null> {
  const key = featureTableHandleKey(featureTable);
  const stored = key ? await getBlob(key) : undefined;
  if (stored && storedTableFormat(stored).kind === "parquet") return stored;
  if (hasIngestedFeatureTable(featureTable.id)) {
    return exportFeatureTableParquet(featureTable.id);
  }
  return null;
}

/**
 * Write each table as `feature-tables/<id>.parquet` beside `document.json` and
 * point it there. A hosted table (absolute URL) keeps its URL: its rows are
 * the published ones. A table with no rows to write is left out and its
 * mask's name is returned in `skipped`.
 */
async function writeFeatureTableSidecars(
  directory: FileSystemDirectoryHandle,
  data: Pick<DocumentData, "featureTables" | "images">,
): Promise<{ featureTables: FeatureTable[]; skipped: string[] }> {
  const featureTables: FeatureTable[] = [];
  const skipped: string[] = [];
  const isHosted = (t: FeatureTable) =>
    t.source.kind === "url" && isAbsoluteUrl(t.source.url);
  const parquets = await Promise.all(
    data.featureTables.map((t) =>
      isHosted(t) ? null : featureTableParquet(t),
    ),
  );
  for (const [i, featureTable] of data.featureTables.entries()) {
    if (isHosted(featureTable)) {
      featureTables.push(featureTable);
      continue;
    }
    const bytes = parquets[i];
    if (!bytes) {
      const channel = data.images
        .flatMap((im) => im.channels)
        .find((ch) => ch.id === featureTable.sourceChannelId);
      skipped.push(channel?.name ?? featureTable.sourceChannelId);
      continue;
    }
    const url = `${FEATURE_TABLE_DIR}/${featureTable.id}.parquet`;
    await writeDirectoryFile(directory, url, bytes as Uint8Array<ArrayBuffer>);
    featureTables.push({ ...featureTable, source: { kind: "url", url } });
  }
  return { featureTables, skipped };
}

/**
 * Before a long export (3D splat training): fail now, not at the end, if the
 * self-hosted player it will copy hasn't been built (`pnpm run pages`).
 */
export async function checkStoryPlayer(): Promise<void> {
  const base = hostedPlayerBaseUrl();
  if (!base) return;
  const res = await fetch(`${base}/manifest.json`);
  if (!res.ok) {
    throw new Error(
      `Story player missing at ${base}/manifest.json (${res.status}); build it with \`pnpm run pages\`.`,
    );
  }
}

/** Copy the preview-hosted player into `bundle/` beside the story. */
async function copyHostedPlayer(
  directory: FileSystemDirectoryHandle,
): Promise<void> {
  const base = hostedPlayerBaseUrl();
  if (!base) return;
  const manifestRes = await fetch(`${base}/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(
      `Story player manifest missing at ${base}/manifest.json (${manifestRes.status})`,
    );
  }
  const listed: unknown = await manifestRes.json();
  if (!Array.isArray(listed)) {
    throw new Error("Story player manifest is invalid");
  }
  const files = listed.filter(
    (name): name is string => typeof name === "string",
  );
  if (files.length === 0) {
    throw new Error("Story player manifest is empty");
  }
  const playerDir = await directory.getDirectoryHandle(LOCAL_PLAYER_DIR, {
    create: true,
  });
  for (const relativePath of files) {
    const fileRes = await fetch(`${base}/${relativePath}`);
    if (!fileRes.ok) {
      throw new Error(
        `Failed to copy story player file ${relativePath} (${fileRes.status})`,
      );
    }
    await writeDirectoryFile(
      playerDir,
      relativePath,
      await fileRes.arrayBuffer(),
    );
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
 * Write `document.json`, `index.html`, and each loaded feature table as
 * Parquet into an export directory. PR previews also copy the story player
 * into `bundle/`.
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
  const { featureTables, skipped } = await writeFeatureTableSidecars(
    directory,
    data,
  );
  const exported = toExportedStoryDocument({ ...data, featureTables }, mode);
  await writeDirectoryFile(
    directory,
    "document.json",
    JSON.stringify(exported, null, 2),
  );
  await copyHostedPlayer(directory);
  await writeDirectoryFile(
    directory,
    "index.html",
    storyIndexHtml(
      exported.metadata.title,
      exported.metadata.minervaVersion ?? MINERVA_VERSION,
    ),
  );
  return { skippedFeatureTables: skipped };
}
