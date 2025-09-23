import * as React from "react";
import { useState, useEffect } from "react";
import styled from 'styled-components';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { listDir } from "../lib/filesystem";

import type { Entry } from "../lib/filesystem";
import type { FormEventHandler } from "react";
type Choices = {
  dir: string[],
  csv: string[],
  path: string[],
  mask: string[],
}
type ChoiceAnyIn = {
  handle: Handle.Dir,
  setMask: SetState,
  setPath: SetState,
  setCsv: SetState,
  mask: string,
  path: string,
  csv: string
}
interface ToChoicesAny {
  (i: ChoiceAnyIn): Promise<Choices>
}
type OptionsProps = {
  label: string,
  vals: string[]
}
export type FormProps = {
  valid: ValidObj,
  onSubmit: FormEventHandler<HTMLFormElement>
}
export type FullFormProps = FormProps & {
  handle: Handle.Dir
}
export type UploadProps = {
  handleKeys: string[],
  handle: Handle.Dir | null,
  onAllow: () => Promise<void>,
  onRecall: () => Promise<void>,
  formProps: Omit<FormProps, 'handle'>
}
export type ValidObj = {
  [s: string]: boolean;
}
interface ValidationFunction {
  (v: ValidObj): boolean | null 
}
interface Validation {
  (s: string): ValidationFunction
}
type ValidOut = Partial<{
  isValid: true,
  isInvalid: true
}>
interface Validate {
  (v: ValidObj, fn: ValidationFunction): ValidOut;
}
type SetState = (s: string) => void;
type SetTargetState = FormEventHandler;
interface UseTargetState {
  (init: string): [string, SetState, SetTargetState];
}

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
`
const FullHeightText = styled.div`
  grid-template-columns: auto 2em 1fr;
  margin-bottom: 1em;
  display: grid;
  gap: 1em;
`
const FullWidthGrid = styled.div`
  grid-template-columns: auto 1fr;
  grid-column: 1 / -1;
  align-items: center;
  display: grid;
  gap: 0.25em;
`


const shadow_gray = 'rgb(0 0 0 / 20%)';
const sh_4_8 = `0 4px 8px 0 ${shadow_gray}`;
const sh_6_20 = `0 6px 20px 0 ${shadow_gray}`;
const UploadDiv = styled.div`
  height: 100%;
  display: grid;
  padding-top: 2em;
  align-items: start;
  grid-template-columns: auto minmax(320px,1fr);
  grid-template-rows: auto;
  gap: 0.5em;
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

const PathGrid = styled.div`
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
  height: 2em;
`
const _useState: UseTargetState = (init) => {
  const [val, set] = useState(init);
  const new_set: SetTargetState = (e) => {
    const form = e.target as HTMLFormElement;
    set(form.value)
  }
  return [val, set, new_set];
}
const validation: Validation = (key) => {
  return (valid) => {
    if (key in valid) {
      return !!valid[key];
    }
    return null;
  }
}

const toGroupProps = (n: string): any => {
  return {controlId: n};
};

const Options = (props: OptionsProps) => {
  const { label, vals } = props;
  const options = vals.map((value, i) => {
    return <option key={i} value={value}>{value}</option>;
  });
  return (<><option value=""> No {label}</option> {options}</>);
}
const noChoice = (): Choices => {
  return { dir: [], csv: [], path: [], mask: [] };
} 

const validate: Validate = (valid, fn) => {
  const validated = fn(valid);
  if ( validated === null ) {
    return {};
  }
  const opt = validated ? 'isValid' : 'isInvalid';
  return { [opt]: true }; 
}

const FormDicom = (props: FormProps) => {
  const { handle, valid, onSubmit } = props;
  const [ url, sU, setURL ] = _useState("");
  const [ name, sN, setName ] = _useState("");
  const fProps = { onSubmit, className: "full-width" };
  return (
  <Form {...fProps} noValidate>
      <Form.Group {...toGroupProps("url")}>
          <Form.Label>DICOMweb™ URL:</Form.Label>
          <FormGridRow hasValidation>
              <Form.Control {...{
                type: "text",
                required: true,
                value: url,
                name: "url",
                onChange: setURL,
                ...validate(
                  valid,
                  ({ url: validEndpoint }) => {
                    // DICOMweb data found at endpoint
                    if (validEndpoint === undefined) {
                      return null;
                    }
                    // URL matches expectations
                    return validEndpoint && (
                      /^(?:https?:\/\/)?[^\/]+\/current\/.+\/dicomWeb\/studies\/.+\/series\/.+$/
                    ).test(url)
                  }
                )
              }}/>
              <Form.Control.Feedback type="invalid">
              Invalid DICOMweb™ URL 
              </Form.Control.Feedback>
              <Form.Control.Feedback type="valid">
              Valid.
              </Form.Control.Feedback>
              <br/>
          </FormGridRow>
          <FormGrid>
              <Form.Label>Dataset Name:</Form.Label>
              <FormGridRow hasValidation>
                  <Form.Control {...{
                    type: "text",
                    required: true,
                    value: name,
                    name: "name",
                    onChange: setName,
                    ...validate(valid, validation('name'))
                  }}/>
                  <Form.Control.Feedback type="invalid">
                  Please name the dataset.
                  </Form.Control.Feedback>
                  <Form.Control.Feedback type="valid">
                  Valid.
                  </Form.Control.Feedback>
                  <br/>
              </FormGridRow>
        </FormGrid>
      </Form.Group>
      <FormGrid>
        <Button type="submit" variant="primary">Submit</Button>
      </FormGrid>
  </Form>
  );
}

const toChoicesAny: ToChoicesAny = async (opts) => {
  const { handle } = opts;
  const files = await listDir({ handle });
  const csv = files.reduce((o, [k, v]: Entry) => {
    if (v instanceof FileSystemFileHandle) {
      return k.match(/\.csv/) ? [...o, k] : o;
    }
    return o;
  }, [] as string[]);
  const mask = files.reduce((o, [k, v]: Entry) => {
    if (v instanceof FileSystemFileHandle) {
      return k.match(/\.tiff?$/) ? [...o, k] : o;
    }
    return o;
  }, [] as string[]);
  const path = [...mask];
  return {
    csv, path, mask, dir: []
  }
} 
const FormAny = (props: FullFormProps) => {
  const { handle, valid, onSubmit } = props;
  const [ choices, setChoices ] = useState(noChoice());
  const [ name, sN, setName ] = _useState("");
  const [ path, sP, setPath ] = _useState("");
  const [ mask, sM, setMask ] = _useState("");
  const [ csv, sC, setCsv ] = _useState("");
  const fProps = { onSubmit };
  const hasNewChoice = (c: Choices) => {
    return [
      c.csv.some((i: string) => !(i in choices.csv)),
      c.path.some((i: string) => !(i in choices.path)),
      c.mask.some((i: string) => !(i in choices.mask))
    ].some(x => x === true);
  }
  useEffect(() => {
    toChoicesAny({
      handle, mask, path, csv,
      setMask: sM, setPath: sP, setCsv: sC
    }).then(c => {
      if (hasNewChoice(c)) {
        sN(c.path[0].split('.')[0]);
        sP(c.path[0]);
        setChoices(c);
      }
    });
  }, [JSON.stringify(choices)]);
  const pathOptions = {label: "Image", vals: choices.path};
  const maskOptions = {label: "Mask", vals: choices.mask};
  const csvOptions = {label: "CSV", vals: choices.csv};
  return (
  <Form {...fProps} noValidate>
      <Form.Group {...toGroupProps("name")}>
          <Form.Label>Dataset Name:</Form.Label>
          <FormGridRow hasValidation>
              <Form.Control {...{
                type: "text",
                required: true,
                value: name,
                name: "name",
                onChange: setName,
                ...validate(valid, validation('name'))
              }}/>
              <Form.Control.Feedback type="invalid">
              Please name the dataset.
              </Form.Control.Feedback>
              <Form.Control.Feedback type="valid">
              Valid.
              </Form.Control.Feedback>
              <br/>
          </FormGridRow>
      </Form.Group> 
      <FormGrid id="custom_import">
          <Form.Group {...toGroupProps("path")}>
              <Form.Label>Channel File Path:</Form.Label>
              <FormGridRow hasValidation>
                  <Form.Control {...{
                    type: "select",
                    as: "select",
                    required: true,
                    value: path,
                    name: "path",
                    onChange: setPath,
                    ...validate(valid, validation('path'))
                  }}>
                  <Options {...pathOptions}/>
                  </Form.Control>
                  <Form.Control.Feedback type="invalid">
                  Please provide a valid path to the channel image file.
                  </Form.Control.Feedback>
                  <Form.Control.Feedback type="valid">
                  Valid.
                  </Form.Control.Feedback>
                  <br/>
              </FormGridRow>
          </Form.Group> 
          <Form.Group {...toGroupProps("mask")}>
              <Form.Label>Segmentation File Path:</Form.Label>
              <FormGridRow hasValidation>
                  <Form.Control {...{
                    type: "select",
                    as: "select",
                    required: false,
                    value: mask,
                    name: "mask",
                    onChange: setMask,
                    ...validate(valid, validation('mask'))
                  }}>
                  <Options {...maskOptions}/>
                  </Form.Control>
                  <Form.Control.Feedback type="invalid">
                  Please provide a valid path to the segmentation mask.
                  </Form.Control.Feedback>
                  <Form.Control.Feedback type="valid">
                  Valid.
                  </Form.Control.Feedback>
                  <br/>
              </FormGridRow>
          </Form.Group> 
          <Form.Group {...toGroupProps("csv")}>
              <Form.Label>CSV File Path:</Form.Label>
              <FormGridRow hasValidation>
                  <Form.Control {...{
                    type: "select",
                    as: "select",
                    required: false,
                    value: csv,
                    name: "csv",
                    onChange: setCsv,
                    ...validate(valid, validation('csv'))
                  }}>
                  <Options {...csvOptions}/>
                  </Form.Control>
                  <Form.Control.Feedback type="invalid">
                      Please provide a valid single cell csv file.
                  </Form.Control.Feedback>
                  <Form.Control.Feedback type="valid">
                      Valid.
                  </Form.Control.Feedback>
              </FormGridRow>
          </Form.Group> 
      </FormGrid>
      <FormGrid>
        <Button type="submit" variant="primary">Submit</Button>
      </FormGrid>
  </Form>
  )
}

const Upload = (props: UploadProps) => {
  const test_f = "default.ome.tif"; //TODO
  const [imageFormat, setImageFormat] = useState("DICOM-WEB");
  const [in_f, setInFile] = useState(test_f);
  const {
    formProps, handle,
    onAllow, onRecall
  } = props;
  const allowProps = {
    onClick: onAllow,
    variant: "primary",
    className: "mb-3"
  };
  const recallProps = {
    onClick: onRecall,
    variant: "primary",
    className: "mb-3"
  };
  const toggleImageFormat = () => {
    const newImageFormat = {
      "OME-TIFF": "DICOM-WEB",
      "DICOM-WEB": "OME-TIFF"
    }[imageFormat];
    setImageFormat(newImageFormat);
  }
  const useOME = imageFormat == "OME-TIFF";
  const message =  useOME ? (
    "Open a Local OME-TIFF Image"
  ): (
    "Connect to a DICOMweb™ Proxy"
  )
  const possibleActions = useOME ? (
    <>
      <Button {...allowProps}>Select Base Folder</Button>
      <Button {...recallProps}>Use recent Folder</Button>
    </>
  ) : (
    <FormDicom { ...formProps }/>
  )
  if (handle === null) {
    return (
    <UploadDiv>
        <FullWidthGrid>
          <Button
            onClick={toggleImageFormat}
            className="dicom-toggle"
          >
            <span>⇄</span>
          </Button>
          <div>{message}</div>
        </FullWidthGrid>
        {possibleActions}
    </UploadDiv>
    )
  }
  const fullFormProps = { ...formProps, handle };
  const updateSettings = (<TwoColumn>
      <Button {...allowProps}>Update Base Folder</Button>
      <h4>Local OME-TIFF</h4>
  </TwoColumn>)
  return (<>
    { updateSettings }
    <FormAny {...fullFormProps}/>
  </>)
}

export { Upload }
