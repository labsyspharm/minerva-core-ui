import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OpacitySlider } from "@/components/shared/channel/ChannelRow";
import {
  FeatureCsvAttachDialog,
  FeatureCsvColumnPick,
  pickFeatureCsv,
} from "@/components/shared/channel/FeatureTable";
import { ImageChannelOverviewCard } from "@/components/shared/channel/ImageChannelOverview";
import { TrashIcon } from "@/components/shared/common/TrashIcon";
import { ImportOverlay } from "@/components/shared/ImportOverlay";
import MoveIcon from "@/components/shared/icons/move.svg?react";
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
import { clampImageOpacity } from "@/lib/imaging/imageOpacity";
import {
  dragHasFiles,
  type ImportFileKind,
  importFileKind,
} from "@/lib/imaging/importFileKind";
import {
  isRelativeOmeTiffUrl,
  jpegSourceNeedsLocalRoot,
} from "@/lib/imaging/loadJpegFromDocument";
import {
  markerNamesByChannelIndex,
  peekMarkerCsv,
} from "@/lib/imaging/markerCsv";
import type {
  OmeImageImportRole,
  OmeImportResult,
} from "@/lib/imaging/omeImport";
import type { OmeImageSource } from "@/lib/imaging/omeImportPipeline";
import {
  detectOmeTiffBrightfield,
  detectOmeTiffMask,
  detectOmeTiffRgbLayout,
} from "@/lib/imaging/omeTiff";
import { urlFileName } from "@/lib/imaging/sourceUrl";
import { applyOmeRoisFromAnnotationXmlString } from "@/lib/shapes/applyOmeRoisToDocument";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image } from "@/lib/stores/documentStore";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { setImageOpacity } from "@/lib/stores/storeUtils";
import styles from "./Upload.module.css";

export type { OmeImportResult };

function BrowseIcon({ title, size = 14 }: { title?: string; size?: number }) {
  const label = title ?? "Browse for image";
  return (
    <svg
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <title>{label}</title>
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

/** How the current viewport image was sourced (for Images tab summary). */
export type LoadedSourceSummary = {
  /** Primary display name (filename, series list, URL basename, etc.) */
  label: string;
  width: number;
  height: number;
  channelCount: number;
};

export type OmeImportRequest = {
  /** Intensity stack vs label / segmentation file. */
  role: OmeImageImportRole;
  append: boolean;
  rgbDisplay?: boolean;
  source:
    | { kind: "local"; path: string; handles: Handle.File[] }
    | { kind: "url"; url: string };
  /** Fluorescence import: 0-based channel index → marker name. */
  channelNames?: ReadonlyMap<number, string>;
};

type UploadProps = {
  onAllow: (kinds?: readonly ImportFileKind[]) => Promise<Handle.File[]>;
  /**
   * Drop / Browse route by extension. Images open the import dialog. With this
   * (Library), `.json` stories are accepted; without it (a story), `.xml` OME
   * ROIs attach to the story and `.csv` feature tables to a mask.
   */
  onImportStory?: (file: File) => void | Promise<void>;
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
  onImportDicomWeb?: (req: {
    url: string;
  }) => Promise<OmeImportResult | undefined> | OmeImportResult | undefined;
  /** Local handles present but Chrome revoked access after reload. */
  needsFileAccess?: boolean;
  onRequestFileAccess?: () => void | Promise<void>;
  /**
   * Local `source` exists but the handle was never persisted (Firefox) or was
   * cleared — user must pick the file again.
   */
  missingHandleKeys?: string[];
  /** Images with an open loader; a relative TIFF among them needs no locating. */
  loadedImageIds?: ReadonlySet<string>;
  /** File or http(s) URL chosen for an image that still needs its file. Keeps the image id. */
  onLocateImage?: (
    imageId: string,
    source: OmeImageSource,
  ) => void | Promise<void>;
  /** JPEG-pyramid story needs its export directory re-selected. */
  needsStoryRootReconnect?: boolean;
  onReconnectStoryRoot?: () => void | Promise<void>;
  /** Remove a document image (and its loaders / group rows). */
  onRemoveImage?: (imageId: string) => void | Promise<void>;
  /**
   * Replace pixels for an image with a new OME-TIFF file or URL. Keeps channel
   * ids so groups and waypoints stay linked; assigns a new image id.
   */
  onReplaceImage?: (
    imageId: string,
    source: OmeImageSource,
  ) => void | Promise<void>;
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

function sourceFileReference(im: Image): string | null {
  const src = im.source;
  if (src?.kind === "url" || src?.kind === "jpeg") {
    const leaf = urlFileName(src.url);
    if (leaf && leaf !== ".") return leaf;
  }
  const base = im.basename.trim();
  return base || null;
}

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

type PointTarget = {
  imageId: string;
  mode: "locate" | "replace";
  top: number;
  left: number;
  maxHeight: number;
};

/**
 * Below the clicked control, clamped on-screen. Matches `.pointPopup` width;
 * `maxHeight` keeps it inside the window, scrolling when the space is short.
 */
function pointPopupPosition(el: Element): {
  top: number;
  left: number;
  maxHeight: number;
} {
  const rect = el.getBoundingClientRect();
  const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 200));
  return {
    top,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
    maxHeight: window.innerHeight - top - 8,
  };
}

/** What the panel strip shows while the popup owns the shared strip state. */
const IDLE_STRIP = {
  draft: "",
  dropError: null,
  urlError: null,
} as const;

const Upload = (props: UploadProps) => {
  const {
    onAllow,
    onImportStory,
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
    loadedImageIds,
    onLocateImage,
    needsStoryRootReconnect = false,
    onReconnectStoryRoot,
    onRemoveImage,
    onReplaceImage,
    row = false,
    disabled = false,
  } = props;

  const [pointTarget, setPointTarget] = useState<PointTarget | null>(null);
  const togglePoint = (
    imageId: string,
    mode: PointTarget["mode"],
    el: Element,
  ) => {
    setPointTarget(
      pointTarget?.imageId === imageId && pointTarget.mode === mode
        ? null
        : { imageId, mode, ...pointPopupPosition(el) },
    );
    // The popup and the panel strip share one draft; each starts empty.
    setUrlDraft("");
    setImportError(null);
  };

  const images = useDocumentStore((s) => s.images);

  useEffect(() => {
    if (!pointTarget) return;
    if (!images.some((im) => im.id === pointTarget.imageId)) {
      setPointTarget(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPointTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images, pointTarget]);
  const arrangeImageId = useAppStore((s) => s.arrangeImageId);
  const setArrangeImageId = useAppStore((s) => s.setArrangeImageId);
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
  useEffect(() => {
    if (!featureCsvFile) return;
    let cancel = false;
    setFeatureCsvCols(null);
    const peek =
      overlayRole === "segmentation" ? peekFeatureCsv : peekMarkerCsv;
    void peek(featureCsvFile).then((cols) => {
      if (cancel) return;
      if (!cols) {
        setFeatureCsvCols(null);
        return;
      }
      const id = "id" in cols && typeof cols.id === "string" ? cols.id : "";
      setFeatureCsvCols({
        headers: cols.headers,
        id,
        name: cols.name,
      });
    });
    return () => {
      cancel = true;
    };
  }, [featureCsvFile, overlayRole]);
  const [csvDrop, setCsvDrop] = useState<{
    file: File;
    masks: { id: string; name?: string }[];
  } | null>(null);
  /** Brief success line in the drop zone (annotations / feature table). */
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);
  const [dragging, setDragging] = useState(false);
  const acceptDroppedFilesRef = useRef<(dt: DataTransfer) => Promise<void>>(
    async () => {},
  );
  const localPickInFlightRef = useRef(false);

  useEffect(() => {
    let depth = 0;
    let hideTimer = 0;
    const end = () => {
      window.clearTimeout(hideTimer);
      depth = 0;
      setDragging(false);
    };
    const onDragEnter = (e: DragEvent) => {
      if (!dragHasFiles(e) || disabled) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!dragHasFiles(e) || disabled) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }
      if (disabled) return;
      // A drag that began before mount (another tab) never sent us dragenter.
      depth = Math.max(depth, 1);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(end, 1000);
      setDragging(true);
    };
    const onDrop = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      end();
      if (disabled || !e.dataTransfer) return;
      void acceptDroppedFilesRef.current(e.dataTransfer);
    };
    window.addEventListener("dragenter", onDragEnter, true);
    window.addEventListener("dragleave", onDragLeave, true);
    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);
    window.addEventListener("dragend", end, true);
    return () => {
      end();
      window.removeEventListener("dragenter", onDragEnter, true);
      window.removeEventListener("dragleave", onDragLeave, true);
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
      window.removeEventListener("dragend", end, true);
    };
  }, [disabled]);
  const prevImportRev = useRef(importRevision);
  const formatDetectAbortRef = useRef<AbortController | null>(null);
  const formatChosenByUserRef = useRef(false);
  const roleChosenByUserRef = useRef(false);
  const rgbDisplayChosenByUserRef = useRef(false);

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
          // Packed RGB (one channel, SamplesPerPixel=3) is interleaved H&E.
          // Only three separate planes are ambiguous.
          const rgbLayout = await detectOmeTiffRgbLayout(source, ac.signal);
          if (ac.signal.aborted) return;

          if (rgbLayout) {
            setDetectedRole("intensity");
            if (!roleChosenByUserRef.current) {
              setOverlayRole("intensity");
            }
            if (rgbLayout === "packed") {
              setDetectedRgbDisplay(true);
              if (!rgbDisplayChosenByUserRef.current) {
                setOverlayRgbDisplay(true);
              }
              return;
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
            const detected =
              result.label === "mask" ? "segmentation" : "intensity";
            setDetectedRole(detected);
            setOverlayRole(detected);
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

  const applyPointedSource = useCallback(
    async (source: OmeImageSource): Promise<boolean> => {
      if (!pointTarget) return false;
      setPointTarget(null);
      const apply =
        pointTarget.mode === "replace" ? onReplaceImage : onLocateImage;
      await apply?.(pointTarget.imageId, source);
      return true;
    },
    [pointTarget, onReplaceImage, onLocateImage],
  );

  const acceptedKinds: ImportFileKind[] = pointTarget
    ? ["image"]
    : onImportStory
      ? ["image", "story"]
      : ["image", "annotations", "featureTable"];

  const failDrop = (message: string) => {
    setStripErrorAt("drop");
    setImportError(message);
  };

  const importOtherFile = async (kind: ImportFileKind, file: File) => {
    if (kind === "story") {
      await onImportStory?.(file);
    } else if (kind === "annotations") {
      const r = applyOmeRoisFromAnnotationXmlString(await file.text());
      if (r.success === false) failDrop(r.error);
      else {
        const n = r.shapeCount;
        setNotice(`Imported ${n} annotation${n === 1 ? "" : "s"}.`);
      }
    } else {
      const doc = useDocumentStore.getState();
      const hasTable = new Set(doc.featureTables.map((t) => t.sourceChannelId));
      const masks = flattenImageChannelsInDocumentOrder(doc.images).filter(
        isMaskChannel,
      );
      const free = masks.flatMap(({ id, name }) =>
        id && !hasTable.has(id) ? [{ id, name }] : [],
      );
      if (free.length > 0) setCsvDrop({ file, masks: free });
      else
        failDrop(
          masks.length > 0
            ? "Every mask already has a feature table."
            : "Add a segmentation mask before attaching a feature table.",
        );
    }
  };

  const acceptLocalHandle = async (handle: Handle.File) => {
    setImportError(null);
    setNotice(null);
    const kind = importFileKind(handle.name);
    if (!acceptedKinds.includes(kind)) {
      failDrop(
        pointTarget
          ? "Choose an image file."
          : onImportStory
            ? "Open a story to add this file."
            : "Import story files from the Library.",
      );
      return;
    }
    if (!(await ensureFileHandlePermission(handle))) {
      failDrop("Allow file access to read this file.");
      return;
    }
    if (!(await findFile({ handle }))) {
      failDrop("Could not read the selected file.");
      return;
    }
    if (kind !== "image") {
      try {
        await importOtherFile(kind, await handle.getFile());
      } catch (e: unknown) {
        failDrop(
          e instanceof Error ? e.message : "Could not read the selected file.",
        );
      }
      return;
    }
    if (await applyPointedSource({ kind: "local", handle })) return;
    openPending({
      kind: "local",
      handles: [handle],
      label: handle.name || "image.ome.tif",
    });
  };

  const browseLocal = async () => {
    if (disabled || localPickInFlightRef.current) return;
    localPickInFlightRef.current = true;
    setImportError(null);
    try {
      const [handle] = await onAllow(acceptedKinds);
      if (handle) await acceptLocalHandle(handle);
    } finally {
      localPickInFlightRef.current = false;
    }
  };

  const acceptUrlDraft = useCallback(() => {
    if (disabled) return;
    const url = urlDraft.trim();
    if (!/^https?:\/\/.+/.test(url)) {
      setStripErrorAt("url");
      setImportError("Enter a valid http(s) URL.");
      return;
    }
    if (pointTarget) {
      setUrlDraft("");
      void applyPointedSource({ kind: "url", url });
      return;
    }
    openPending({ kind: "url", url });
  }, [applyPointedSource, disabled, openPending, pointTarget, urlDraft]);

  acceptDroppedFilesRef.current = async (dt) => {
    if (disabled) return;
    const items = [...dt.items].filter((i) => i.kind === "file");
    if (items.length === 0) {
      failDrop("Drop a file to add it.");
      return;
    }
    const handle = await fileHandleFromDataTransferItem(items[0]);
    if (!handle) {
      failDrop("Could not read the dropped file.");
      return;
    }
    await acceptLocalHandle(handle);
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
          ? overlayRgbDisplay
          : undefined;
      const attachCsv = role === "segmentation" ? featureCsvFile : null;
      const attachMarkers =
        role === "intensity" && !overlayRgbDisplay ? featureCsvFile : null;
      let channelNames: Map<number, string> | undefined;
      if (attachMarkers) {
        const parsed = markerNamesByChannelIndex(
          await attachMarkers.text(),
          featureCsvCols?.name ? { name: featureCsvCols.name } : null,
        );
        if (parsed.ok === false) {
          setImportError(parsed.error);
          return;
        }
        channelNames = parsed.names;
      }
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
        channelNames,
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
      !!localKey && missingHandleKeys.includes(localKey) && !!onLocateImage;
    const unloaded = !loadedImageIds?.has(im.id);
    const relativeUnloaded =
      im.source?.kind === "url" &&
      isRelativeOmeTiffUrl(im.source.url) &&
      unloaded;
    // Files that may only need permission again (after a reload) ask for it
    // first; a relative TIFF still unloaded after that is located. An open
    // image needs nothing, whatever other files are waiting on.
    const needsPermission =
      needsFileAccess &&
      !!onRequestFileAccess &&
      (im.source?.kind === "local"
        ? !needsReselect && unloaded
        : relativeUnloaded);
    const needsLocateFile =
      !!onLocateImage && relativeUnloaded && !needsPermission;
    const needsStoryDir =
      needsStoryRootReconnect &&
      !!onReconnectStoryRoot &&
      im.source?.kind === "jpeg" &&
      jpegSourceNeedsLocalRoot(im.source.url);
    const showAccessOverlay =
      needsReselect || needsLocateFile || needsPermission || needsStoryDir;
    const fileReference = showAccessOverlay ? sourceFileReference(im) : null;

    const pointing = pointTarget?.imageId === im.id ? pointTarget.mode : null;
    return (
      <article key={im.id} className={styles.imageCard}>
        <div className={styles.imageCardHeader}>
          <div className={styles.imageCardText}>
            <div className={styles.imageCardTitle} title={title}>
              {title}
            </div>
            <div className={styles.imageCardMeta}>{metaParts.join(" · ")}</div>
          </div>
          <div className={styles.imageCardActions}>
            <PanelIconButton
              title="Arrange"
              aria-label={`Arrange ${title}`}
              aria-pressed={arrangeImageId === im.id}
              active={arrangeImageId === im.id}
              onClick={() =>
                setArrangeImageId(arrangeImageId === im.id ? null : im.id)
              }
            >
              <MoveIcon aria-hidden />
            </PanelIconButton>
            {onReplaceImage &&
            im.source?.kind !== "jpeg" &&
            im.source?.kind !== "dicomWeb" ? (
              <PanelIconButton
                title={`Browse for an image to replace ${title}`}
                aria-label={`Browse for an image to replace ${title}`}
                aria-pressed={pointing === "replace"}
                active={pointing === "replace"}
                onClick={(e) => togglePoint(im.id, "replace", e.currentTarget)}
              >
                <BrowseIcon title="Browse for image" size={14} />
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
        </div>
        <OpacitySlider
          className={styles.imageOpacity}
          value={clampImageOpacity(im.opacity)}
          ariaLabel={title}
          onPreview={(opacity) => {
            const app = useAppStore.getState();
            if (opacity !== null) {
              app.setImageOpacityPreview({ imageId: im.id, opacity });
            } else if (app.imageOpacityPreview?.imageId === im.id) {
              app.setImageOpacityPreview(null);
            }
          }}
          onCommit={(opacity) => {
            const doc = useDocumentStore.getState();
            doc.setImages(setImageOpacity(doc.images, im.id, opacity));
          }}
        />
        <ImageChannelOverviewCard image={im} />
        {showAccessOverlay ? (
          <div className={styles.fileAccessOverlay}>
            {fileReference ? (
              <div className={styles.fileAccessName} title={fileReference}>
                {fileReference}
              </div>
            ) : null}
            <PanelActionButton
              type="button"
              className={styles.fileAccessAction}
              active={pointing === "locate"}
              aria-pressed={
                needsReselect || needsLocateFile
                  ? pointing === "locate"
                  : undefined
              }
              onClick={(e) => {
                if (needsStoryDir) void onReconnectStoryRoot?.();
                else if (needsReselect || needsLocateFile) {
                  togglePoint(im.id, "locate", e.currentTarget);
                } else void onRequestFileAccess?.();
              }}
            >
              {needsStoryDir
                ? "Choose story folder"
                : needsReselect || needsLocateFile
                  ? "Locate file"
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

  const stripError = importError && !pending ? importError : null;
  const liveStrip = {
    draft: urlDraft,
    dropError: stripErrorAt === "drop" ? stripError : null,
    urlError: stripErrorAt === "url" ? stripError : null,
  };
  const renderAddStrip = (popup: boolean) => {
    // While the popup is open it owns the shared draft and errors.
    const strip = popup || !pointTarget ? liveStrip : IDLE_STRIP;
    return (
      <div
        className={
          popup ? styles.addStrip : `${styles.addStrip} ${styles.addStripRow}`
        }
      >
        <button
          type="button"
          className={styles.dropZone}
          disabled={disabled}
          aria-invalid={strip.dropError ? true : undefined}
          onClick={() => void browseLocal()}
        >
          <span
            className={[
              styles.dropZoneTitle,
              strip.dropError ? styles.importError : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role={strip.dropError ? "alert" : notice ? "status" : undefined}
          >
            {strip.dropError ??
              (popup
                ? "Drop or Browse Image File"
                : (notice ?? "Drop or Browse File"))}
          </span>
        </button>
        <div className={styles.orDivider}>
          <span>or</span>
        </div>
        <div className={styles.urlRow}>
          <div className={styles.urlField}>
            <input
              id={popup ? undefined : "upload-add-url"}
              type="url"
              className={`${minervaTheme.input} ${styles.urlInput}`}
              placeholder="Image URL"
              aria-label="Image URL"
              aria-invalid={strip.urlError ? true : undefined}
              value={strip.draft}
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
            {strip.draft.trim() ? (
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
          {strip.urlError ? (
            <div className={styles.importError} role="alert">
              {strip.urlError}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  let overlayBusyLabel = "Importing…";
  if (detecting) overlayBusyLabel = "Detecting…";
  else if (featureCsvFile && overlayRole === "segmentation") {
    overlayBusyLabel = "Loading feature table…";
  }

  const addStrip = renderAddStrip(false);

  return (
    <>
      {dragging
        ? createPortal(
            <output className={styles.windowDrop}>
              {pointTarget ? "Drop image file" : "Drop file"}
            </output>,
            document.body,
          )
        : null}
      {pointTarget
        ? createPortal(
            <>
              <button
                type="button"
                className={styles.pointBackdrop}
                aria-label="Close"
                onClick={() => setPointTarget(null)}
              />
              <div
                className={styles.pointPopup}
                style={{
                  top: pointTarget.top,
                  left: pointTarget.left,
                  maxHeight: pointTarget.maxHeight,
                }}
                role="dialog"
                aria-label={
                  pointTarget.mode === "locate"
                    ? "Locate image file or URL"
                    : "Replace image with a file or URL"
                }
              >
                {renderAddStrip(true)}
              </div>
            </>,
            document.body,
          )
        : null}
      {row ? (
        addStrip
      ) : (
        <div className={panel.authorPanel}>
          <div className={styles.panelDock}>{addStrip}</div>
          <div
            className={[panel.authorPanelBody, panel.thinScrollbar].join(" ")}
          >
            {imageCards.length > 0 ? (
              <div className={styles.stack}>{imageCards}</div>
            ) : null}
          </div>
        </div>
      )}
      {pending ? (
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
              suggested={overlayRole === "intensity" && !overlayRgbDisplay}
              muted={detectedRgbDisplay === true}
              onClick={() => {
                roleChosenByUserRef.current = true;
                rgbDisplayChosenByUserRef.current = true;
                setOverlayRole("intensity");
                setOverlayRgbDisplay(false);
              }}
            />
            {detectedRgbDisplay != null ? (
              <FormatChip
                label="Brightfield"
                selected={overlayRole === "intensity" && overlayRgbDisplay}
                suggested={overlayRole === "intensity" && overlayRgbDisplay}
                muted={
                  detectedRole !== "intensity" || detectedRgbDisplay !== true
                }
                onClick={() => {
                  roleChosenByUserRef.current = true;
                  rgbDisplayChosenByUserRef.current = true;
                  setOverlayRole("intensity");
                  setOverlayRgbDisplay(true);
                }}
              />
            ) : null}
            <FormatChip
              label="Segmentation Mask"
              selected={overlayRole === "segmentation"}
              suggested={overlayRole === "segmentation"}
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
          {overlayRole === "segmentation" ||
          (overlayRole === "intensity" && !overlayRgbDisplay) ? (
            <div className={styles.typeRow}>
              <span className={styles.fieldLabel}>
                {overlayRole === "segmentation" ? "Feature table" : "Markers"}
              </span>
              <PanelActionButton
                type="button"
                onClick={() => {
                  void (async () => {
                    const file = await pickFeatureCsv(
                      overlayRole === "segmentation"
                        ? "Feature table CSV"
                        : "Markers CSV",
                    );
                    if (!file) return;
                    setFeatureCsvFile(file);
                  })();
                }}
              >
                {featureCsvFile ? featureCsvFile.name : "Optional CSV…"}
              </PanelActionButton>
            </div>
          ) : null}
          {featureCsvCols &&
          overlayRole === "segmentation" &&
          featureCsvCols.id ? (
            <FeatureCsvColumnPick
              headers={featureCsvCols.headers}
              id={featureCsvCols.id}
              name={featureCsvCols.name}
              onId={(id) => setFeatureCsvCols({ ...featureCsvCols, id })}
              onName={(name) => setFeatureCsvCols({ ...featureCsvCols, name })}
            />
          ) : null}
          {featureCsvCols &&
          overlayRole === "intensity" &&
          !overlayRgbDisplay &&
          featureCsvCols.name ? (
            <FeatureCsvColumnPick
              headers={featureCsvCols.headers}
              name={featureCsvCols.name}
              onName={(name) => setFeatureCsvCols({ ...featureCsvCols, name })}
            />
          ) : null}
        </ImportOverlay>
      ) : null}
      {csvDrop ? (
        <FeatureCsvAttachDialog
          file={csvDrop.file}
          masks={csvDrop.masks}
          onClose={() => setCsvDrop(null)}
          onAttached={() => setNotice("Attached feature table.")}
        />
      ) : null}
    </>
  );
};

export { Upload };
