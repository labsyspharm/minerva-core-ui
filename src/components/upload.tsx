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
  brightfield: string[],
}
type ChoiceMCIn = {
  handle: Handle.Dir,
  setMask: SetState,
  setDir: SetState,
  mask: string,
  dir: string
}
interface ToChoicesMC {
  (i: ChoiceMCIn): Promise<Choices>
}
type ChoiceAnyIn = {
  handle: Handle.Dir,
  setBrightfield: SetState,
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
  handle: Handle.Dir,
  onSubmit: FormEventHandler<HTMLFormElement>
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
type ValidOut = Partial<{
  isValid: true,
  isInvalid: true
}>
interface Validate {
  (v: ValidObj, key: string): ValidOut;
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

const shadow_gray = 'rgb(0 0 0 / 20%)';
const sh_4_8 = `0 4px 8px 0 ${shadow_gray}`;
const sh_6_20 = `0 6px 20px 0 ${shadow_gray}`;
const UploadDiv = styled.div`
  height: 100%;
  display: grid;
  align-items: center;
  grid-template-rows: auto;
  button {
    border: none;
    outline: 1px solid var(--theme-glass-edge);
    background-color: var(--theme-dark-main-color);
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
const validate: Validate = (valid, key) => {
  if (!(key in valid)) return {};
  const opt = valid[key] ? 'isValid' : 'isInvalid';
  return { [opt]: true }; 
}

const toGroupProps = (n: string): any => {
  return {controlId: n};
};

const toChoicesMC: ToChoicesMC = async (opts) => {
  const { handle } = opts;
  const files = await listDir({ handle });
  const mask = files.reduce((o, [k, v]: Entry) => {
    if (v instanceof FileSystemFileHandle) {
      return k.match(/\.tiff?$/) ? [...o, k] : o;
    }
    return o;
  }, [] as string[]);
  const dir = files.reduce((o, [k, v]: Entry) => {
    if (v instanceof FileSystemDirectoryHandle) {
      return [...o, k];
    };
    return o;
  }, [] as string[]);
  return {
    csv: [], path: [], mask, dir
  }
} 
const Options = (props: OptionsProps) => {
  const { label, vals } = props;
  const options = vals.map((value, i) => {
    return <option key={i} value={value}>{value}</option>;
  });
  return (<><option value=""> No {label}</option> {options}</>);
}
const noChoice = (): Choices => {
  return { dir: [], csv: [], brightfield: [], path: [], mask: [] };
} 
const FormMC = (props: FormProps) => {
  const { handle, valid, onSubmit } = props;
  const [ choices, setChoices ] = useState(noChoice());
  const [ name, sN, setName ] = _useState("");
  const [ mask, sM, setMask ] = _useState("");
  const [ dir, sD, setDir ] = _useState("");
  const formProps = { onSubmit };
  const hasNewChoice = (c: Choices) => {
    return [
      c.dir.some((i: string) => !(choices.dir).includes(i)),
      c.mask.some((i: string) => !(choices.mask).includes(i)),
      c.brightfield.some(
        (i: string) => !(choices.brightfield.includes(i))
      )
    ].some(x => x === true);
  }
  useEffect(() => {
    toChoicesMC({
      handle, mask, dir, setMask: sM, setDir: sD
    }).then(c => {
      if (hasNewChoice(c)) setChoices(c);
    });
  }, [JSON.stringify(choices)]);
  const dirOptions = {label: "Folder", vals: choices.dir};
  const maskOptions = {label: "Mask", vals: choices.mask};
  return (
  <Form {...formProps} noValidate>
      <Form.Group {...toGroupProps("name")}>
          <Form.Label>Dataset Name:</Form.Label>
          <FormGridRow hasValidation>
              <Form.Control {...{
                type: "text",
                required: true,
                value: name,
                name: "name",
                onChange: setName,
                ...validate(valid, 'name')
              }}/>
              <Form.Control.Feedback type="invalid">
              Dataset name already exists. Please choose a different name.
              </Form.Control.Feedback>
              <Form.Control.Feedback type="valid">
              Valid. (if no name chosen mcmicro project name is used.)
              </Form.Control.Feedback>
              <br/>
          </FormGridRow>
      </Form.Group>
      <FormGrid id="mcmicro_import">
          <Form.Group {...toGroupProps("path")}>
              <Form.Label>Folder:</Form.Label>
              <FormGridRow hasValidation>
                  <Form.Control {...{
                    type: "select",
                    as: "select",
                    required: true,
                    value: dir,
                    name: "dir",
                    onChange: setDir,
                    ...validate(valid, 'dir')
                  }}>
                  <Options {...dirOptions}/>
                  </Form.Control>
                  <Form.Control.Feedback type="invalid">
                  Please provide a valid path.
                  </Form.Control.Feedback>
                  <Form.Control.Feedback type="valid">
                  Valid.
                  </Form.Control.Feedback>
                  <br/>
              </FormGridRow>
          </Form.Group>
          <Form.Group {...toGroupProps("mask")}>
              <Form.Label>Choose a mask:</Form.Label>
              <FormGridRow hasValidation>
                <Form.Control {...{
                  type: "select",
                  as: "select",
                  required: false,
                  value: mask,
                  name: "mask",
                  onChange: setMask,
                  ...validate(valid, 'mask')
                }}>
                <Options {...maskOptions}/>
                </Form.Control>
                <Form.Control.Feedback type="invalid">
                No mask files found under this path.
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
  const paths = files.reduce((o, [k, v]: Entry) => {
    if (v instanceof FileSystemFileHandle) {
      return k.match(/\.tiff?$/) ? [...o, k] : o;
    }
    return o;
  }, [] as string[]).sort(
    (a,b) => ((x,y) => x-y)(
      ...[a,b].map(
        v => +v.toLowerCase().split(/\.|-|_/).includes("he")
      )
    )
  );
  return {
    csv, brightfield: [...paths],
    path: [...paths], mask: [...paths], dir: []
  }
}

const FormAny = (props: FormProps) => {
  const { handle, valid, onSubmit } = props;
  const [ choices, setChoices ] = useState(noChoice());
  const [ name, sN, setName ] = _useState("");
  const [ path, sP, setPath ] = _useState("");
  const [ mask, sM, setMask ] = _useState("");
  const [ brightfield, sB, setBrightfield ] = _useState("");
  const [ csv, sC, setCsv ] = _useState("");
  const formProps = { onSubmit };
  const hasNewChoice = (c: Choices) => {
    return [
      c.csv.some((i: string) => !(choices.csv).includes(i)),
      c.path.some((i: string) => !(choices.path).includes(i)),
      c.mask.some((i: string) => !(choices.mask).includes(i)),
      c.brightfield.some((i: string) => !(choices.brightfield).includes(i))
    ].some(x => x === true);
  }
  useEffect(() => {
    toChoicesAny({
      handle, mask, path, csv, 
      brightfield, setBrightfield: sB,
      setMask: sM, setPath: sP, setCsv: sC
    }).then(c => {
      if (hasNewChoice(c)) {
        sN(c.path[0].split('.')[0]);
        sB(c.path[Math.min(c.path.length-1,1)]);
        sP(c.path[0]);
        setChoices(c);
      }
    });
  }, [JSON.stringify(choices)]);
  const pathOptions = {label: "Image", vals: choices.path};
  const maskOptions = {label: "Mask", vals: choices.mask};
  const brightfieldOptions = {
    label: "Brightfield", vals: choices.brightfield
  };
  const csvOptions = {label: "CSV", vals: choices.csv};
  return (
  <Form {...formProps} noValidate>
      <Form.Group {...toGroupProps("name")}>
          <Form.Label>Dataset Name:</Form.Label>
          <FormGridRow hasValidation>
              <Form.Control {...{
                type: "text",
                required: true,
                value: name,
                name: "name",
                onChange: setName,
                ...validate(valid, 'name')
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
              <Form.Label>Multichannel Image:</Form.Label>
              <FormGridRow hasValidation>
                  <Form.Control {...{
                    type: "select",
                    as: "select",
                    required: true,
                    value: path,
                    name: "path",
                    onChange: setPath,
                    ...validate(valid, 'path')
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
          <Form.Group {...toGroupProps("brightfield")}>
              <Form.Label>Brightfield Image:</Form.Label>
              <FormGridRow hasValidation>
                  <Form.Control {...{
                    type: "select",
                    as: "select",
                    required: false,
                    value: brightfield,
                    name: "brightfield",
                    onChange: setBrightfield,
                    ...validate(valid, 'brightfield')
                  }}>
                  <Options {...brightfieldOptions}/>
                  </Form.Control>
                  <Form.Control.Feedback type="invalid">
                  Please provide a valid path to the brightfield image.
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
                    ...validate(valid, 'mask')
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
                    ...validate(valid, 'csv')
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
  const [mc, setMCMicro] = useState(false);
  const checkMC = () => setMCMicro(!mc);
  const {
    formProps, handle,
    onAllow, onRecall
  } = props;
  const F = mc ? FormMC : FormAny;
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
  if (handle === null) {
    return (
    <UploadDiv>
        <div>Select an ome.tiff</div>
        <Button {...allowProps}>Select Base Folder</Button>
        <Button {...recallProps}>Use recent Folder</Button>
    </UploadDiv>
    )
  }
  const fullFormProps = { ...formProps, handle };
  // TODO Improve layout of full version
  const updateSettings = (<TwoColumn>
      <Button {...allowProps}>Update Base Folder</Button>
  </TwoColumn>)
  // TODO ensure MCMICRO settings work
  const mcMicroSettings = ' ';
  return (<>
    { updateSettings }
    { mcMicroSettings }
    <F {...fullFormProps}/>
  </>)
}

export { Upload }
