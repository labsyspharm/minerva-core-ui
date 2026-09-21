import { fileOpen } from "browser-fs-access";
import type { DragEvent as ReactDragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FeatureCsvColumnPick } from "@/components/shared/channel/FeatureTable";
import { ImageChannelOverviewCard } from "@/components/shared/channel/ImageChannelOverview";
import { TrashIcon } from "@/components/shared/common/TrashIcon";
import { ImportOverlay } from "@/components/shared/ImportOverlay";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import {
  PanelActionButton,
  PanelIconButton,
} from "@/components/shared/panel/PanelButtons";
import panel from "@/components/shared/panel/panelShared.module.css";
import {
  completeFeatureTableIngest,
  ingestFeatureCsvFile,
  peekFeatureCsv,
} from "@/lib/featureTable";
import {
  isMaskChannel,
  resolveImageContentRole,
} from "@/lib/imaging/channelKind";
import { detectUrlImageFormat } from "@/lib/imaging/detectImageUrl";
import {
  isDicomWebSeriesUrl,
  normalizeDicomWebSeriesUrl,
} from "@/lib/imaging/dicom.js";
import {
  ensureFileHandlePermission,
  fileHandleFromDataTransferItem,
  findFile,
} from "@/lib/imaging/filesystem";
import type {
  OmeImageImportRole,
  OmeImportResult,
} from "@/lib/imaging/omeImport";
import {
  detectOmeTiffBrightfield,
  detectOmeTiffMask,
  detectOmeTiffPlanarRgbAmbiguity,
} from "@/lib/imaging/omeTiff";
import type { Image } from "@/lib/stores/documentStore";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { jpegSourceNeedsLocalRoot } from "@/lib/storyExport/importStoryFolder";
import styles from "./Upload.module.css";

export type { OmeImportResult };

function ReplaceIcon({ title, size = 14 }: { title?: string; size?: number }) {
  const label = title ?? "Replace";
  return (
    <svg
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <title>{label}</title>
      <path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l1.46 1.46C18.69 15.33 19 14.2 19 13c0-3.87-3.13-7-7-7zm0 10c-2.76 0-5-2.24-5-5 0-.65.13-1.26.36-1.83L5.9 7.71C5.31 8.67 5 9.8 5 11c0 3.87 3.13 7 7 7v3l4-4-4-4v3z" />
    </svg>
  );
}

/** How the current viewport image was sourced (for Images tab summary). */
type LoadedImageKind = "ome-local" | "ome-url" | "dicom";

export type LoadedSourceSummary = {
  kind: LoadedImageKind;
  /** Primary display name (filename, series list, URL basename, etc.) */
  label: string;
  width: number;
  height: number;
  channelCount: number;
  /** Set when running demo_url / demo_dicom_web bootstrap */
  isDemo?: boolean;
};

/** Intensity stack vs label / segmentation file. */
export type OmeImportRequest = {
  role: OmeImageImportRole;
  append: boolean;
  rgbDisplay?: boolean;
  source:
    | { kind: "local"; path: string; handles: Handle.File[] }
    | { kind: "url"; url: string };
};

export type DicomWebImportRequest = {
  url: string;
};

export type UploadProps = {
  onAllow: () => Promise<Handle.File[]>;
  /** Bumps after a successful image import; clears pending add state. */
  importRevision?: number;
  /** True when the viewer has image data (same idea as `!noLoader` in main). */
  imageLoaded?: boolean;
  /** Present when `imageLoaded`; dimensions may be 0 briefly while metadata arrives. */
  loadedSource?: LoadedSourceSummary;
  /** Viewer label for the primary loaded stack (local filename or URL basename). */
  fileName?: string;
  lastOmeTiffUrl?: string | null;
  onImportOme?: (
    req: OmeImportRequest,
  ) => Promise<OmeImportResult | undefined> | OmeImportResult | undefined;
  onImportDicomWeb?: (
    req: DicomWebImportRequest,
  ) => Promise<OmeImportResult | undefined> | OmeImportResult | undefined;
  /** Local handles present but Chrome revoked access after reload. */
  needsFileAccess?: boolean;
  onRequestFileAccess?: () => void | Promise<void>;
  /**
   * Local `source` exists but the handle was never persisted (Firefox) or was
   * cleared — user must pick the file again.
   */
  missingHandleKeys?: string[];
  onReselectFile?: (imageId: string) => void | Promise<void>;
  /** JPEG-pyramid story needs its export directory re-selected. */
  needsStoryRootReconnect?: boolean;
  onReconnectStoryRoot?: () => void | Promise<void>;
  /** Remove a document image (and its loaders / group rows). */
  onRemoveImage?: (imageId: string) => void | Promise<void>;
  /**
   * Replace pixels for an image with a new OME-TIFF. Keeps channel ids so
   * groups and waypoints stay linked; assigns a new image id.
   */
  onReplaceImage?: (imageId: string) => void | Promise<void>;
  /** Library strip (horizontal); default is the Images panel stack. */
  row?: boolean;
  disabled?: boolean;
};

type PendingLocal = {
  kind: "local";
  handles: Handle.File[];
  label: string;
};
type PendingUrl = { kind: "url"; url: string };
type PendingSource = PendingLocal | PendingUrl;

type OverlayFormat = "ome-tiff" | "dicomweb";

const FORMAT_OPTIONS: { format: OverlayFormat; label: string }[] = [
  { format: "ome-tiff", label: "OME-TIFF" },
  { format: "dicomweb", label: "DICOMweb" },
];

function FormatChip({
  label,
  selected,
  suggested,
  muted,
  onClick,
}: {
  label: string;
  selected: boolean;
  suggested?: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <PanelActionButton
      type="button"
      aria-pressed={selected}
      className={[
        selected ? styles.typeChipActive : null,
        suggested ? styles.typeChipSuggested : null,
        muted ? styles.typeChipMuted : null,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      {label}
    </PanelActionButton>
  );
}

const formatDims = (w: number, h: number, c: number) => {
  const dims =
    w > 0 && h > 0 ? `${w.toLocaleString()} × ${h.toLocaleString()} px` : null;
  const ch = c > 0 ? `${c} channel${c === 1 ? "" : "s"}` : null;
  return [dims, ch].filter(Boolean).join(" · ") || null;
};

function imageDisplayLabel(
  im: Image,
  index: number,
  opts: { fileName: string; lastOmeTiffUrl: string | null },
): string {
  const base = im.basename.trim();
  if (base) return base;
  const src = im.source;
  if (src?.kind === "url") {
    const u = src.url;
    return u.split("/").pop() || u;
  }
  if (src?.kind === "dicomWeb") {
    return src.modality || "DICOMweb";
  }
  if (index === 0 && opts.fileName.trim()) return opts.fileName.trim();
  if (index === 0 && opts.lastOmeTiffUrl) {
    const u = opts.lastOmeTiffUrl;
    return u.split("/").pop() || u;
  }
  return `Image ${index + 1}`;
}

const roleBadgeLabel = (
  role: ReturnType<typeof resolveImageContentRole>,
): string | null => {
  switch (role) {
    case "segmentation":
      return "Mask";
    case "mixed":
      return "Mixed roles";
    default:
      return null;
  }
};

/** Prefer Mask when selected, or when the file/URL name clearly looks like one. */
function resolveImportRole(
  selected: OmeImageImportRole,
  pathOrName: string,
): OmeImageImportRole {
  if (selected === "segmentation") return "segmentation";
  const leaf = (pathOrName.split(/[\\/]/).pop() ?? pathOrName).toLowerCase();
  if (
    /(?:^|[^a-z0-9])(?:masks?|labels?|labelmap|segmentation|segs?)(?:[^a-z0-9]|$)/.test(
      leaf,
    )
  ) {
    return "segmentation";
  }
  return selected;
}

function inferFormat(pending: PendingSource): OverlayFormat {
  if (pending.kind === "local") return "ome-tiff";
  return isDicomWebSeriesUrl(pending.url) ? "dicomweb" : "ome-tiff";
}

function pendingLabel(pending: PendingSource): string {
  if (pending.kind === "local") return pending.label;
  return pending.url;
}

const Upload = (props: UploadProps) => {
  const {
    onAllow,
    importRevision = 0,
    imageLoaded = false,
    loadedSource,
    fileName = "",
    lastOmeTiffUrl = null,
    onImportOme,
    onImportDicomWeb,
    needsFileAccess = false,
    onRequestFileAccess,
    missingHandleKeys = [],
    onReselectFile,
    needsStoryRootReconnect = false,
    onReconnectStoryRoot,
    onRemoveImage,
    onReplaceImage,
    row = false,
    disabled = false,
  } = props;

  const images = useDocumentStore((s) => s.images);
  const hasImages =
    images.length > 0 || (!!imageLoaded && loadedSource != null);

  const [urlDraft, setUrlDraft] = useState("");
  const [pending, setPending] = useState<PendingSource | null>(null);
  const [overlayRole, setOverlayRole] =
    useState<OmeImageImportRole>("intensity");
  const [overlayFormat, setOverlayFormat] = useState<OverlayFormat>("ome-tiff");
  const [detectedRole, setDetectedRole] =
    useState<OmeImageImportRole>("intensity");
  const [detectedFormat, setDetectedFormat] =
    useState<OverlayFormat>("ome-tiff");
  const [overlayRgbDisplay, setOverlayRgbDisplay] = useState(false);
  /** null = not asking / still detecting; boolean = suggested Brightfield chip. */
  const [detectedRgbDisplay, setDetectedRgbDisplay] = useState<boolean | null>(
    null,
  );
  const [detecting, setDetecting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [stripErrorAt, setStripErrorAt] = useState<"drop" | "url">("drop");
  const [importBusy, setImportBusy] = useState(false);
  const [featureCsvFile, setFeatureCsvFile] = useState<File | null>(null);
  const [featureCsvCols, setFeatureCsvCols] = useState<{
    headers: string[];
    id: string;
    name: string;
  } | null>(null);
  const clearFeatureCsv = useCallback(() => {
    setFeatureCsvFile(null);
    setFeatureCsvCols(null);
  }, []);
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const localPickInFlightRef = useRef(false);
  const prevImportRev = useRef(importRevision);
  const formatDetectAbortRef = useRef<AbortController | null>(null);
  const formatChosenByUserRef = useRef(false);
  const roleChosenByUserRef = useRef(false);
  const rgbDisplayChosenByUserRef = useRef(false);
  const overlayRgbDisplayRef = useRef(false);

  const showTypeOverlay = pending != null;
  const dicomAllowed =
    pending?.kind === "url" && overlayRole !== "segmentation";
  const urlReady = /^https?:\/\/.+/.test(urlDraft.trim());

  const abortFormatDetect = useCallback(() => {
    formatDetectAbortRef.current?.abort();
    formatDetectAbortRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      abortFormatDetect();
    };
  }, [abortFormatDetect]);

  useEffect(() => {
    if (prevImportRev.current === importRevision) return;
    // OME save bumps revision before a paired CSV ingest finishes. Stay on
    // the overlay until runImport clears importBusy.
    if (importBusy) return;
    prevImportRev.current = importRevision;
    if (importError) return;
    abortFormatDetect();
    setPending(null);
    setImportError(null);
    setUrlDraft("");
    setImportBusy(false);
    clearFeatureCsv();
  }, [
    abortFormatDetect,
    importBusy,
    importError,
    importRevision,
    clearFeatureCsv,
  ]);

  const openPending = useCallback(
    (next: PendingSource) => {
      abortFormatDetect();
      formatChosenByUserRef.current = false;
      roleChosenByUserRef.current = false;
      rgbDisplayChosenByUserRef.current = false;
      overlayRgbDisplayRef.current = false;
      const role = resolveImportRole("intensity", pendingLabel(next));
      let format = inferFormat(next);
      if (role === "segmentation") format = "ome-tiff";
      setPending(next);
      setOverlayRole(role);
      setOverlayFormat(format);
      setDetectedRole(role);
      setDetectedFormat(format);
      setOverlayRgbDisplay(false);
      setDetectedRgbDisplay(null);
      setDetecting(false);
      setImportError(null);
      clearFeatureCsv();

      const ac = new AbortController();
      formatDetectAbortRef.current = ac;
      void (async () => {
        try {
          let detectedFormat = format;
          if (next.kind === "url") {
            detectedFormat = await detectUrlImageFormat(next.url, ac.signal);
            if (ac.signal.aborted) return;
            setDetectedFormat(detectedFormat);
            if (!formatChosenByUserRef.current) {
              setOverlayFormat(detectedFormat);
            }
          }
          if (detectedFormat !== "ome-tiff") return;

          const source =
            next.kind === "local" ? await next.handles[0].getFile() : next.url;
          if (ac.signal.aborted) return;
          setDetecting(true);

          // 3-channel OME: skip mask detect; suggest Brightfield vs Fluorescence.
          const rgbAmbiguous = await detectOmeTiffPlanarRgbAmbiguity(
            source,
            ac.signal,
          );
          if (ac.signal.aborted) return;

          if (rgbAmbiguous) {
            setDetectedRole("intensity");
            if (!roleChosenByUserRef.current) {
              setOverlayRole("intensity");
            }
            setDetectedRgbDisplay(false);
            try {
              const isBrightfield = await detectOmeTiffBrightfield(
                source,
                ac.signal,
              );
              if (ac.signal.aborted) return;
              setDetectedRgbDisplay(isBrightfield);
              if (!rgbDisplayChosenByUserRef.current) {
                overlayRgbDisplayRef.current = isBrightfield;
                setOverlayRgbDisplay(isBrightfield);
              }
            } catch (error) {
              if (!ac.signal.aborted) {
                console.warn("[minerva] brightfield suggestion failed", error);
              }
            }
            return;
          }

          setDetectedRgbDisplay(null);
          const result = await detectOmeTiffMask(source, ac.signal);
          if (ac.signal.aborted) return;

          if (
            !roleChosenByUserRef.current &&
            (result.score != null || result.label === "rgb")
          ) {
            const role = result.label === "mask" ? "segmentation" : "intensity";
            setDetectedRole(role);
            setOverlayRole(role);
          }
        } catch (error) {
          if (!ac.signal.aborted) {
            console.warn("[minerva] import detection failed", error);
          }
        } finally {
          if (!ac.signal.aborted) setDetecting(false);
          if (formatDetectAbortRef.current === ac) {
            formatDetectAbortRef.current = null;
          }
        }
      })();
    },
    [abortFormatDetect, clearFeatureCsv],
  );

  const clearPending = useCallback(() => {
    abortFormatDetect();
    setPending(null);
    setImportError(null);
    clearFeatureCsv();
  }, [abortFormatDetect, clearFeatureCsv]);

  const acceptLocalHandles = useCallback(
    async (handles: Handle.File[]) => {
      if (handles.length === 0) return;
      const handle = handles[0];
      if (!(await ensureFileHandlePermission(handle))) {
        setStripErrorAt("drop");
        setImportError("Allow file access to load this image.");
        return;
      }
      if (!(await findFile({ handle }))) {
        setStripErrorAt("drop");
        setImportError("Could not read the selected file.");
        return;
      }
      openPending({
        kind: "local",
        handles: [handle],
        label: handle.name || "image.ome.tif",
      });
    },
    [openPending],
  );

  const browseLocal = useCallback(async () => {
    if (disabled || localPickInFlightRef.current) return;
    localPickInFlightRef.current = true;
    setImportError(null);
    try {
      const picked = await onAllow();
      if (picked.length === 0) return;
      await acceptLocalHandles(picked);
    } finally {
      localPickInFlightRef.current = false;
    }
  }, [acceptLocalHandles, disabled, onAllow]);

  const acceptUrlDraft = useCallback(() => {
    if (disabled) return;
    const url = urlDraft.trim();
    if (!/^https?:\/\/.+/.test(url)) {
      setStripErrorAt("url");
      setImportError("Enter a valid http(s) URL.");
      return;
    }
    openPending({ kind: "url", url });
  }, [disabled, openPending, urlDraft]);

  const onDragEnter = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  };

  const onDragLeave = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  };

  const onDragOver = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const onDrop = async (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragging(false);
    if (disabled) return;
    const items = [...e.dataTransfer.items].filter((i) => i.kind === "file");
    if (items.length === 0) {
      setStripErrorAt("drop");
      setImportError("Drop an image file to add it.");
      return;
    }
    const handle = await fileHandleFromDataTransferItem(items[0]);
    if (!handle) {
      setStripErrorAt("drop");
      setImportError("Could not read the dropped file.");
      return;
    }
    await acceptLocalHandles([handle]);
  };

  const runImport = async () => {
    if (!pending || importBusy) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const role = overlayRole;
      const format =
        !dicomAllowed && overlayFormat === "dicomweb"
          ? "ome-tiff"
          : overlayFormat;

      if (format === "dicomweb") {
        if (pending.kind !== "url") {
          setImportError("DICOMweb needs a series URL.");
          return;
        }
        if (!isDicomWebSeriesUrl(pending.url)) {
          setImportError(
            "DICOMweb URL must include /studies/…/series/… (instance or frame paths are OK).",
          );
          return;
        }
        if (!onImportDicomWeb) {
          setImportError("DICOMweb import is unavailable.");
          return;
        }
        const seriesUrl = normalizeDicomWebSeriesUrl(pending.url);
        const result = await onImportDicomWeb({ url: seriesUrl });
        if (result && result.ok === false) setImportError(result.error);
        return;
      }

      if (!onImportOme) {
        setImportError("Image import is unavailable.");
        return;
      }
      const rgbDisplay =
        detectedRgbDisplay != null && role === "intensity"
          ? overlayRgbDisplayRef.current
          : undefined;
      const attachCsv = role === "segmentation" ? featureCsvFile : null;
      const beforeMaskIds = attachCsv
        ? new Set(
            flattenImageChannelsInDocumentOrder(
              useDocumentStore.getState().images,
            )
              .filter(isMaskChannel)
              .map((c) => c.id),
          )
        : null;
      // Start CSV extract immediately so Chrome doesn't revoke the File during OME import.
      const csvJob = attachCsv
        ? ingestFeatureCsvFile(
            attachCsv,
            featureCsvCols
              ? { id: featureCsvCols.id, name: featureCsvCols.name }
              : undefined,
          )
        : null;
      const result = await onImportOme({
        role,
        append: hasImages,
        rgbDisplay,
        source:
          pending.kind === "local"
            ? {
                kind: "local",
                path: pending.label,
                handles: pending.handles,
              }
            : { kind: "url", url: pending.url },
      });
      if (result && result.ok === false) {
        setImportError(result.error);
        return;
      }
      const sourceChannelId = beforeMaskIds
        ? flattenImageChannelsInDocumentOrder(
            useDocumentStore.getState().images,
          ).find((c) => isMaskChannel(c) && !beforeMaskIds.has(c.id))?.id
        : undefined;
      if (result?.ok && csvJob && sourceChannelId) {
        const attached = await completeFeatureTableIngest(
          sourceChannelId,
          csvJob,
        );
        if (attached.ok === false) setImportError(attached.error);
      }
    } finally {
      setImportBusy(false);
    }
  };

  const labelOpts = { fileName, lastOmeTiffUrl };

  const renderImageCard = (im: Image, index: number) => {
    const title = imageDisplayLabel(im, index, labelOpts);
    const role = roleBadgeLabel(
      resolveImageContentRole({
        contentRole: im.contentRole,
        channels: im.channels ?? [],
      }),
    );
    const metaParts = [
      role,
      formatDims(im.sizeX, im.sizeY, im.sizeC ?? im.channels.length),
    ].filter(Boolean);
    const localKey =
      im.source?.kind === "local" ? im.source.handleKey : undefined;
    const needsReselect =
      !!localKey && missingHandleKeys.includes(localKey) && !!onReselectFile;
    const needsPermission =
      needsFileAccess &&
      !!onRequestFileAccess &&
      im.source?.kind === "local" &&
      !needsReselect;
    const needsStoryDir =
      needsStoryRootReconnect &&
      !!onReconnectStoryRoot &&
      im.source?.kind === "jpeg" &&
      jpegSourceNeedsLocalRoot(im.source.url);
    const showAccessOverlay = needsReselect || needsPermission || needsStoryDir;

    return (
      <article key={im.id} className={styles.imageCard}>
        <div className={styles.imageCardHeader}>
          <div className={styles.imageCardText}>
            <div className={styles.imageCardTitle} title={title}>
              {title}
            </div>
            <div className={styles.imageCardMeta}>{metaParts.join(" · ")}</div>
          </div>
          {onReplaceImage || onRemoveImage ? (
            <div className={styles.imageCardActions}>
              {onReplaceImage &&
              im.source?.kind !== "jpeg" &&
              im.source?.kind !== "dicomWeb" ? (
                <PanelIconButton
                  title={`Replace ${title} with another OME-TIFF`}
                  aria-label={`Replace ${title}`}
                  onClick={() => void onReplaceImage(im.id)}
                >
                  <ReplaceIcon title="Replace image" size={14} />
                </PanelIconButton>
              ) : null}
              {onRemoveImage ? (
                <PanelIconButton
                  title={`Delete ${title}`}
                  aria-label={`Delete ${title}`}
                  onClick={() => void onRemoveImage(im.id)}
                >
                  <TrashIcon title="Delete" size={14} />
                </PanelIconButton>
              ) : null}
            </div>
          ) : null}
        </div>
        <ImageChannelOverviewCard image={im} />
        {showAccessOverlay ? (
          <div className={styles.fileAccessOverlay}>
            <PanelActionButton
              type="button"
              className={styles.fileAccessAction}
              onClick={() => {
                if (needsStoryDir) void onReconnectStoryRoot?.();
                else if (needsReselect) void onReselectFile?.(im.id);
                else void onRequestFileAccess?.();
              }}
            >
              {needsStoryDir
                ? "Choose story folder"
                : needsReselect
                  ? "Choose file again"
                  : "Allow file access"}
            </PanelActionButton>
          </div>
        ) : null}
      </article>
    );
  };

  const imageCards =
    images.length > 0
      ? images.map((im, i) => renderImageCard(im, i))
      : imageLoaded && loadedSource
        ? [
            <article key="loaded-source" className={styles.imageCard}>
              <div className={styles.imageCardHeader}>
                <div className={styles.imageCardText}>
                  <div className={styles.imageCardTitle}>
                    {loadedSource.label}
                  </div>
                  <div className={styles.imageCardMeta}>
                    {formatDims(
                      loadedSource.width,
                      loadedSource.height,
                      loadedSource.channelCount,
                    ) ?? "Loading dimensions…"}
                  </div>
                </div>
              </div>
            </article>,
          ]
        : [];

  const dropHandlers = {
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop: (e: ReactDragEvent) => void onDrop(e),
  };
  const stripError = importError && !showTypeOverlay ? importError : null;
  const dropError = stripError && stripErrorAt === "drop" ? stripError : null;
  const urlError = stripError && stripErrorAt === "url" ? stripError : null;
  const addStrip = (
    <div
      className={[
        styles.addStrip,
        row ? styles.addStripRow : "",
        row && dragging ? styles.panelDropActive : "",
      ].join(" ")}
      {...(row ? dropHandlers : {})}
    >
      <button
        type="button"
        className={[
          styles.dropZone,
          dragging ? styles.dropZoneActive : "",
        ].join(" ")}
        disabled={disabled}
        aria-invalid={dropError ? true : undefined}
        onClick={() => void browseLocal()}
      >
        <span
          className={[styles.dropZoneTitle, dropError ? styles.importError : ""]
            .filter(Boolean)
            .join(" ")}
          role={dropError ? "alert" : undefined}
        >
          {dropError ?? "Drop or Browse Image File"}
        </span>
      </button>
      <div className={styles.orDivider}>
        <span>or</span>
      </div>
      <div className={styles.urlRow}>
        <div className={styles.urlField}>
          <input
            id="upload-add-url"
            type="url"
            className={`${minervaTheme.input} ${styles.urlInput}`}
            placeholder="Image URL (OME-TIFF or DICOMweb)"
            aria-label="Image URL"
            aria-invalid={urlError ? true : undefined}
            value={urlDraft}
            disabled={disabled}
            onChange={(e) => {
              setUrlDraft(e.target.value);
              setImportError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                acceptUrlDraft();
              }
            }}
          />
          {urlDraft.trim() ? (
            <PanelActionButton
              type="button"
              className={styles.urlAdd}
              disabled={disabled || !urlReady}
              onClick={acceptUrlDraft}
            >
              Add
            </PanelActionButton>
          ) : null}
        </div>
        {urlError ? (
          <div className={styles.importError} role="alert">
            {urlError}
          </div>
        ) : null}
      </div>
    </div>
  );

  let overlayBusyLabel = "Importing…";
  if (detecting) overlayBusyLabel = "Detecting…";
  else if (featureCsvFile && overlayRole === "segmentation") {
    overlayBusyLabel = "Loading feature table…";
  }

  const typeOverlayDialog =
    showTypeOverlay && pending ? (
      <ImportOverlay
        title={pendingLabel(pending)}
        titleId="image-import-dialog-title"
        error={importError}
        busy={importBusy || detecting}
        busyLabel={overlayBusyLabel}
        cancelDisabled={importBusy || disabled}
        importDisabled={importBusy || detecting || disabled}
        onCancel={clearPending}
        onImport={() => void runImport()}
      >
        <div className={styles.typeRow}>
          <span className={styles.fieldLabel}>Image Type</span>
          <FormatChip
            label="Fluorescence"
            selected={overlayRole === "intensity" && !overlayRgbDisplay}
            suggested={
              detectedRole === "intensity" && detectedRgbDisplay !== true
            }
            muted={detectedRole !== "intensity" || detectedRgbDisplay === true}
            onClick={() => {
              roleChosenByUserRef.current = true;
              rgbDisplayChosenByUserRef.current = true;
              overlayRgbDisplayRef.current = false;
              setOverlayRole("intensity");
              setOverlayRgbDisplay(false);
            }}
          />
          {detectedRgbDisplay != null ? (
            <FormatChip
              label="Brightfield"
              selected={overlayRole === "intensity" && overlayRgbDisplay}
              suggested={
                detectedRole === "intensity" && detectedRgbDisplay === true
              }
              muted={
                detectedRole !== "intensity" || detectedRgbDisplay !== true
              }
              onClick={() => {
                roleChosenByUserRef.current = true;
                rgbDisplayChosenByUserRef.current = true;
                overlayRgbDisplayRef.current = true;
                setOverlayRole("intensity");
                setOverlayRgbDisplay(true);
              }}
            />
          ) : null}
          <FormatChip
            label="Segmentation Mask"
            selected={overlayRole === "segmentation"}
            suggested={detectedRole === "segmentation"}
            muted={detectedRole !== "segmentation"}
            onClick={() => {
              roleChosenByUserRef.current = true;
              setOverlayRole("segmentation");
              formatChosenByUserRef.current = true;
              setOverlayFormat("ome-tiff");
            }}
          />
        </div>
        {dicomAllowed ? (
          <div className={styles.typeSection}>
            <div className={styles.typeRow}>
              <span className={styles.fieldLabel}>Format</span>
              {FORMAT_OPTIONS.map(({ format, label }) => (
                <FormatChip
                  key={format}
                  label={label}
                  selected={overlayFormat === format}
                  suggested={detectedFormat === format}
                  muted={detectedFormat !== format}
                  onClick={() => {
                    formatChosenByUserRef.current = true;
                    setOverlayFormat(format);
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
        {overlayRole === "segmentation" ? (
          <div className={styles.typeRow}>
            <span className={styles.fieldLabel}>Feature table</span>
            <PanelActionButton
              type="button"
              onClick={() => {
                void (async () => {
                  let file: File;
                  try {
                    file = await fileOpen({
                      description: "Feature table CSV",
                      mimeTypes: ["text/csv"],
                      extensions: [".csv"],
                      multiple: false,
                    });
                  } catch (e) {
                    if (e instanceof Error && e.name === "AbortError") return;
                    throw e;
                  }
                  setFeatureCsvFile(file);
                  void peekFeatureCsv(file).then(setFeatureCsvCols);
                })();
              }}
            >
              {featureCsvFile ? featureCsvFile.name : "Optional CSV…"}
            </PanelActionButton>
          </div>
        ) : null}
        {overlayRole === "segmentation" && featureCsvCols ? (
          <FeatureCsvColumnPick
            headers={featureCsvCols.headers}
            id={featureCsvCols.id}
            name={featureCsvCols.name}
            onId={(id) => setFeatureCsvCols({ ...featureCsvCols, id })}
            onName={(name) => setFeatureCsvCols({ ...featureCsvCols, name })}
          />
        ) : null}
      </ImportOverlay>
    ) : null;

  return (
    <>
      {row ? (
        addStrip
      ) : (
        <div
          className={[
            panel.authorPanel,
            dragging ? styles.panelDropActive : "",
          ].join(" ")}
          {...dropHandlers}
        >
          <div
            className={[panel.authorPanelBody, panel.thinScrollbar].join(" ")}
          >
            <div className={styles.stack}>
              {imageCards}
              {addStrip}
            </div>
          </div>
        </div>
      )}
      {typeOverlayDialog}
    </>
  );
};

export { Upload };
