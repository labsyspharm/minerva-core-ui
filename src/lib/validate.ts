import { findFile } from "./filesystem";

import type { ValidObj } from '../components/upload';

export type KV = [string, FormDataEntryValue];
export type ObjAny = {
  [key: string]: unknown;
}

type FormOutCommon = {
  name: string,
  mask?: string
}
type AnyKey = keyof Required<FormOutAny>;
type MCKey = keyof Required<FormOutMC>;
type FormOutMC = FormOutCommon & {
  dir: string,
}
type FormOutAny = FormOutCommon & {
  path: string,
  csv?: string
}
type ValidateIn<T> = {
  formOut: T,
  handle: Handle.Dir,
  onStart: (s: string) => void
}
type FormAnyOpts = ValidateIn<FormOutAny>
type FormMCOpts = ValidateIn<FormOutMC>
type FormOpts = FormAnyOpts | FormMCOpts
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
    if ("handle" in o && o.handle instanceof h) {
      if ("formOut" in o) {
        return typeof o.formOut === "object";
      }
    }
  }
  return false;
}
function isFormOpts (o: ObjAny): o is FormOpts {
  if (isOpts(o)) {
    const fo = (o.formOut || {}) as ObjAny;
    return "name" in fo;
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
    onStart(formOut.path);
  }
  return toValid(need_keys, valid_keys);
}

const validateMC: Validate<FormMCOpts> = async (opts) => {
  const { handle, formOut, onStart } = opts;
  const need_keys = ['name', 'dir'];
  const all = [...need_keys, 'mask'];
  const valid_keys = await all.reduce(async (memo, k) => {
    const v = k in formOut ? formOut[k as MCKey]: "";
    const out = await memo;
    if (typeof v !== "string") return out;
    switch(k) {
      case "name":
        return [...out, k];
      case "path":
        const found = await findFile({ handle, path: v })
        return found ? [...out, k] : out;
    }
    return out;
  }, Promise.resolve([] as string[]));
  const validated = need_keys.every((k) => {
    return valid_keys.includes(k as MCKey);
  });
  return toValid(need_keys, valid_keys);
}

const validate: Validate<Opts> = async (opts) => {
  if (!isFormOpts(opts)) {
    return toValid(["name"], []);
  }
  if (!isAnyOpts(opts)) {
    return await validateMC(opts);
  }
  return await validateAny(opts);
}
export { validate }
