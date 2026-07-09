import type { ChangeEventHandler, FormEventHandler } from "react";
import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import { resolveImageContentRole } from "@/lib/imaging/channelKind";
import {
  ensureFileHandlePermission,
  findFile,
  toFile,
} from "@/lib/imaging/filesystem";
import { applyOmeRoisFromAnnotationXmlString } from "@/lib/shapes/applyOmeRoisToDocument";
import type { Image } from "@/lib/stores/documentStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import styles from "./Upload.module.css";

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
  handles: Handle.File[];
  onAllow: () => Promise<Handle.File[]>;
  onRecall: (options?: { notifyRestored?: boolean }) => Promise<Handle.File[]>;
  /** True when a persisted recent file handle is available for `onRecall`. */
  hasRecent: boolean;
  formProps: Omit<FormProps, "handles">;
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
};
export type ValidObj = {
  [s: string]: boolean;
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

interface HasValidation {
  hasValidation: boolean;
}

/** Matches Story / Channels: grey-on-black controls */
const DarkPrimaryButton = styled(Button).attrs({ variant: "primary" })`
  &&& {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #2a2a2a;
    border: 1px solid #444;
    color: #e6edf3;
    font-size: 12px;
    padding: 0.45rem 0.75rem;
    min-height: 2.25rem;
    line-height: 1.2;
    box-shadow: none;
  }
  &&&:hover:not(:disabled),
  &&&:focus:not(:disabled) {
    background-color: #333;
    border-color: #555;
    color: #fff;
  }
  &&&:active:not(:disabled) {
    background-color: #1a1a1a !important;
    border-color: #444 !important;
  }
  &&&:disabled {
    opacity: 0.45;
  }
`;

const ImagesTabShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 10px 8px 10px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  color: #e6edf3;
  font-size: 12px;
  background: #000;
  scrollbar-color: #555 #000;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: #000;
  }
  &::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 4px;
  }

  form {
    max-width: 100%;
  }

  .form-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--theme-light-contrast-color) 52%, transparent);
    margin-bottom: 0.35rem;
  }

  .form-control,
  .form-select {
    max-width: 100%;
    background-color: #2c2c2c;
    border: 1px solid #444;
    color: #e6edf3;
    font-size: 12px;
  }
  .form-control::placeholder {
    color: #8899aa;
    opacity: 1;
  }
  .form-control:focus,
  .form-select:focus {
    background-color: #2c2c2c;
    border-color: #666;
    color: #e6edf3;
    box-shadow: 0 0 0 0.15rem rgb(255 255 255 / 0.12);
  }
  .form-select option {
    background: #2c2c2c;
    color: #e6edf3;
  }
  .invalid-feedback,
  .valid-feedback {
    font-size: 11px;
  }
`;

const XmlImportMessage = styled.div<{ $err: boolean }>`
  font-size: 11px;
  line-height: 1.4;
  color: ${(p) => (p.$err ? "#f85149" : "color-mix(in srgb, #7ee787 92%, #fff 8%)")};
`;

const FullWidthGrid = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  width: 100%;
`;

const FormGrid = styled.div`
  margin-top: 1.25rem;
  display: grid;
  gap: 0.75rem;
`;
const FormGridRow = styled.div<HasValidation>`
  position: relative;
  .valid-feedback,
  .invalid-feedback {
    position: absolute;
    font-size: 0.75em;
  }
`;
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

const toGroupProps = (n: string) => {
  return { controlId: n };
};

const validate: Validate = (valid, fn) => {
  const validated = fn(valid);
  if (validated === null) {
    return {};
  }
  const opt = validated ? "isValid" : "isInvalid";
  return { [opt]: true };
};

const FormDicom = (props: FormProps) => {
  const { valid, onSubmit } = props;
  const [url, _sU, setURL] = _useState("");
  const [name, _sN, setName] = _useState("");
  const fProps = { onSubmit, className: "full-width" };
  return (
    <Form {...fProps} noValidate>
      <Form.Group {...toGroupProps("url")}>
        <Form.Label>DICOMweb™ URL:</Form.Label>
        <FormGridRow hasValidation>
          <Form.Control
            {...{
              type: "text",
              required: true,
              value: url,
              name: "url",
              onChange: setURL,
              ...validate(valid, ({ url: validEndpoint }) => {
                // DICOMweb data found at endpoint
                if (validEndpoint === undefined) {
                  return null;
                }
                // URL matches expectations
                return (
                  validEndpoint &&
                  /^https?:\/\/.+\/studies\/[^/]+\/series\/[^/]+$/.test(url)
                );
              }),
            }}
          />
          <Form.Control.Feedback type="invalid">
            Invalid DICOMweb™ URL
          </Form.Control.Feedback>
          <Form.Control.Feedback type="valid">Valid.</Form.Control.Feedback>
          <br />
        </FormGridRow>
        <FormGrid>
          <Form.Label>Dataset Name:</Form.Label>
          <FormGridRow hasValidation>
            <Form.Control
              {...{
                type: "text",
                required: true,
                value: name,
                name: "name",
                onChange: setName,
                ...validate(valid, validation("name")),
              }}
            />
            <Form.Control.Feedback type="invalid">
              Please name the dataset.
            </Form.Control.Feedback>
            <Form.Control.Feedback type="valid">Valid.</Form.Control.Feedback>
            <br />
          </FormGridRow>
        </FormGrid>
      </Form.Group>
      <FormGrid>
        <DarkPrimaryButton type="submit">Submit</DarkPrimaryButton>
      </FormGrid>
    </Form>
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
      <Form.Control
        type="text"
        required
        value={url}
        name="ome_tiff_url"
        placeholder=""
        onChange={onUrlChange}
        className={inputClassName}
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

const Upload = (props: UploadProps) => {
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [importRole, setImportRole] = useState<OmeImportRole>("intensity");
  const [imageFormat, setImageFormat] = useState("");
  const [omeTiffUrl, _setOmeTiffUrl, setOmeTiffUrl] = _useState("");
  const [xmlImportFeedback, setXmlImportFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [maskHandles, setMaskHandles] = useState<Handle.File[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const xmlFileInputRef = useRef<HTMLInputElement | null>(null);
  const prevImportRev = useRef(props.importRevision);
  const localImportInFlightRef = useRef(false);

  const images = useDocumentStore((s) => s.images);

  const {
    formProps,
    handles,
    onAllow,
    onRecall,
    hasRecent,
    importRevision,
    imageLoaded,
    loadedSource,
    fileName = "",
    lastOmeTiffUrl = null,
    onImportOme,
  } = props;

  useEffect(() => {
    if (prevImportRev.current !== importRevision) {
      prevImportRev.current = importRevision;
      setAddPanelOpen(false);
      setImportRole("intensity");
      setImageFormat("");
      _setOmeTiffUrl("");
      setMaskHandles([]);
      setImportError(null);
      setXmlImportFeedback(null);
    }
  }, [importRevision, _setOmeTiffUrl]);

  const labelOpts = { fileName, lastOmeTiffUrl };
  const append = imageLoaded;
  const isMaskImport = importRole === "segmentation";
  const importLabel = isMaskImport ? "Import mask" : "Import";
  const urlReady = /^https?:\/\/.+/.test(omeTiffUrl.trim());
  const activeLocalHandles = isMaskImport ? maskHandles : handles;

  const runUrlImport = async () => {
    if (!onImportOme || imageFormat !== "OME-TIFF-URL" || !urlReady) return;
    setImportError(null);
    const result = await onImportOme({
      role: importRole,
      append,
      source: { kind: "url", url: omeTiffUrl.trim() },
    });
    if (result && result.ok === false) setImportError(result.error);
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

  const chooseMaskFile = async () => {
    setImportError(null);
    const picked = await toFile();
    if (picked.length === 0) return;
    const handle = picked[0];
    if (!(await ensureFileHandlePermission(handle))) {
      setImportError("Allow file access to load this mask.");
      return;
    }
    if (!(await findFile({ handle }))) {
      setImportError("Could not read the selected file.");
      return;
    }
    setMaskHandles(picked);
    await importLocalOmeTiff("segmentation", picked);
  };

  const importIntensityFromHandles = async (picked: Handle.File[]) => {
    if (picked.length === 0 || localImportInFlightRef.current) return;
    localImportInFlightRef.current = true;
    try {
      const handle = picked[0];
      if (!(await ensureFileHandlePermission(handle))) {
        setImportError("Allow file access to load this image.");
        return;
      }
      if (!(await findFile({ handle }))) {
        setImportError("Could not read the selected file.");
        return;
      }
      await importLocalOmeTiff("intensity", picked);
    } finally {
      localImportInFlightRef.current = false;
    }
  };

  const chooseIntensityFile = async () => {
    setImportError(null);
    const picked = await onAllow();
    await importIntensityFromHandles(picked);
  };

  const recallIntensityFile = async () => {
    setImportError(null);
    const picked = await onRecall({ notifyRestored: false });
    await importIntensityFromHandles(picked);
  };

  const openAddPanel = (role: OmeImportRole) => {
    if (addPanelOpen && importRole === role) {
      closeAddPanel();
      return;
    }
    setImportRole(role);
    setAddPanelOpen(true);
    setImageFormat("");
    setMaskHandles([]);
    setImportError(null);
  };

  const closeAddPanel = () => {
    setAddPanelOpen(false);
    setImportRole("intensity");
    setImageFormat("");
    setMaskHandles([]);
    setImportError(null);
  };

  const selectFormat = (format: ImageFormatChoice) => {
    setImportError(null);
    const next = imageFormat === format ? "" : format;
    if (isMaskImport) setMaskHandles([]);
    setImageFormat(next);
    if (next !== "OME-TIFF") return;
    if (isMaskImport) {
      void chooseMaskFile();
      return;
    }
    if (handles.length > 0) {
      void importIntensityFromHandles(handles);
      return;
    }
    if (!hasRecent) {
      void chooseIntensityFile();
    }
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

  const addImageActive = addPanelOpen && importRole === "intensity";
  const addMaskActive = addPanelOpen && importRole === "segmentation";

  const renderAddPanelBody = () => {
    if (imageFormat === "OME-TIFF") {
      const fileLabel =
        activeLocalHandles.length === 1
          ? activeLocalHandles[0].name
          : activeLocalHandles.length > 1
            ? `${activeLocalHandles.length} files`
            : null;
      return (
        <div className={styles.addPanelBody}>
          <div className={styles.fileRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={isMaskImport ? chooseMaskFile : chooseIntensityFile}
            >
              Choose file
            </button>
            {!isMaskImport && hasRecent ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  void recallIntensityFile();
                }}
              >
                Recent
              </button>
            ) : null}
          </div>
          {fileLabel ? (
            <div className={styles.fileNameHint} title={fileLabel}>
              {fileLabel}
            </div>
          ) : null}
          {importError ? (
            <div className={styles.importError}>{importError}</div>
          ) : null}
        </div>
      );
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
    if (imageFormat === "DICOM-WEB" && importRole === "intensity") {
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

    return (
      <article key={im.id} className={styles.imageCard}>
        <div className={styles.imageCardHeader}>
          <div className={styles.imageCardTitle} title={title}>
            {title}
          </div>
          <div className={styles.imageCardMeta}>{metaParts.join(" · ")}</div>
        </div>
      </article>
    );
  };

  const imageCards =
    images.length > 0 ? (
      images.map((im, i) => renderImageCard(im, i))
    ) : imageLoaded && loadedSource ? (
      <article className={styles.imageCard}>
        <div className={styles.imageCardHeader}>
          <div className={styles.imageCardTitle}>{loadedSource.label}</div>
          <div className={styles.imageCardMeta}>
            {formatDims(
              loadedSource.width,
              loadedSource.height,
              loadedSource.channelCount,
            ) ?? "Loading dimensions…"}
          </div>
        </div>
      </article>
    ) : null;

  return (
    <ImagesTabShell slot="images">
      <div className={styles.header}>
        <span className={styles.headerTitle}>Images</span>
        <div className={styles.headerActions}>
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
              <button
                type="button"
                className={styles.headerActionButton}
                aria-label="Import annotations"
                title="Import annotations"
                onClick={() => xmlFileInputRef.current?.click()}
              >
                Import annotations
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={
              addMaskActive
                ? `${styles.headerActionButton} ${styles.headerActionButtonActive}`
                : styles.headerActionButton
            }
            aria-pressed={addMaskActive}
            aria-label="Add mask"
            title="Add mask"
            onClick={() => openAddPanel("segmentation")}
          >
            Add mask
          </button>
          <button
            type="button"
            className={
              addImageActive
                ? `${styles.headerActionButton} ${styles.headerActionButtonActive}`
                : styles.headerActionButton
            }
            aria-pressed={addImageActive}
            aria-label="Add image"
            title="Add image"
            onClick={() => openAddPanel("intensity")}
          >
            Add image
          </button>
        </div>
      </div>

      <div className={styles.stack}>
        {addPanelOpen ? (
          <div className={styles.addPanel}>
            <div className={styles.addPanelToolbar}>
              <div className={styles.formatRow}>
                {importRole === "intensity" ? (
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
              <button
                type="button"
                className={styles.cancelLink}
                onClick={closeAddPanel}
              >
                Cancel
              </button>
            </div>
            {renderAddPanelBody()}
          </div>
        ) : null}

        {imageCards}

        {xmlImportFeedback ? (
          <XmlImportMessage $err={xmlImportFeedback.type === "err"}>
            {xmlImportFeedback.text}
          </XmlImportMessage>
        ) : null}
      </div>
    </ImagesTabShell>
  );
};

export { Upload };
