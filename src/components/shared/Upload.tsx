import type { ChangeEventHandler, FormEventHandler, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import { applyOmeRoisFromAnnotationXmlString } from "@/lib/shapes/applyOmeRoisToDocument";

type Choices = {
  csv: string[];
  path: string[];
  mask: string[];
};
type ChoiceAnyIn = {
  handles: Handle.File[];
  setMask: SetState;
  setPath: SetState;
  setCsv: SetState;
  mask: string;
  path: string;
  csv: string;
};
type ToChoicesAny = (i: ChoiceAnyIn) => Promise<Choices>;
type OptionsProps = {
  label: string;
  vals: string[];
};
export type FormProps = {
  valid: ValidObj;
  onSubmit: FormEventHandler<HTMLFormElement>;
};
export type FullFormProps = FormProps & {
  handles: Handle.File[];
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

export type UploadProps = {
  handleKeys: string[];
  handles: Handle.File[];
  onAllow: () => Promise<void>;
  onRecall: () => Promise<void>;
  formProps: Omit<FormProps, "handles">;
  /** Bumps after a successful image import (`onStart` / restore); closes format picker. */
  importRevision: number;
  /** True when the viewer has image data (same idea as `!noLoader` in main). */
  imageLoaded: boolean;
  /** Present when `imageLoaded`; dimensions may be 0 briefly while metadata arrives. */
  loadedSource?: LoadedSourceSummary;
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

/** Update + optional “Use recent” — one column when only Update (image already loaded). */
const UpdateActionsRow = styled.div<{ $twoColumns: boolean }>`
  display: grid;
  gap: 0.65em;
  width: 100%;
  align-items: stretch;
  grid-template-columns: ${({ $twoColumns }) =>
    $twoColumns ? "1fr 1fr" : "1fr"};

  & > * {
    width: 100%;
  }
`;
const _FullHeightText = styled.div`
  grid-template-columns: auto 2em 1fr;
  margin-bottom: 1em;
  display: grid;
  gap: 1em;
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

const ImagesBackChevron = styled(ChevronDownIcon)`
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
  transform: rotate(90deg);
  color: inherit;
  opacity: 0.95;
`;

const ImagesBackButton = styled.button`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  flex-shrink: 0;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #e6edf3;
  padding: 6px 12px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.2;
  font-family: inherit;
  font-weight: 500;

  &:hover {
    background: #2a2a2a;
    border-color: #444;
    color: #fff;
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: 2px;
  }
`;

const ImagesLoadedStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  min-width: 0;
  padding: 0;
`;

const CurrentImageBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`;

const CurrentImageSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #121212;
  border: 1px solid #252525;
  min-width: 0;
`;

const CurrentImageTitle = styled.div`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 48%, transparent);
`;

const ImageLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  word-break: break-word;
  color: #f0f4f8;
`;

const ImageMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 8px;
  font-size: 11px;
  line-height: 1.45;
  color: #8b949e;
`;

const KindHint = styled.span`
  color: #6e7681;
  font-weight: 500;
`;

const MetaSep = styled.span`
  color: #484f58;
  user-select: none;
`;

const ImageMetaText = styled.span`
  color: #8b949e;
`;

const XmlImportMessage = styled.div<{ $err: boolean }>`
  font-size: 11px;
  line-height: 1.4;
  color: ${(p) => (p.$err ? "#f85149" : "color-mix(in srgb, #7ee787 92%, #fff 8%)")};
`;

const XmlImportBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
  align-items: stretch;

  input[type="file"] {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
`;

const DisclosureButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #c8d0d8;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: #2a2a2a;
    border-color: #444;
    color: #e6edf3;
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: 2px;
  }
`;

const FormatGridHint = styled.div`
  font-size: 11px;
  line-height: 1.35;
  color: #888;
  min-width: 0;
`;

/** Short line for the metadata row (no pill badge). */
const kindHint = (kind: LoadedImageKind): string => {
  switch (kind) {
    case "ome-local":
      return "Local file · OME-TIFF";
    case "ome-url":
      return "OME-TIFF · URL";
    case "dicom":
      return "DICOMweb";
  }
};

const FullWidthGrid = styled.div`
  grid-template-columns: auto 1fr;
  margin-left: 0;
  grid-column: 1 / -1;
  align-items: center;
  display: grid;
  column-gap: 0.65em;
  row-gap: 0.5em;
`;

const UploadDiv = styled.div`
  display: grid;
  align-items: start;
  align-content: start;
  width: 100%;
  min-width: 0;
  grid-template-columns: auto minmax(240px, 1fr);
  grid-template-rows: auto;
  gap: 0.65em;
  /* Layout only — colors come from DarkPrimaryButton */
  button:not(.dicom-toggle) {
    grid-column: 1 / -1;
  }
  button.dicom-toggle {
    grid-column: 1;
    display: grid;
    grid-template-rows: 3px 1fr;
    span {
      grid-row: 2;
    }
  }
  .full-width {
    grid-column: 1 / -1;
  }
`;

const _PathGrid = styled.div`
  grid-template-columns: auto 1fr;
  white-space: nowrap;
  align-items: start;
  grid-gap: 2em;
  display: grid;
  code {
    color: white;
    font-size: 1em;
  }
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

const Options = (props: OptionsProps) => {
  const { label, vals } = props;
  const options = vals.map((value, i) => {
    const key = `${label}-${i}`;
    return (
      <option key={key} value={value}>
        {value}
      </option>
    );
  });
  return (
    <>
      <option value=""> No {label}</option> {options}
    </>
  );
};
const noChoice = (): Choices => {
  return { csv: [], path: [], mask: [] };
};

const validate: Validate = (valid, fn) => {
  const validated = fn(valid);
  if (validated === null) {
    return {};
  }
  const opt = validated ? "isValid" : "isInvalid";
  return { [opt]: true };
};

const FormOmeTiffUrl = (props: FormProps) => {
  const { valid, onSubmit } = props;
  const [url, _sU, setURL] = _useState("");
  const fProps = { onSubmit, className: "full-width" };
  return (
    <Form {...fProps} noValidate>
      <Form.Group {...toGroupProps("ome_tiff_url")}>
        <Form.Label>OME-TIFF URL:</Form.Label>
        <FormGridRow hasValidation>
          <Form.Control
            {...{
              type: "text",
              required: true,
              value: url,
              name: "ome_tiff_url",
              placeholder: "https://example.com/image.ome.tif",
              onChange: setURL,
              ...validate(valid, ({ ome_tiff_url: validUrl }) => {
                if (validUrl === undefined) return null;
                return validUrl && /^https?:\/\/.+/.test(url);
              }),
            }}
          />
          <Form.Control.Feedback type="invalid">
            Invalid URL
          </Form.Control.Feedback>
          <Form.Control.Feedback type="valid">Valid.</Form.Control.Feedback>
          <br />
        </FormGridRow>
      </Form.Group>
      <FormGrid>
        <DarkPrimaryButton type="submit">Load</DarkPrimaryButton>
      </FormGrid>
    </Form>
  );
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

const toChoicesAny: ToChoicesAny = async (opts) => {
  const files = opts.handles;
  const csv = files.reduce((o, v) => {
    if (v.name.match(/\.csv/)) {
      o.push(v.name);
    }
    return o;
  }, [] as string[]);
  const mask = files.reduce((o, v) => {
    if (v.name.match(/\.tiff?$/)) {
      o.push(v.name);
    }
    return o;
  }, [] as string[]);
  const path = [...mask];
  return {
    csv,
    path,
    mask,
  };
};

const hasNewChoice = (choices: Choices, c: Choices) => {
  return [
    c.csv.some((i: string) => !choices.csv.includes(i)),
    c.path.some((i: string) => !choices.path.includes(i)),
    c.mask.some((i: string) => !choices.mask.includes(i)),
  ].some((x) => x === true);
};

const FormAny = (props: FullFormProps) => {
  const { handles, valid, onSubmit } = props;
  const [choices, setChoices] = useState(noChoice());
  const [name, sN, setName] = _useState("");
  const [path, sP, setPath] = _useState("");
  const [mask, sM, setMask] = _useState("");
  const [csv, sC, setCsv] = _useState("");
  const fProps = { onSubmit };
  useEffect(() => {
    toChoicesAny({
      handles,
      mask,
      path,
      csv,
      setMask: sM,
      setPath: sP,
      setCsv: sC,
    }).then((c) => {
      if (hasNewChoice(choices, c)) {
        sN(c.path[0].split(".")[0]);
        sP(c.path[0]);
        setChoices(c);
      }
    });
  }, [csv, handles, mask, path, sC, sM, sN, sP, choices]);
  const pathOptions = { label: "Image", vals: choices.path };
  // Mask / CSV mapping UI hidden — import flow targets channel TIFFs only
  // const maskOptions = { label: "Mask", vals: choices.mask };
  // const csvOptions = { label: "CSV", vals: choices.csv };
  return (
    <Form {...fProps} noValidate>
      <Form.Group {...toGroupProps("name")}>
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
      </Form.Group>
      <FormGrid id="custom_import">
        <Form.Group {...toGroupProps("path")}>
          <Form.Label>Channel File Path:</Form.Label>
          <FormGridRow hasValidation>
            <Form.Control
              {...{
                type: "select",
                as: "select",
                required: true,
                value: path,
                name: "path",
                onChange: setPath,
                ...validate(valid, validation("path")),
              }}
            >
              <Options {...pathOptions} />
            </Form.Control>
            <Form.Control.Feedback type="invalid">
              Please provide a valid path to the channel image file.
            </Form.Control.Feedback>
            <Form.Control.Feedback type="valid">Valid.</Form.Control.Feedback>
            <br />
          </FormGridRow>
        </Form.Group>
        {/*
        <Form.Group {...toGroupProps("mask")}>
          <Form.Label>Segmentation File Path:</Form.Label>
          <FormGridRow hasValidation>
            <Form.Control
              {...{
                type: "select",
                as: "select",
                required: false,
                value: mask,
                name: "mask",
                onChange: setMask,
                ...validate(valid, validation("mask")),
              }}
            >
              <Options {...maskOptions} />
            </Form.Control>
            <Form.Control.Feedback type="invalid">
              Please provide a valid path to the segmentation mask.
            </Form.Control.Feedback>
            <Form.Control.Feedback type="valid">Valid.</Form.Control.Feedback>
            <br />
          </FormGridRow>
        </Form.Group>
        <Form.Group {...toGroupProps("csv")}>
          <Form.Label>CSV File Path:</Form.Label>
          <FormGridRow hasValidation>
            <Form.Control
              {...{
                type: "select",
                as: "select",
                required: false,
                value: csv,
                name: "csv",
                onChange: setCsv,
                ...validate(valid, validation("csv")),
              }}
            >
              <Options {...csvOptions} />
            </Form.Control>
            <Form.Control.Feedback type="invalid">
              Please provide a valid single cell csv file.
            </Form.Control.Feedback>
            <Form.Control.Feedback type="valid">Valid.</Form.Control.Feedback>
          </FormGridRow>
        </Form.Group>
        */}
      </FormGrid>
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

const Upload = (props: UploadProps) => {
  const [imageFormat, setImageFormat] = useState("");
  const [updatePickerOpen, setUpdatePickerOpen] = useState(false);
  const [mappingExpanded, setMappingExpanded] = useState(false);
  const [xmlImportFeedback, setXmlImportFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const xmlFileInputRef = useRef<HTMLInputElement | null>(null);
  const prevImportRev = useRef(props.importRevision);
  const {
    formProps,
    handles,
    onAllow,
    onRecall,
    importRevision,
    imageLoaded,
    loadedSource,
  } = props;

  useEffect(() => {
    if (prevImportRev.current !== importRevision) {
      prevImportRev.current = importRevision;
      setUpdatePickerOpen(false);
      setImageFormat("");
      setMappingExpanded(false);
      setXmlImportFeedback(null);
    }
  }, [importRevision]);

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

  const annotationXmlPanel = imageLoaded ? (
    <XmlImportBlock>
      <input
        ref={xmlFileInputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        aria-label="OME-XML annotations file"
        onChange={onAnnotationXmlSelected}
      />
      <DarkPrimaryButton
        type="button"
        onClick={() => xmlFileInputRef.current?.click()}
      >
        Import annotations (XML)
      </DarkPrimaryButton>
      {xmlImportFeedback ? (
        <XmlImportMessage $err={xmlImportFeedback.type === "err"}>
          {xmlImportFeedback.text}
        </XmlImportMessage>
      ) : null}
    </XmlImportBlock>
  ) : null;

  const allowProps = {
    onClick: onAllow,
    className: "mb-3",
  };
  const recallProps = {
    onClick: onRecall,
    className: "mb-3",
  };
  const selectDicomWebFormat = () => {
    setImageFormat("DICOM-WEB");
  };
  const selectOmeTiffFormat = () => {
    setImageFormat("OME-TIFF");
    onAllow();
  };
  const selectOmeTiffUrlFormat = () => {
    setImageFormat("OME-TIFF-URL");
  };

  let possibleActions: ReactNode = null;
  if (imageFormat === "OME-TIFF") {
    possibleActions = (
      <>
        <DarkPrimaryButton {...allowProps}>Select Image</DarkPrimaryButton>
        <DarkPrimaryButton {...recallProps}>Use recent Image</DarkPrimaryButton>
      </>
    );
  }
  if (imageFormat === "DICOM-WEB") {
    possibleActions = <FormDicom {...formProps} />;
  }
  if (imageFormat === "OME-TIFF-URL") {
    possibleActions = <FormOmeTiffUrl {...formProps} />;
  }

  const fullFormProps = { ...formProps, handles };

  const showFormAny =
    handles.length > 0 &&
    (!imageLoaded || handles.length > 1 || mappingExpanded);

  const currentImageSummary = imageLoaded ? (
    loadedSource ? (
      <CurrentImageBlock>
        <CurrentImageTitle>Current image</CurrentImageTitle>
        <CurrentImageSection>
          <ImageLabel title={loadedSource.label}>
            {loadedSource.label}
          </ImageLabel>
          <ImageMetaRow>
            <KindHint>
              {kindHint(loadedSource.kind)}
              {loadedSource.isDemo ? " · Demo" : ""}
            </KindHint>
            <MetaSep aria-hidden>·</MetaSep>
            <ImageMetaText>
              {formatDims(
                loadedSource.width,
                loadedSource.height,
                loadedSource.channelCount,
              ) ?? "Dimensions loading…"}
            </ImageMetaText>
          </ImageMetaRow>
        </CurrentImageSection>
      </CurrentImageBlock>
    ) : (
      <CurrentImageBlock>
        <CurrentImageTitle>Current image</CurrentImageTitle>
        <CurrentImageSection>
          <ImageMetaText>Loading details…</ImageMetaText>
        </CurrentImageSection>
      </CurrentImageBlock>
    )
  ) : null;

  const formatPickerGrid = (
    <FullWidthGrid>
      <DarkPrimaryButton
        onClick={selectDicomWebFormat}
        className="dicom-toggle"
      >
        <span>DicomWeb</span>
      </DarkPrimaryButton>
      <FormatGridHint>Connect to a DICOMweb™ Proxy</FormatGridHint>
      <DarkPrimaryButton onClick={selectOmeTiffFormat} className="dicom-toggle">
        <span>OME-TIFF</span>
      </DarkPrimaryButton>
      <FormatGridHint>Open an OME-TIFF from a local file</FormatGridHint>
      <DarkPrimaryButton
        onClick={selectOmeTiffUrlFormat}
        className="dicom-toggle"
      >
        <span>OME-TIFF URL</span>
      </DarkPrimaryButton>
      <FormatGridHint>Load an OME-TIFF from a URL</FormatGridHint>
    </FullWidthGrid>
  );

  const closeUpdatePicker = () => {
    setUpdatePickerOpen(false);
    setImageFormat("");
  };

  const showUseRecentInUpdateRow = handles.length > 0 && !imageLoaded;

  const updateImageRow = (
    <UpdateActionsRow $twoColumns={showUseRecentInUpdateRow}>
      <DarkPrimaryButton
        type="button"
        onClick={() => {
          setUpdatePickerOpen(true);
          setImageFormat("");
        }}
      >
        Update Image
      </DarkPrimaryButton>
      {showUseRecentInUpdateRow ? (
        <DarkPrimaryButton type="button" onClick={onRecall}>
          Use recent Image
        </DarkPrimaryButton>
      ) : null}
    </UpdateActionsRow>
  );

  const mappingDisclosure =
    imageLoaded && handles.length === 1 ? (
      <DisclosureButton
        type="button"
        onClick={() => setMappingExpanded((e) => !e)}
        aria-expanded={mappingExpanded}
      >
        {mappingExpanded
          ? "Hide channel file mapping"
          : "Edit channel file mapping"}
      </DisclosureButton>
    ) : null;

  if (updatePickerOpen) {
    return (
      <ImagesTabShell slot="images">
        <ImagesBackButton
          type="button"
          onClick={closeUpdatePicker}
          title="Back to image details"
        >
          <ImagesBackChevron aria-hidden />
          <span>Back</span>
        </ImagesBackButton>
        {imageLoaded ? currentImageSummary : null}
        {annotationXmlPanel}
        <UploadDiv>
          {imageFormat === "" ? formatPickerGrid : null}
          {possibleActions}
          {imageFormat === "OME-TIFF" ? <FormAny {...fullFormProps} /> : null}
        </UploadDiv>
      </ImagesTabShell>
    );
  }

  if (!imageLoaded && handles.length === 0) {
    return (
      <ImagesTabShell slot="images">
        <UploadDiv>
          {formatPickerGrid}
          {possibleActions}
        </UploadDiv>
      </ImagesTabShell>
    );
  }

  if (imageLoaded) {
    return (
      <ImagesTabShell slot="images">
        <ImagesLoadedStack>
          {currentImageSummary}
          {updateImageRow}
          {annotationXmlPanel}
          {mappingDisclosure}
          {showFormAny ? <FormAny {...fullFormProps} /> : null}
        </ImagesLoadedStack>
      </ImagesTabShell>
    );
  }

  return (
    <ImagesTabShell slot="images">
      <ImagesLoadedStack>
        {updateImageRow}
        <FormAny {...fullFormProps} />
      </ImagesLoadedStack>
    </ImagesTabShell>
  );
};

export { Upload };
