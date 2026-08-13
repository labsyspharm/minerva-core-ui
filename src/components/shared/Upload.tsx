import type { ChangeEventHandler, FormEventHandler } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import { TrashIcon } from "@/components/shared/common/TrashIcon";
import AnnotationsIcon from "@/components/shared/icons/shapes.svg?react";
import { CompactHeader } from "@/components/shared/panel/CompactHeader";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import panel from "@/components/shared/panel/panelShared.module.css";
import { resolveImageContentRole } from "@/lib/imaging/channelKind";
import {
  ensureFileHandlePermission,
  findFile,
  toFile,
} from "@/lib/imaging/filesystem";
import { applyOmeRoisFromAnnotationXmlString } from "@/lib/shapes/applyOmeRoisToDocument";
import type { Image } from "@/lib/stores/documentStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { jpegSourceNeedsLocalRoot } from "@/lib/storyExport/importStoryFolder";
import type { ValidObj } from "@/lib/validate";
import styles from "./Upload.module.css";

export type { ValidObj } from "@/lib/validate";

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

export type FormProps = {
  valid: ValidObj;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

/** How the current viewport image was sourced (for Images tab summary). */
export type LoadedImageKind = "ome-local" | "ome-url" | "dicom";

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

import type {
  OmeImageImportRole,
  OmeImportResult,
} from "@/lib/imaging/omeImport";

/** Intensity stack vs label / segmentation file. */
export type OmeImportRole = OmeImageImportRole;
export type { OmeImportResult };

export type OmeImportRequest = {
  role: OmeImportRole;
  append: boolean;
  source:
    | { kind: "local"; path: string; handles: Handle.File[] }
    | { kind: "url"; url: string };
};

export type UploadProps = {
  onAllow: () => Promise<Handle.File[]>;
  formProps: FormProps;
  /** Bumps after a successful image import; closes the add panel. */
  importRevision: number;
  /** True when the viewer has image data (same idea as `!noLoader` in main). */
  imageLoaded: boolean;
  /** Present when `imageLoaded`; dimensions may be 0 briefly while metadata arrives. */
  loadedSource?: LoadedSourceSummary;
  /** Viewer label for the primary loaded stack (local filename or URL basename). */
  fileName?: string;
  lastOmeTiffUrl?: string | null;
  onImportOme?: (
    req: OmeImportRequest,
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
};
type ValidationFunction = (v: ValidObj) => boolean | null;
type Validation = (s: string) => ValidationFunction;
type ValidOut = Partial<{
  isValid: true;
  isInvalid: true;
}>;
type Validate = (v: ValidObj, fn: ValidationFunction) => ValidOut;
type SetState = (s: string) => void;
type SetTargetState = FormEventHandler;
type UseTargetState = (init: string) => [string, SetState, SetTargetState];

const _useState: UseTargetState = (init) => {
  const [val, set] = useState(init);
  const new_set: SetTargetState = (e) => {
    const form = e.target as HTMLFormElement;
    set(form.value);
  };
  return [val, set, new_set];
};

const validation: Validation = (key) => {
  return (valid) => {
    if (key in valid) {
      return !!valid[key];
    }
    return null;
  };
};

const validate: Validate = (valid, fn) => {
  const validated = fn(valid);
  if (validated === null) {
    return {};
  }
  const opt = validated ? "isValid" : "isInvalid";
  return { [opt]: true };
};

function validationInputClass(v: ValidOut): string {
  const parts = [styles.textInput];
  if (v.isInvalid) parts.push(styles.textInputInvalid);
  if (v.isValid) parts.push(styles.textInputValid);
  return parts.join(" ");
}

const FormDicom = (props: FormProps) => {
  const { valid, onSubmit } = props;
  const [url, _sU, setURL] = _useState("");
  const [name, _sN, setName] = _useState("");
  const urlValidation = validate(valid, ({ url: validEndpoint }) => {
    if (validEndpoint === undefined) {
      return null;
    }
    return (
      validEndpoint &&
      /^https?:\/\/.+\/studies\/[^/]+\/series\/[^/]+$/.test(url)
    );
  });
  const nameValidation = validate(valid, validation("name"));

  return (
    <form onSubmit={onSubmit} noValidate className={styles.dicomForm}>
      <div className={styles.fieldGroup}>
        <label htmlFor="dicom-url" className={styles.fieldLabel}>
          DICOMweb™ URL:
        </label>
        <div className={styles.fieldRow}>
          <input
            id="dicom-url"
            type="text"
            required
            value={url}
            name="url"
            onChange={setURL}
            className={validationInputClass(urlValidation)}
            aria-invalid={urlValidation.isInvalid ?? undefined}
          />
          {urlValidation.isInvalid && (
            <div className={styles.invalidFeedback}>Invalid DICOMweb™ URL</div>
          )}
          {urlValidation.isValid && (
            <div className={styles.validFeedback}>Valid.</div>
          )}
        </div>
      </div>
      <div className={styles.fieldGroup}>
        <label htmlFor="dicom-name" className={styles.fieldLabel}>
          Dataset Name:
        </label>
        <div className={styles.fieldRow}>
          <input
            id="dicom-name"
            type="text"
            required
            value={name}
            name="name"
            onChange={setName}
            className={validationInputClass(nameValidation)}
            aria-invalid={nameValidation.isInvalid ?? undefined}
          />
          {nameValidation.isInvalid && (
            <div className={styles.invalidFeedback}>
              Please name the dataset.
            </div>
          )}
          {nameValidation.isValid && (
            <div className={styles.validFeedback}>Valid.</div>
          )}
        </div>
      </div>
      <button type="submit" className={styles.primaryButton}>
        Submit
      </button>
    </form>
  );
};

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
    return src.modality ? `${src.series} (${src.modality})` : src.series;
  }
  if (index === 0 && opts.fileName.trim()) return opts.fileName.trim();
  if (index === 0 && opts.lastOmeTiffUrl) {
    const u = opts.lastOmeTiffUrl;
    return u.split("/").pop() || u;
  }
  return `Image ${index + 1}`;
}

const OmeTiffUrlImport = (props: {
  url: string;
  onUrlChange: SetTargetState;
  onImport: () => void;
  importLabel: string;
  canImport: boolean;
  inputClassName: string;
  rowClassName: string;
  primaryClassName: string;
}) => {
  const {
    url,
    onUrlChange,
    onImport,
    importLabel,
    canImport,
    inputClassName,
    rowClassName,
    primaryClassName,
  } = props;
  return (
    <div className={rowClassName}>
      <input
        type="text"
        required
        value={url}
        name="ome_tiff_url"
        placeholder=""
        onChange={onUrlChange}
        className={`${styles.textInput} ${inputClassName}`}
      />
      <button
        type="button"
        className={primaryClassName}
        onClick={onImport}
        disabled={!canImport}
      >
        {importLabel}
      </button>
    </div>
  );
};

type ImageFormatChoice = "" | "DICOM-WEB" | "OME-TIFF" | "OME-TIFF-URL";

function FormatChip(props: {
  label: string;
  selected: boolean;
  onClick: () => void;
  chipClass: string;
  chipActiveClass: string;
}) {
  const { label, selected, onClick, chipClass, chipActiveClass } = props;
  const className = selected ? `${chipClass} ${chipActiveClass}` : chipClass;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      onClick={onClick}
    >
      {label}
    </button>
  );
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

/** Prefer Mask when the chip says so, or the file/URL name clearly looks like one. */
function resolveImportRole(
  selected: OmeImportRole,
  pathOrName: string,
): OmeImportRole {
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

const Upload = (props: UploadProps) => {
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [importRole, setImportRole] = useState<OmeImportRole>("intensity");
  const [imageFormat, setImageFormat] = useState<ImageFormatChoice>("");
  const [omeTiffUrl, _setOmeTiffUrl, setOmeTiffUrl] = _useState("");
  const [xmlImportFeedback, setXmlImportFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const xmlFileInputRef = useRef<HTMLInputElement | null>(null);
  const addPanelRef = useRef<HTMLDivElement | null>(null);
  const addAnchorRef = useRef<HTMLDivElement | null>(null);
  const prevImportRev = useRef(props.importRevision);
  const localImportInFlightRef = useRef(false);

  const images = useDocumentStore((s) => s.images);

  const {
    formProps,
    onAllow,
    importRevision,
    imageLoaded,
    loadedSource,
    fileName = "",
    lastOmeTiffUrl = null,
    onImportOme,
    needsFileAccess = false,
    onRequestFileAccess,
    missingHandleKeys = [],
    onReselectFile,
    needsStoryRootReconnect = false,
    onReconnectStoryRoot,
    onRemoveImage,
    onReplaceImage,
  } = props;

  const closeAddPanel = useCallback(() => {
    setAddPanelOpen(false);
    setImportRole("intensity");
    setImageFormat("");
    setImportError(null);
  }, []);

  useEffect(() => {
    if (prevImportRev.current !== importRevision) {
      prevImportRev.current = importRevision;
      setAddPanelOpen(false);
      setImportRole("intensity");
      setImageFormat("");
      _setOmeTiffUrl("");
      setImportError(null);
      setXmlImportFeedback(null);
    }
  }, [importRevision, _setOmeTiffUrl]);

  useEffect(() => {
    if (!addPanelOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !addAnchorRef.current?.contains(target) &&
        !addPanelRef.current?.contains(target)
      ) {
        closeAddPanel();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAddPanel();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addPanelOpen, closeAddPanel]);

  const labelOpts = { fileName, lastOmeTiffUrl };
  const append = imageLoaded;
  const isMaskImport = importRole === "segmentation";
  const importLabel = isMaskImport ? "Import mask" : "Import";
  const urlReady = /^https?:\/\/.+/.test(omeTiffUrl.trim());

  const setRole = (role: OmeImportRole) => {
    setImportRole(role);
    setImportError(null);
    setImageFormat("");
  };

  const importLocalOmeTiff = async (
    role: OmeImportRole,
    picked: Handle.File[],
  ) => {
    if (picked.length === 0 || !onImportOme) return;
    setImportError(null);
    const result = await onImportOme({
      role,
      append: imageLoaded,
      source: {
        kind: "local",
        path: picked[0].name,
        handles: picked,
      },
    });
    if (result && result.ok === false) setImportError(result.error);
  };

  const chooseLocalOmeTiff = async () => {
    if (localImportInFlightRef.current) return;
    localImportInFlightRef.current = true;
    setImportError(null);
    try {
      // Fresh picker each time; masks use toFile so they don't clobber the intensity handle.
      const picked = isMaskImport ? await toFile() : await onAllow();
      if (picked.length === 0) {
        setImageFormat("");
        return;
      }
      const handle = picked[0];
      if (!(await ensureFileHandlePermission(handle))) {
        setImportError(
          isMaskImport
            ? "Allow file access to load this mask."
            : "Allow file access to load this image.",
        );
        return;
      }
      if (!(await findFile({ handle }))) {
        setImportError("Could not read the selected file.");
        return;
      }
      const role = resolveImportRole(importRole, handle.name);
      if (role !== importRole) setImportRole(role);
      await importLocalOmeTiff(role, picked);
    } finally {
      localImportInFlightRef.current = false;
    }
  };

  const runUrlImport = async () => {
    if (!onImportOme || imageFormat !== "OME-TIFF-URL" || !urlReady) return;
    setImportError(null);
    const url = omeTiffUrl.trim();
    const role = resolveImportRole(importRole, url);
    if (role !== importRole) setImportRole(role);
    const result = await onImportOme({
      role,
      append,
      source: { kind: "url", url },
    });
    if (result && result.ok === false) setImportError(result.error);
  };

  const toggleAddPanel = () => {
    if (addPanelOpen) {
      closeAddPanel();
      return;
    }
    setAddPanelOpen(true);
    setImportRole("intensity");
    setImageFormat("");
    setImportError(null);
  };

  const selectFormat = (format: ImageFormatChoice) => {
    setImportError(null);
    const next = imageFormat === format ? "" : format;
    setImageFormat(next);
    if (next === "OME-TIFF") void chooseLocalOmeTiff();
  };

  const onAnnotationXmlSelected: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file
      .text()
      .then((text) => {
        const r = applyOmeRoisFromAnnotationXmlString(text);
        if (r.success === false) {
          setXmlImportFeedback({ type: "err", text: r.error });
          return;
        }
        setXmlImportFeedback({
          type: "ok",
          text: `Imported ${r.shapeCount} annotation${r.shapeCount === 1 ? "" : "s"}.`,
        });
      })
      .catch((err: unknown) => {
        setXmlImportFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Could not read the file.",
        });
      });
  };

  const renderAddPanelBody = () => {
    // OME-TIFF opens the OS picker immediately — no body row under the chips.
    if (imageFormat === "OME-TIFF") {
      return importError ? (
        <div className={styles.addPanelBody}>
          <div className={styles.importError}>{importError}</div>
        </div>
      ) : null;
    }
    if (imageFormat === "OME-TIFF-URL") {
      return (
        <div className={styles.addPanelBody}>
          <OmeTiffUrlImport
            url={omeTiffUrl}
            onUrlChange={setOmeTiffUrl}
            onImport={() => void runUrlImport()}
            importLabel={importLabel}
            canImport={urlReady}
            inputClassName={styles.urlInput}
            rowClassName={styles.urlRow}
            primaryClassName={styles.primaryButton}
          />
          {importError ? (
            <div className={styles.importError}>{importError}</div>
          ) : null}
        </div>
      );
    }
    if (imageFormat === "DICOM-WEB" && !isMaskImport) {
      return (
        <div className={styles.addPanelBody}>
          <FormDicom {...formProps} />
        </div>
      );
    }
    return null;
  };

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
                <button
                  type="button"
                  className={styles.imageCardAction}
                  title={`Replace ${title} with another OME-TIFF`}
                  aria-label={`Replace ${title}`}
                  onClick={() => void onReplaceImage(im.id)}
                >
                  <ReplaceIcon title="Replace image" size={14} />
                </button>
              ) : null}
              {onRemoveImage ? (
                <button
                  type="button"
                  className={`${styles.imageCardAction} ${styles.imageCardActionDanger}`}
                  title={`Remove ${title}`}
                  aria-label={`Remove ${title}`}
                  onClick={() => void onRemoveImage(im.id)}
                >
                  <TrashIcon title="Remove image" size={14} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {showAccessOverlay ? (
          <div className={styles.fileAccessOverlay}>
            <span className={styles.fileAccessError}>
              {needsStoryDir ? "Story folder needed" : "File access needed"}
            </span>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                if (needsStoryDir) void onReconnectStoryRoot?.();
                else if (needsReselect) void onReselectFile?.(im.id);
                else void onRequestFileAccess?.();
              }}
            >
              {needsStoryDir ? "Choose story folder" : "Allow file access"}
            </button>
          </div>
        ) : null}
      </article>
    );
  };

  const imageCards =
    images.length > 0 ? (
      images.map((im, i) => renderImageCard(im, i))
    ) : imageLoaded && loadedSource ? (
      <article className={styles.imageCard}>
        <div className={styles.imageCardHeader}>
          <div className={styles.imageCardText}>
            <div className={styles.imageCardTitle}>{loadedSource.label}</div>
            <div className={styles.imageCardMeta}>
              {formatDims(
                loadedSource.width,
                loadedSource.height,
                loadedSource.channelCount,
              ) ?? "Loading dimensions…"}
            </div>
          </div>
        </div>
      </article>
    ) : null;

  const addPanel = addPanelOpen ? (
    <div ref={addPanelRef} className={styles.addPanel}>
      <div className={styles.formatRow}>
        <FormatChip
          label="Image"
          selected={!isMaskImport}
          onClick={() => setRole("intensity")}
          chipClass={styles.formatChip}
          chipActiveClass={styles.formatChipActive}
        />
        <FormatChip
          label="Mask"
          selected={isMaskImport}
          onClick={() => setRole("segmentation")}
          chipClass={styles.formatChip}
          chipActiveClass={styles.formatChipActive}
        />
      </div>
      <div className={styles.formatRow}>
        {!isMaskImport ? (
          <FormatChip
            label="DicomWeb"
            selected={imageFormat === "DICOM-WEB"}
            onClick={() => selectFormat("DICOM-WEB")}
            chipClass={styles.formatChip}
            chipActiveClass={styles.formatChipActive}
          />
        ) : null}
        <FormatChip
          label="OmeTiff File"
          selected={imageFormat === "OME-TIFF"}
          onClick={() => selectFormat("OME-TIFF")}
          chipClass={styles.formatChip}
          chipActiveClass={styles.formatChipActive}
        />
        <FormatChip
          label="OmeTiff URL"
          selected={imageFormat === "OME-TIFF-URL"}
          onClick={() => selectFormat("OME-TIFF-URL")}
          chipClass={styles.formatChip}
          chipActiveClass={styles.formatChipActive}
        />
      </div>
      {renderAddPanelBody()}
    </div>
  ) : null;

  return (
    <div className={panel.authorPanel}>
      <CompactHeader
        actions={
          <div className={styles.headerActionsWrap}>
            {imageLoaded ? (
              <>
                <input
                  ref={xmlFileInputRef}
                  className={styles.hiddenFileInput}
                  type="file"
                  accept=".xml,application/xml,text/xml"
                  aria-label="OME-XML annotations file"
                  onChange={onAnnotationXmlSelected}
                />
                <PanelIconButton
                  aria-label="Import annotations"
                  title="Import annotations"
                  onClick={() => xmlFileInputRef.current?.click()}
                >
                  <AnnotationsIcon width={14} height={14} aria-hidden />
                </PanelIconButton>
              </>
            ) : null}
            <div ref={addAnchorRef} className={styles.addActionAnchor}>
              <PanelIconButton
                active={addPanelOpen}
                aria-pressed={addPanelOpen}
                aria-label="Add image or mask"
                title="Add"
                onClick={toggleAddPanel}
              >
                <PlusIcon />
              </PanelIconButton>
            </div>
            {addPanel}
          </div>
        }
      />

      <div
        className={[
          styles.stack,
          panel.authorPanelBody,
          panel.thinScrollbar,
        ].join(" ")}
      >
        {imageCards}

        {xmlImportFeedback ? (
          <div
            className={
              xmlImportFeedback.type === "err"
                ? styles.importError
                : styles.importSuccess
            }
          >
            {xmlImportFeedback.text}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export { Upload };
