import type { FormEventHandler, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";

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
export type UploadProps = {
  handleKeys: string[];
  handles: Handle.File[];
  onAllow: () => Promise<void>;
  onRecall: () => Promise<void>;
  formProps: Omit<FormProps, "handles">;
  /** Bumps after a successful image import (`onStart` / restore); closes format picker. */
  importRevision: number;
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

const TwoColumn = styled.div`
  button {
    border: none;
    outline: 1px solid var(--theme-glass-edge);
    background-color: var(--theme-dark-main-color);
  }
  grid-template-columns: 1fr 1fr;
  display: grid;
  gap: 2em;
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
  gap: 1rem;
  padding: 1rem 1.25rem 1.5rem;
  box-sizing: border-box;
  color: #eee;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;

  form {
    max-width: 100%;
  }

  .form-control,
  .form-select {
    max-width: 100%;
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
  background: rgb(0 0 0 / 0.2);
  border: 1px solid rgb(255 255 255 / 0.2);
  color: rgb(248 250 252 / 0.95);
  padding: 6px 12px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.2;
  font-family: inherit;
  font-weight: 500;

  &:hover {
    background: rgb(0 0 0 / 0.3);
    border-color: rgb(255 255 255 / 0.28);
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
  gap: 1.25rem;
  width: 100%;
  min-width: 0;
  padding: 0;
`;

const FullWidthGrid = styled.div`
  grid-template-columns: auto 1fr;
  margin-left: 0;
  grid-column: 1 / -1;
  align-items: center;
  display: grid;
  column-gap: 1em;
  row-gap: 0.65em;
`;

const shadow_gray = "rgb(0 0 0 / 20%)";
const _sh_4_8 = `0 4px 8px 0 ${shadow_gray}`;
const _sh_6_20 = `0 6px 20px 0 ${shadow_gray}`;
const UploadDiv = styled.div`
  display: grid;
  align-items: start;
  align-content: start;
  width: 100%;
  min-width: 0;
  grid-template-columns: auto minmax(240px, 1fr);
  grid-template-rows: auto;
  gap: 0.65em;
  button {
    border: none;
    grid-column: 1 / -1;
    outline: 1px solid var(--theme-glass-edge);
    background-color: var(--theme-dark-main-color);
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
  button {
    border: none;
    outline: 1px solid var(--theme-glass-edge);
    background-color: var(--theme-dark-main-color);
  }
  margin-top: 2em;
  display: grid;
  gap: 1em;
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
        <Button type="submit" variant="primary">
          Submit
        </Button>
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
  const maskOptions = { label: "Mask", vals: choices.mask };
  const csvOptions = { label: "CSV", vals: choices.csv };
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
      </FormGrid>
      <FormGrid>
        <Button type="submit" variant="primary">
          Submit
        </Button>
      </FormGrid>
    </Form>
  );
};

const Upload = (props: UploadProps) => {
  const [imageFormat, setImageFormat] = useState("");
  const [updatePickerOpen, setUpdatePickerOpen] = useState(false);
  const prevImportRev = useRef(props.importRevision);
  const { formProps, handles, onAllow, onRecall, importRevision } = props;

  useEffect(() => {
    if (prevImportRev.current !== importRevision) {
      prevImportRev.current = importRevision;
      setUpdatePickerOpen(false);
      setImageFormat("");
    }
  }, [importRevision]);

  const allowProps = {
    onClick: onAllow,
    variant: "primary" as const,
    className: "mb-3",
  };
  const recallProps = {
    onClick: onRecall,
    variant: "primary" as const,
    className: "mb-3",
  };
  const selectDicomWebFormat = () => {
    setImageFormat("DICOM-WEB");
  };
  const selectOmeTiffFormat = () => {
    setImageFormat("OME-TIFF");
    onAllow();
  };

  let possibleActions: ReactNode = null;
  if (imageFormat === "OME-TIFF") {
    possibleActions = (
      <>
        <Button {...allowProps}>Select Image</Button>
        <Button {...recallProps}>Use recent Image</Button>
      </>
    );
  }
  if (imageFormat === "DICOM-WEB") {
    possibleActions = <FormDicom {...formProps} />;
  }

  const fullFormProps = { ...formProps, handles };

  const formatPickerGrid = (
    <FullWidthGrid>
      <Button onClick={selectDicomWebFormat} className="dicom-toggle">
        <span>DicomWeb</span>
      </Button>
      <div>{"Connect to a DICOMweb™ Proxy"}</div>
      <Button onClick={selectOmeTiffFormat} className="dicom-toggle">
        <span>OME-TIFF</span>
      </Button>
      <div>{"Open an OME-TIFF from a local file"}</div>
    </FullWidthGrid>
  );

  if (handles.length === 0) {
    return (
      <ImagesTabShell slot="images">
        <UploadDiv>
          {formatPickerGrid}
          {possibleActions}
        </UploadDiv>
      </ImagesTabShell>
    );
  }

  const closeUpdatePicker = () => {
    setUpdatePickerOpen(false);
    setImageFormat("");
  };

  const updateImageRow = (
    <TwoColumn>
      <Button
        type="button"
        onClick={() => {
          setUpdatePickerOpen(true);
          setImageFormat("");
        }}
      >
        Update Image
      </Button>
    </TwoColumn>
  );

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
        <UploadDiv>
          {imageFormat === "" ? formatPickerGrid : null}
          {possibleActions}
          {imageFormat === "OME-TIFF" ? <FormAny {...fullFormProps} /> : null}
        </UploadDiv>
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
