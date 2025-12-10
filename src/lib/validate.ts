import { findFile } from "./filesystem";
import { findDicomWeb } from "../lib/dicom";

import type { ValidObj } from '../components/upload';

export type KV = [string, FormDataEntryValue];
export type ObjAny = {
  [key: string]: any;
}
type FormOutDicom = {
  url: string,
  name: string
}
type FormOutAny = {
  name: string,
  path: string,
  mask?: string,
  csv?: string
}
type Format = "DICOM-WEB" | "OME-TIFF";
type AnyKey = keyof Required<FormOutAny>;
type DicomKey = keyof Required<FormOutDicom>;
type ValidateIn<T> = {
  formOut: T,
  handle: Handle.Dir,
  onStart: (s: string, m: Format) => void
}
type FormAnyOpts = ValidateIn<FormOutAny>
type FormDicomOpts = ValidateIn<FormOutDicom>
type FormOpts = FormAnyOpts | FormDicomOpts
type Opts = ValidateIn<ObjAny>
interface Validate<I> {
  (i: I): Promise<ValidObj>;
}
interface ToValid {
  (n: string[], k: string[]): ValidObj;
}
export function isOpts (o: ObjAny): o is Opts {
  if ("onStart" in o && typeof o.onStart === "function") {
    const h = FileSystemDirectoryHandle;
    if ("formOut" in o) {
      if ("handle" in o && o.handle instanceof h) {
        return typeof o.formOut === "object";
      }
      if ("url" in o.formOut) {
        return true;  
      }
    }
  }
  return false;
}

function isFormOpts (o: ObjAny): o is FormOpts {
  if (isOpts(o)) {
    const fo = (o.formOut || {}) as ObjAny;
    return "name" in fo || "url" in fo;
  }
  return false;
}
function isAnyOpts (o: FormOpts): o is FormAnyOpts {
  if (!isFormOpts(o)) return false;
  return "path" in o.formOut;
}

const toValid: ToValid = (need_keys, keys) => {
  return need_keys.reduce((o: ValidObj, k: string) => {
    return {...o, [k]: keys.includes(k)};
  }, {} as ValidObj);
}

const validateDicom: Validate<FormDicomOpts> = async (opts) => {
  const { handle, formOut, onStart } = opts;
  const need_keys = ['url', 'name']; 
  const all = [...need_keys];
  const valid_keys = await all.reduce(async (memo, k) => {
    const v = k in formOut ? formOut[k as DicomKey]: "";
    const out = await memo;
    if (typeof v !== "string") return out;
    switch(k) {
      case "name":
        if (v.length === 0) return out;
        return [...out, k];
      case "url":
        if (v.length === 0) return out;
        try {
          await findDicomWeb(v);
          return [...out, k];
        }
        catch {
          return out;
        }
    }
    return out;
  }, Promise.resolve([] as string[]));
  const validated = need_keys.every((k) => {
    return valid_keys.includes(k as DicomKey);
  });
  if (validated && "url" in formOut) {
    onStart(formOut.url, "DICOM-WEB");
  }
  return toValid(need_keys, valid_keys);
}

const validateAny: Validate<FormAnyOpts> = async (opts) => {
  const { handle, formOut, onStart } = opts;
  const need_keys = ['name', 'path']; 
  const all = [...need_keys, 'mask', 'csv'];
  const valid_keys = await all.reduce(async (memo, k) => {
    const v = k in formOut ? formOut[k as AnyKey]: "";
    const out = await memo;
    if (typeof v !== "string") return out;
    switch(k) {
      case "name":
        if (v.length === 0) return out;
        return [...out, k];
      case "path":
        const found = await findFile({ handle, path: v })
        return found ? [...out, k] : out;
    }
    return out;
  }, Promise.resolve([] as string[]));
  const validated = need_keys.every((k) => {
    return valid_keys.includes(k as AnyKey);
  });
  if (validated && "path" in formOut) {
    onStart(formOut.path, "OME-TIFF");
  }
  return toValid(need_keys, valid_keys);
}

const validate: Validate<Opts> = async (opts) => {
  if (!isFormOpts(opts)) {
    return toValid(["name"], []);
  }
  if (isAnyOpts(opts)) {
    return await validateAny(opts);
  }
  return await validateDicom(opts);
}
export { validate }
